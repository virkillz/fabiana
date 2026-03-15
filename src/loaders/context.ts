import fs from 'fs/promises';
import type { ConversationState } from '../conversations/types.js';
import { paths } from '../paths.js';

export type SessionMode =
  | 'chat'
  | 'initiative'
  | 'consolidate'
  | 'daemon'
  | 'external-outreach'
  | 'external-reply';

const TODAY_LOG_MAX_LINES = 80;

export interface FabianaContext {
  mode: SessionMode;
  identity: string;
  core: string;
  recentMemory: string;
  todayLog: string;
  incomingMessage?: string;
  timestamp: string;
  conversationState?: ConversationState;
}

export async function loadContext(
  mode: SessionMode,
  incomingMessage?: string,
  conversationState?: ConversationState
): Promise<FabianaContext> {
  const timestamp = new Date().toISOString();
  const today = timestamp.slice(0, 10);

  const identity = await readFile(paths.memory('identity.md'), '(No identity file yet)');
  const core = await readFile(paths.memory('core.md'), '(No core memory yet)');
  const recentMemory = await readFile(paths.memory('recent', 'this-week.md'), '(No recent memory yet)');
  const rawLog = await readFile(paths.logs(`conversation-${today}.log`), '');
  const todayLog = tailLines(rawLog, TODAY_LOG_MAX_LINES);

  return { mode, identity, core, recentMemory, todayLog, incomingMessage, timestamp, conversationState };
}

async function readFile(filePath: string, fallback: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return fallback;
  }
}

function tailLines(text: string, maxLines: number): string {
  if (!text) return '';
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length <= maxLines) return lines.join('\n');
  const omitted = lines.length - maxLines;
  return `(${omitted} earlier lines omitted — full log in ${paths.logs('conversation-' + new Date().toISOString().slice(0, 10) + '.log')})\n...\n` + lines.slice(-maxLines).join('\n');
}

export function buildPrompt(ctx: FabianaContext): string {
  const todaySection = ctx.todayLog
    ? `\n\n### Today's Conversation\n${ctx.todayLog}`
    : '';

  const base = `# Session Start — ${ctx.timestamp}
**Mode**: ${ctx.mode}

---

## 🧠 Memory

### Identity
${ctx.identity}

### Core State
${ctx.core}

### Recent (This Week)
${ctx.recentMemory}${todaySection}`;

  if (ctx.mode === 'chat' && ctx.incomingMessage) {
    return `${base}

---

## 💬 Incoming Message

> ${ctx.incomingMessage}`;
  }

  if (ctx.mode === 'external-reply' && ctx.conversationState && ctx.incomingMessage) {
    return `${base}

---

## 🗣️ External Conversation

**ID**: ${ctx.conversationState.id}
**With**: ${ctx.conversationState.externalDisplayName} (${ctx.conversationState.externalUserId})
**Purpose**: ${ctx.conversationState.purpose}
**Channel**: ${ctx.conversationState.channel}

### Incoming Message

> ${ctx.incomingMessage}`;
  }

  if (ctx.mode === 'external-outreach' && ctx.conversationState) {
    return `${base}

---

## 🗣️ External Conversation Context

**ID**: ${ctx.conversationState.id}
**With**: ${ctx.conversationState.externalDisplayName} (${ctx.conversationState.externalUserId})
**Purpose**: ${ctx.conversationState.purpose}
**Channel**: ${ctx.conversationState.channel}`;
  }

  return base;
}
