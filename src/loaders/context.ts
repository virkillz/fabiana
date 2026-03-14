import fs from 'fs/promises';

export type SessionMode = 'chat' | 'initiative' | 'consolidate' | 'daemon';

export interface FabianaContext {
  mode: SessionMode;
  identity: string;
  core: string;
  recentMemory: string;
  incomingMessage?: string;
  timestamp: string;
}

export async function loadContext(
  mode: SessionMode,
  incomingMessage?: string
): Promise<FabianaContext> {
  const timestamp = new Date().toISOString();

  const identity = await readFile('.fabiana/data/memory/identity.md', '(No identity file yet)');
  const core = await readFile('.fabiana/data/memory/core.md', '(No core memory yet)');
  const recentMemory = await readFile('.fabiana/data/memory/recent/this-week.md', '(No recent memory yet)');

  return { mode, identity, core, recentMemory, incomingMessage, timestamp };
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

  return base;
}
