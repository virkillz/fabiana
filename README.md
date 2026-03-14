<p align="center">
  <img src="fabiana.png" alt="Fabiana" width="180" />
</p>

<h1 align="center">Fabiana</h1>
<p align="center"><em>Your AI life companion that remembers everything, proactively engages, and helps organize your life.</em></p>

---

## Why Fabiana?

There are plenty of AI assistants and **claws** out there optimizing for *usefulness*. Fabiana optimizes for **good vibes**.

The idea is simple: an AI that checks in on you. Asks about your day. Builds a useful memory of your life over time — your habits, your people, your goals — while actually feeling like a companion rather than a productivity tool. She talks in short bursts, initiates conversations like a normal human would, helps you remember things, tracks your diet, occasionally roasts you, and occasionally drops a news story she thought you'd find interesting.

No dashboards. No commands to remember. Just Telegram.

---

## What Makes Fabiana Different

**She messages you first.** Most AI assistants wait. Fabiana doesn't. She has a schedule and a TODO list she manages herself — and she'll reach out when she thinks there's something worth saying.

**She remembers.** Every conversation gets distilled into a plain-text memory system. Next week she still knows your sister's name, that you've been trying to sleep earlier, and that you hate meetings before 10am.

**The memory is yours.** All data lives in `.fabiana/data/` as plain text files. You can read it, edit it, back it up, or wipe it. No black boxes. No vendor lock-in. No vector embeddings to decode.

**She's extensible.** Drop a plugin into `plugins/` and she gains a new capability at next startup. 

**She's simple enough to trust.** The codebase is intentionally small. There's no build step. TypeScript runs directly via `tsx`. You can read the whole thing in an afternoon. Or ask LLM to explain it to you.

---

## How It Works

Fabiana runs as a background daemon and does three things on a loop:

| Mode | What it does |
|------|-------------|
| **Chat** | Listens for your Telegram messages and responds |
| **Initiative** | Checks her TODO list and calendar, decides if there's something worth telling you |
| **Consolidation** | Every night at midnight, distills the day's conversations into structured memory |

She's built on [Pi SDK](https://github.com/mariozechner/pi) — the same LLM harness that powers OpenClaw — with [OpenRouter](https://openrouter.ai) for model access. You choose the model.

### Memory — Plain Text, Always

```
.fabiana/data/memory/
├── identity.md          ← who you are
├── core.md              ← what's happening in your life right now
├── people/              ← one file per person you mention
├── interests/topics.md  ← what you care about
├── recent/this-week.md  ← short-term context
└── diary/               ← daily entries (auto-written)
```

Memory is tiered — hot files load every session, warm files load when relevant, cold files are archived but searchable. The agent writes and organizes its own memory. You can read any of it at any time.

### Plugins

Tools live in `plugins/` and are auto-discovered at startup. Fabiana ships with three:

- **`brave_search`** — Web search for news and facts
- **`calendar`** — Google Calendar awareness via `gccli`
- **`hackernews`** — Top stories from HN

