# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Fabiana?

Fabiana is a **proactive AI life companion** that runs as a daemon. It sends messages first (not reactive) based on TODOs, calendar events, and news. It uses the Pi SDK (`@mariozechner/pi-ai`) to run AI agent sessions via OpenRouter, communicates through Telegram, and maintains a file-based progressive memory system.

## Running the Project

There is no build step — TypeScript runs directly via `tsx`.

```bash
npm run dev          # Start the daemon (all modes: chat + initiative + consolidation)
npm run initiative   # One-time proactive check (for testing)
npm run consolidate  # One-time memory consolidation (for testing)
```

The daemon starts all three modes in one process:
- **Chat**: Responds to incoming Telegram messages via long-polling
- **Initiative**: Proactively messages on a cron schedule (configurable, default every 30 min during active hours)
- **Consolidate**: Nightly memory cleanup at midnight

## Required Environment Variables (`.env`)

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
OPENROUTER_API_KEY=...
BRAVE_API_KEY=...          # optional, for web search
GOOGLE_CALENDAR_EMAIL=...  # optional, requires gccli installed
```

## Architecture

### Session Flow

```
Telegram message (or cron trigger)
  → src/daemon/index.ts (runPiSession)
      1. Load config.json (model, limits, schedule)
      2. Load permissions (.fabiana/config/manifest.json)
      3. Initialize Pi SDK with OpenRouter model
      4. Load system prompt (base + mode-specific override)
      5. Create agent tools
      6. Run Pi agent session
  → Tools execute (file I/O, Telegram, web, calendar)
  → Agent sends response via send_telegram tool
```

### Key Source Files

| File | Role |
|------|------|
| `src/cli.ts` | CLI entry point (Commander.js), dispatches to daemon modes |
| `src/daemon/index.ts` | Core orchestrator — Pi session runner, cron scheduling, mode dispatch |
| `src/telegram/poller.ts` | Telegraf long-polling wrapper, message queue, conversation logging |
| `src/loaders/context.ts` | Builds user prompt from memory files (hot/warm tiers) |
| `src/tools/index.ts` | Tool factory — creates all 9 agent tools |
| `src/utils/permissions.ts` | File access control via manifest.json glob patterns |

### Agent Tools

Core tools (hardcoded in `src/tools/index.ts`): `safe_read`, `safe_write`, `safe_edit`, `send_telegram`, `manage_todo`, `fetch_url`. All file tools are gated by `.fabiana/config/manifest.json` permissions (readonly/writable/appendonly).

Extension tools loaded as plugins from `plugins/`: `brave_search`, `calendar`, `hackernews`.

### Plugin System

Plugins live in `plugins/<name>/` and are auto-loaded at startup. Each plugin needs:
- `index.ts` — exports `tool: ToolDefinition` and optionally `metadata: PluginMetadata`
- `package.json` — with `"type": "module"`

The loader (`src/loaders/plugins.ts`) scans `plugins/` subdirectories, preferring `index.ts` over `index.js`. Plugins can be selectively enabled via `.fabiana/config/plugins.json`:

```json
{ "enabled": ["brave-search", "calendar", "hackernews"] }
```

If `plugins.json` doesn't exist, all plugins are loaded. Plugins that fail to load are skipped with a warning — they do not crash the daemon.

### Memory System (`.fabiana/data/memory/`)

Three-tier progressive disclosure:
- **Hot** (always loaded): `identity.md`, `core.md`, `recent/this-week.md`
- **Warm** (loaded contextually): `people/[name].md`, `dates/upcoming.md`, `interests/topics.md`
- **Cold** (not loaded, only searchable): diary entries, session logs

The agent writes and organizes its own memory files. Consolidation mode restructures conversational logs into structured memory at midnight.

### Configuration

- **`config.json`** — Model provider, cost/duration limits, initiative schedule (active hours, interval)
- **`.fabiana/config/manifest.json`** — File permission rules (glob patterns)
- **`.fabiana/config/system.md`** — Base system prompt (agent identity, tools, memory protocol)
- **`.fabiana/config/system-{chat,initiative,consolidate}.md`** — Mode-specific prompt overrides

### Agent TODO System

The agent manages its own task list at `agent-todo/` with three states:
- `pending/` — Tasks to do on next initiative run
- `scheduled/YYYY-MM-DD/` — Time-gated tasks
- `completed/YYYY-MM-DD/` — Archive

## Pi SDK Integration

The daemon uses `@mariozechner/pi-coding-agent` to create agent sessions. Sessions receive events via `session.subscribe()`: `thinking`, `tool-call`, `tool-result`, `message`, and `done`. Cost and duration limits are enforced per session via `config.json`.

## TypeScript Config

Strict mode, `ES2022` target, `NodeNext` modules. No compilation step — `tsx` handles it at runtime. Node.js ≥22 required.
