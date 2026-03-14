import fs from 'fs/promises';
import type { ChannelAdapter, IncomingMessage } from './types.js';

export class SlackAdapter implements ChannelAdapter {
  readonly name = 'slack';
  private app: any = null;
  private ownerUserId: string;
  private ownerDmChannelId: string | null = null;
  private queue: IncomingMessage[] = [];

  constructor(ownerUserId: string) {
    this.ownerUserId = ownerUserId;
  }

  async start(): Promise<void> {
    const botToken = process.env.SLACK_BOT_TOKEN;
    const appToken = process.env.SLACK_APP_TOKEN;
    if (!botToken || !appToken) {
      throw new Error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required for the Slack channel');
    }

    let App: any;
    try {
      ({ App } = await import('@slack/bolt'));
    } catch {
      throw new Error('@slack/bolt is not installed — run: npm install @slack/bolt');
    }

    this.app = new App({
      token: botToken,
      appToken,
      socketMode: true,
    });

    this.app.message(async ({ message }: any) => {
      // Skip bot messages, edits, and other subtypes
      if (message.subtype) return;
      const text = (message.text || '').trim();
      if (!text) return;

      this.queue.push({
        text,
        senderId: message.user,
        channelId: message.channel,
        threadId: message.thread_ts || message.ts,
        timestamp: new Date(parseFloat(message.ts) * 1000),
        source: 'slack',
      });

      console.log(`📨 [slack] Message queued: "${text.slice(0, 50)}"`);
    });

    await this.app.start();
    console.log('✓ Slack Socket Mode started');
  }

  async stop(): Promise<void> {
    if (this.app) await this.app.stop();
  }

  /**
   * Send a message. If channelId is provided, sends there (with optional thread_ts).
   * If omitted, opens/reuses a DM with the owner.
   */
  async send(text: string, channelId?: string, threadId?: string): Promise<void> {
    if (!this.app) throw new Error('Slack adapter not started');
    const target = channelId ?? (await this.getOwnerDmChannelId());
    await this.app.client.chat.postMessage({
      channel: target,
      text,
      ...(threadId ? { thread_ts: threadId } : {}),
    });
  }

  private async getOwnerDmChannelId(): Promise<string> {
    if (this.ownerDmChannelId) return this.ownerDmChannelId;
    const result = await this.app.client.conversations.open({ users: this.ownerUserId });
    this.ownerDmChannelId = result.channel.id as string;
    return this.ownerDmChannelId!;
  }

  drainQueue(): IncomingMessage[] {
    const messages = [...this.queue];
    this.queue = [];
    return messages;
  }

  hasMessages(): boolean {
    return this.queue.length > 0;
  }

  isOwner(senderId: string): boolean {
    return senderId === this.ownerUserId;
  }

  async logConversation(role: 'user' | 'fabiana', text: string, source = 'slack'): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${source}] ${role === 'user' ? '👤 You' : '🌸 Fabiana'}: ${text}\n`;
    await fs.appendFile(`.fabiana/data/logs/conversation-${today}.log`, entry, 'utf-8').catch(() => {});
  }

  /** Expose the Bolt app for use by the start_external_conversation tool */
  getBoltApp(): any {
    return this.app;
  }
}