Adding your own is a single TypeScript file. See [Plugin Development](#plugin-development) below.

---

## Installation

### Prerequisites

- **Node.js ≥ 22**
- A **Telegram bot** (takes 2 minutes via [@BotFather](https://t.me/BotFather))
- An **OpenRouter API key** at [openrouter.ai/keys](https://openrouter.ai/keys)

### Setup

```bash
git clone https://github.com/your-username/fabiana
cd fabiana
npm install
```

Create a `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_token_from_botfather
TELEGRAM_CHAT_ID=your_chat_id

OPENROUTER_API_KEY=sk-or-v1-...

# Optional — enables web search
BRAVE_API_KEY=your_brave_api_key

# Optional — enables calendar awareness
GOOGLE_CALENDAR_EMAIL=your@gmail.com
```

**Getting your Telegram credentials:**
1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token
2. Message [@userinfobot](https://t.me/userinfobot) → copy your numeric ID

### Credential Configuration

Fabiana supports two ways to set credentials — choose what works best for you:

**Option 1: `.env` file (simpler)**  
Copy `.env.example` to `.env` and fill in your values. Great for local development and getting started quickly.

**Option 2: Environment variables (more secure)**  
Set credentials directly in your shell or deployment environment:
```bash
export TELEGRAM_BOT_TOKEN=your_token
export TELEGRAM_CHAT_ID=your_chat_id
export OPENROUTER_API_KEY=sk-or-v1-...
```

This approach keeps secrets out of files and is preferred for production deployments or shared environments.

Both methods work identically — Fabiana will use whichever you provide.

### Run the health check

```bash
npx tsx src/cli.ts doctor
```

This verifies your environment, credentials, plugins, and data directories before you start.

### Start Fabiana

```bash
npm run dev
```

She'll start listening on Telegram and schedule herself from there.

---

## Commands

| Command | What it does |
|---------|-------------|
| `fabiana start` | Start the daemon (default) |
| `fabiana initiative` | Trigger a one-time proactive check |
| `fabiana consolidate` | Trigger a one-time memory consolidation |
| `fabiana doctor` | Check environment, credentials, plugins |
| `fabiana backup` | Archive `.fabiana/data/` into a timestamped `.tar.gz` |
| `fabiana restore <file>` | Restore data from a backup archive |
| `fabiana plugins add <user/repo>` | Install a plugin from GitHub |
| `fabiana plugins list` | List installed plugins and their status |

---

## Optional: Google Calendar

```bash
npm install -g @mariozechner/gccli
gccli accounts credentials ~/path/to/oauth-credentials.json
gccli accounts add your@gmail.com
```

Then add `GOOGLE_CALENDAR_EMAIL=your@gmail.com` to `.env`.

---

## Optional: Brave Search

1. Create a free account at [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com/register)
2. Create an API key and add `BRAVE_API_KEY=your_key` to `.env`

---

## Choosing a Model

Edit `config.json` to change the model:

```json
{
  "model": {
    "provider": "openrouter",
    "modelId": "moonshotai/kimi-k2.5",
    "thinkingLevel": "low"
  }
}
```

Good options via OpenRouter:
- `anthropic/claude-sonnet-4` — highest quality
- `moonshotai/kimi-k2.5` — solid balance of quality and cost
- `google/gemini-flash-1.5` — fast and cheap

---

## Plugin Development

A plugin is a self-contained directory with three files. You can place it directly in `plugins/` for local use, or publish it as a GitHub repo for others to install with `fabiana plugins add`.

### File structure

```
plugins/my-plugin/
├── index.ts       ← tool implementation (required)
├── package.json   ← must have "type": "module" (required)
└── plugin.json    ← manifest: metadata, env vars, default config (required for publishing)
```

### `index.ts`

Export a `tool` constant that satisfies `ToolDefinition`:

```typescript
import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';

export const tool: ToolDefinition = {
  name: 'my_tool',
  label: 'My Tool',                    // shown in logs
  description: 'What your tool does. Include when to use it.',
  parameters: Type.Object({
    query: Type.String({ description: 'The search query' }),
  }),
  execute: async (_toolCallId, params) => {
    const apiKey = process.env.MY_API_KEY;
    if (!apiKey) {
      return {
        content: [{ type: 'text' as const, text: '❌ MY_API_KEY not set.' }],
        details: { error: 'Missing API key' },
      };
    }
    const result = await doSomething(params.query, apiKey);
    return {
      content: [{ type: 'text' as const, text: result }],
      details: { success: true },
    };
  },
};
```

The `description` field is what the agent reads to decide when to use your tool — write it as instructions, not a one-liner.

### `package.json`

```json
{ "name": "fabiana-plugin-my-plugin", "version": "1.0.0", "type": "module" }
```

`"type": "module"` is required. Fabiana uses ESM throughout.

### `plugin.json`

The manifest is what makes your plugin installable via `fabiana plugins add`. It declares metadata, required environment variables, and default config that gets written into `.fabiana/config/plugins.json` on install.

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Short description of what this plugin does",
  "env": [
    {
      "key": "MY_API_KEY",
      "required": true,
      "description": "API key from example.com/api"
    },
    {
      "key": "MY_OPTIONAL_SETTING",
      "required": false,
      "description": "Optional override (defaults to 'auto')"
    }
  ],
  "config": {
    "enabled": true,
    "someDefault": 10
  }
}
```

- **`env`** — declares which environment variables your plugin needs. `fabiana doctor` will check these automatically for any installed plugin that has a `plugin.json`.
- **`config`** — default values merged into `.fabiana/config/plugins.json` on install. Behavioral settings only — never put secrets here.

### Installing locally

Drop the folder into `plugins/` and restart Fabiana. She discovers it automatically.

To configure or disable it, add an entry to `.fabiana/config/plugins.json`:

```json
{
  "my-plugin": {
    "enabled": true,
    "someDefault": 20
  }
}
```

### Publishing and installing from GitHub

Push your plugin as a GitHub repo with `index.ts` at the root (not nested in a subfolder). Then anyone can install it with:

```bash
fabiana plugins add your-username/my-plugin
```

This clones the repo, validates the structure, copies it to `plugins/`, and merges the default config from `plugin.json` into `.fabiana/config/plugins.json`. It will print any environment variables the plugin needs.

To see what's installed:

```bash
fabiana plugins list
```

---

## Backup & Restore

```bash
# Create a backup
fabiana backup
# → fabiana-2026-03-14T09-51-08.tar.gz

# Restore from backup
fabiana restore fabiana-2026-03-14T09-51-08.tar.gz
```

Your entire memory, diary, and conversation history — safely portable.

---

## License

MIT

---

*Built with the Pi SDK · For Arif — who wanted a companion, not a chatbot*
