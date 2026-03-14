import fs from 'fs/promises';
import path from 'path';
import type { ConversationState, CreateConversationOpts } from './types.js';

const DATA_DIR = '.fabiana/data/conversations';

/** 4 days of inactivity → auto-expire */
const EXPIRY_MS = 4 * 24 * 60 * 60 * 1000;

export class ConversationManager {
  async find(channel: string, userId: string, threadId: string): Promise<ConversationState | null> {
    const all = await this.listOpen();
    return (
      all.find(
        (c) => c.channel === channel && c.externalUserId === userId && c.threadId === threadId
      ) ?? null
    );
  }

  async create(opts: CreateConversationOpts): Promise<ConversationState> {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);
    const slug = opts.purpose
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const id = `${opts.channel}-${opts.externalUserId}-${date}-${slug}`;
    const filePath = path.join(DATA_DIR, `${id}.md`);
    const now = new Date().toISOString();

    const frontmatter = [
      '---',
      `id: ${id}`,
      `channel: ${opts.channel}`,
      `external_user_id: ${opts.externalUserId}`,
      `external_display_name: ${opts.externalDisplayName}`,
      `thread_ts: ${opts.threadId}`,
      `channel_id: ${opts.channelId}`,
      `purpose: ${opts.purpose}`,
      `status: open`,
      `created_at: ${now}`,
      `last_activity: ${now}`,
      `initiated_by: ${opts.initiatedBy}`,
      '---',
      '',
      '## Context',
      `[${opts.purpose}]`,
      '',
      '## Exchange',
    ].join('\n');

    await fs.writeFile(filePath, frontmatter, 'utf-8');

    return {
      id,
      channel: opts.channel,
      externalUserId: opts.externalUserId,
      externalDisplayName: opts.externalDisplayName,
      threadId: opts.threadId,
      channelId: opts.channelId,
      purpose: opts.purpose,
      status: 'open',
      createdAt: now,
      lastActivity: now,
      initiatedBy: opts.initiatedBy,
      filePath,
    };
  }

  async append(id: string, role: string, text: string): Promise<void> {
    const filePath = path.join(DATA_DIR, `${id}.md`);
    const timestamp = new Date().toISOString();
    const icon = role === 'fabiana' ? '🌸 Fabiana' : `👤 ${role}`;
    const entry = `[${timestamp}] ${icon}: ${text}\n`;
    await fs.appendFile(filePath, entry, 'utf-8');
    await this.updateFrontmatterField(filePath, 'last_activity', timestamp);
  }

  async close(id: string, status: 'resolved' | 'owner-notified'): Promise<void> {
    const filePath = path.join(DATA_DIR, `${id}.md`);
    await this.updateFrontmatterField(filePath, 'status', status);
  }

  async listOpen(): Promise<ConversationState[]> {
    const files = await this.listFiles();
    const states: ConversationState[] = [];
    for (const filePath of files) {
      const state = await this.parseFile(filePath);
      if (state?.status === 'open') states.push(state);
    }
    return states;
  }

  async getById(id: string): Promise<ConversationState | null> {
    return this.parseFile(path.join(DATA_DIR, `${id}.md`));
  }

  /**
   * Mark conversations inactive for > 4 days as owner-notified.
   * Returns the list of expired conversations so the daemon can notify the owner.
   */
  async expireStale(): Promise<ConversationState[]> {
    const open = await this.listOpen();
    const now = Date.now();
    const expired: ConversationState[] = [];
    for (const conv of open) {
      if (now - new Date(conv.lastActivity).getTime() > EXPIRY_MS) {
        await this.close(conv.id, 'owner-notified');
        expired.push(conv);
      }
    }
    return expired;
  }

  private async listFiles(): Promise<string[]> {
    try {
      const entries = await fs.readdir(DATA_DIR);
      return entries.filter((e) => e.endsWith('.md')).map((e) => path.join(DATA_DIR, e));
    } catch {
      return [];
    }
  }

  private async parseFile(filePath: string): Promise<ConversationState | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return null;
      const fm = match[1];
      const get = (key: string) => {
        const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
        return m ? m[1].trim() : '';
      };
      return {
        id: get('id'),
        channel: get('channel'),
        externalUserId: get('external_user_id'),
        externalDisplayName: get('external_display_name'),
        threadId: get('thread_ts'),
        channelId: get('channel_id'),
        purpose: get('purpose'),
        status: get('status') as ConversationState['status'],
        createdAt: get('created_at'),
        lastActivity: get('last_activity'),
        initiatedBy: get('initiated_by'),
        filePath,
      };
    } catch {
      return null;
    }
  }

  private async updateFrontmatterField(filePath: string, key: string, value: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const updated = content.replace(new RegExp(`(^${key}:\\s*)(.+)$`, 'm'), `$1${value}`);
    await fs.writeFile(filePath, updated, 'utf-8');
  }
}
