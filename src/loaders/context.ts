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

export interface FabianaContext {
  mode: SessionMode;
  identity: string;
  core: string;
  recentMemory: string;
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

  const identity = await readFile(paths.memory('identity.md'), '(No identity file yet)');
  const core = await readFile(paths.memory('core.md'), '(No core memory yet)');
  const recentMemory = await readFile(paths.memory('recent', 'this-week.md'), '(No recent memory yet)');

  return { mode, identity, core, recentMemory, incomingMessage, timestamp, conversationState };
}

async function readFile(filePath: string, fallback: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return fallback;
  }
}

export function buildPrompt(ctx: FabianaContext): string {
  const base = `# Session Start — ${ctx.timestamp}
**Mode**: ${ctx.mode}

---

## 🧠 Memory

### Identity
${ctx.identity}

### Core State
${ctx.core}

### Recent (This Week)
${ctx.recentMemory}`;

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
