<p align="center">
  <img src="fabiana.png" alt="Fabiana" width="180" />
</p>

<h1 align="center">Fabiana</h1>
<p align="center"><em>Your personal AI companion that actually feels personal</em></p>

---

## The pitch

Every other AI assistant sits there, waiting for your command, answering like an overly polite receptionist with a forced smile. Fabiana doesn't wait. She texts you first, asks about your day, and remembers your habits. She has things on her mind, patterns she noticed, stories she thinks you'd enjoy.

Fabiana is not your typical obedient worker. She's independent, proactive, and has her own agenda. She's not an assistant who you tried to befriends with. She's a friend who slowly learn to help you with your tasks. The kind who remembers your sister's name, knows you refuse to schedule meetings before 10am, and will roast you—gently—when you promised to sleep early but it's 1am and you're asking her about world news again.

No dashboards. No commands to memorize. She just slides into your DM.

---

<p align="center">
  <img src="screenshot.png" alt="Screenshot"/>
</p>


## What she does

**She messages you first.** She has a schedule and a TODO list she manages herself. She'll reach out when there's something worth saying — not when you remember to ask.

**She remembers everything.** Every conversation gets distilled into plain-text memory. Next week she still knows what you're working on, who you mentioned, and what's stressing you out. Next month too.

**Her memory is yours.** All data lives as plain text files and a local SQLite database. Read it, edit it, back it up, delete it. No black boxes. No vector embeddings. No vendor lock-in.

**She learns new tricks.** Install a plugin and she wakes up with a new capability. Web search, calendar, Hacker News — or whatever you build.

**She's small enough to trust.** The codebase is intentionally tiny. TypeScript, a handful of dependencies, plain text files. You can read the whole thing in an afternoon.

**She scales.** Version 2.0 is multi-agent. One installation, multiple independent companions — each with their own memory, personality, and Telegram bot.

---

## What's new in 2.0

Fabiana 2.0 is a **multi-agent release**. The core change is that one installation can now run multiple independent companions on the same machine — each with their own memory, config, credentials, and personality. A single `fabiana start` launches all of them concurrently.

Everything else is backward compatible. If you're upgrading from 1.x, your existing setup keeps working without any changes. Run `fabiana migrate` when you're ready to move to the new layout.

**Migrating from 1.x?** Jump to [Migrating from 1.x](#migrating-from-1x).

---

## How it works

Fabiana runs as a background daemon doing four things on a loop:

| Mode | What it does |
|------|-------------|
| **Chat** | Listens for your Telegram/Slack messages and responds |
| **Initiative** | Checks her TODO list, calendar, and mood — decides if there's something worth telling you |
| **Solitude** | When you've been quiet long enough, she does her own thing — research, reflection, creative writing |
| **Consolidation** | Every night at midnight, distills the day's conversations into structured memory |

She's built on [Pi SDK](https://github.com/mariozechner/pi) — which means she runs on Anthropic, OpenAI, Google Gemini, Groq, Mistral, Amazon Bedrock, and more. [OpenRouter](https://openrouter.ai) is the default because one key gets you 240+ models.

---

## Installation

### What you need

- **Node.js ≥ 22**
- An LLM API key — [OpenRouter](https://openrouter.ai/keys) is the easiest starting point (one key, 240+ models)
- A **Telegram** or **Slack** account to chat with her

### Setup

```bash
npm i -g fabiana
fabiana init
```

That's it. `fabiana init` walks you through everything — her name, personality, preferred tone, which provider and model to use, and which messaging app to connect. At the end, it tells you exactly which credentials to set.

Add those to your agent's `.env` file at `~/.fabiana/agents/default/.env`:

```env
# Messaging — whichever you chose during init
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
# or
SLACK_BOT_TOKEN=...
SLACK_APP_TOKEN=...
SLACK_CHANNEL_ID=...

# LLM — whichever provider you picked
OPENROUTER_API_KEY=sk-or-v1-...   # OpenRouter (recommended — covers 240+ models)
ANTHROPIC_API_KEY=...             # Direct Anthropic
OPENAI_API_KEY=...                # Direct Google
GEMINI_API_KEY=...                # Direct Google

# Optional extras
BRAVE_API_KEY=...                 # Web search
GOOGLE_CALENDAR_EMAIL=your@gmail.com  # Calendar awareness
```

### Check everything's wired up

```bash
fabiana doctor
```

Verifies your credentials, plugins, and data directories. Fix anything it flags, then:

```bash
fabiana start
```

Open Telegram (or Slack) — she'll reach out first.

---

## Directory layout

All Fabiana data lives under `~/.fabiana/`:

```
~/.fabiana/
  agents.json                    ← registered agents
  plugins/                       ← shared plugins (updated by `fabiana sync`)
  skills/                        ← shared skills  (updated by `fabiana sync`)
  agents/
    default/                     ← your first companion
      .env                       ← credentials (Telegram/Slack tokens, API keys)
      config/
        config.json              ← model, schedule, channels
        manifest.json            ← file permission rules
        plugins.json             ← which plugins are enabled for this agent
        skills.json              ← which skills are enabled for this agent
        system.md                ← base system prompt (identity, personality)
        system-chat.md           ← chat mode overlay
        system-initiative.md     ← initiative mode overlay
        system-consolidate.md    ← consolidation mode overlay
        system-solitude.md       ← solitude mode overlay
      data/
        memory/
          identity.md            ← always loaded: who you are
          core.md                ← always loaded: current state
          recent/this-week.md    ← always loaded: recent context
          mood.md                ← current mood state
          memory.db              ← SQLite structured memory
        logs/                    ← session and conversation logs
        agent-todo/              ← agent's own task queue (pending/scheduled/completed)
        conversations/           ← external conversation threads
        images/                  ← received and generated images
        last_interaction.json    ← timestamps for interaction and solitude
    aria/                        ← a second companion (optional)
      .env
      config/ ...
      data/ ...
```

**Plugins and skills are shared.** They live at `~/.fabiana/plugins/` and `~/.fabiana/skills/`, available to all agents. Each agent's `config/plugins.json` and `config/skills.json` control which ones are active for that agent.

No black boxes. Open `~/.fabiana/agents/default/config/system.md` to see exactly what she's been told to do — or edit it to change how she thinks, speaks, or behaves.

---

## Commands

### Core

| Command | What it does |
|---------|-------------|
| `fabiana init [--agent <name>]` | Interactive setup wizard |
| `fabiana start [agent]` | Start daemon (all agents, or one by name) |
| `fabiana sync` | Copy bundled plugins/skills to `~/.fabiana/` |
| `fabiana doctor` | Verify config, credentials, and dependencies |
| `fabiana migrate` | Migrate 1.x layout to 2.0 multi-agent layout |

### Per-agent modes (one-off runs)

| Command | What it does |
|---------|-------------|
| `fabiana initiative [type] [--agent <name>]` | Run one proactive check |
| `fabiana consolidate [--agent <name>]` | Run one memory consolidation |
| `fabiana solitude [type] [--agent <name>]` | Run one solitude session |
| `fabiana prompt-preview [mode] [--agent <name>]` | Preview the full system prompt |

### Agent management

| Command | What it does |
|---------|-------------|
| `fabiana agent list` | Show all configured agents |
| `fabiana agent add <name>` | Add a new companion (runs setup wizard) |
| `fabiana agent remove <name>` | Remove from registry (files not deleted) |

### Config and prompts

| Command | What it does |
|---------|-------------|
| `fabiana config [--agent <name>]` | Open config.json in `$EDITOR` |
| `fabiana system-prompt [--agent <name>]` | Edit a system prompt file |

### Plugins and skills

| Command | What it does |
|---------|-------------|
| `fabiana plugins add user/repo` | Install a plugin from GitHub |
| `fabiana plugins list` | List installed plugins |
| `fabiana skills add user/repo` | Install a skill from GitHub |
| `fabiana skills list` | List installed skills |
| `fabiana skills enable/disable <name>` | Toggle a skill |
| `fabiana skills remove <name>` | Uninstall a skill |

### Providers and models

| Command | What it does |
|---------|-------------|
| `fabiana provider` | Show current provider |
| `fabiana provider use` | Switch provider interactively |
| `fabiana model` | Show current model |
| `fabiana model use` | Switch model interactively |
| `fabiana model test` | Verify the model responds |

### Backup and restore

| Command | What it does |
|---------|-------------|
| `fabiana backup [-o file]` | Save her brain to a zip file |
| `fabiana restore <file>` | Bring her back from the archive |
| `fabiana db migrate` | Import flat memory files into SQLite (run once) |

---

## Multiple agents

One installation, multiple companions — each on its own Telegram bot, with its own memory and personality, running concurrently.

```bash
# Add a second companion
fabiana agent add aria      # runs the interactive setup wizard for aria

# List what's running
fabiana agent list

# Start only one
fabiana start aria

# Start all (default)
fabiana start
```

**Credentials are per-agent.** Each agent has its own `.env` at `~/.fabiana/agents/<name>/.env`, so different agents can use different Telegram bots, Slack workspaces, or even different AI providers.

**Plugins and skills are shared.** `fabiana sync` updates them once for all agents. Each agent independently enables or disables them via its own `config/plugins.json` and `config/skills.json`.

---

## Choosing a model

Edit `~/.fabiana/agents/default/config/config.json`, or use the interactive picker:

```bash
fabiana model use
```

**Popular choices:**

| Provider | Model | Notes |
|---|---|---|
| `openrouter` | `anthropic/claude-sonnet-4-5` | Best quality via OpenRouter |
| `openrouter` | `google/gemini-2.5-flash` | Fast and cheap |
| `anthropic` | `claude-sonnet-4-6` | Direct Anthropic |
| `google` | `gemini-2.5-flash` | Direct Google |
| `groq` | `llama-3.3-70b-versatile` | Very fast, generous free tier |

See [docs/providers.md](docs/providers.md) for the full list.

---

## Plugins and skills

**Plugins** add new tools — external APIs, CLI tools, things Fabiana can't do with her built-in tools. Bundled: `brave_search`, `hackernews`, `calendar`, `stable-diffusion`, `tts`.

**Skills** add specialized knowledge — step-by-step instructions, workflows, templates for tasks Fabiana already has tools for.

Install from GitHub:

```bash
fabiana plugins add username/my-plugin
fabiana skills add username/my-skill
```

See [docs/plugins.md](docs/plugins.md) and [docs/skills.md](docs/skills.md) for how to write and publish your own.

---

## Optional: Google Calendar

```bash
npm install -g @mariozechner/gccli
gccli accounts credentials ~/path/to/oauth-credentials.json
gccli accounts add your@gmail.com
```

Then add `GOOGLE_CALENDAR_EMAIL=your@gmail.com` to `~/.fabiana/agents/default/.env`. Now she'll actually know when you have that meeting you keep forgetting.

---

## Optional: Brave Search

1. Create a free account at [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com/register)
2. Grab an API key and add `BRAVE_API_KEY=your_key` to `~/.fabiana/agents/default/.env`

---

## Backup & restore

```bash
# Save everything
fabiana backup
# → fabiana-2026-03-19T09-51-08.tar.gz

# Bring it back
fabiana restore fabiana-2026-03-19T09-51-08.tar.gz
```

Memory, diary, conversations — all of it, safely portable.

---

## Migrating from 1.x

Fabiana 1.x stored all data directly in `~/.fabiana/`. Version 2.0 moves per-agent data to `~/.fabiana/agents/default/` while keeping plugins and skills at the root.

**Your existing setup keeps working without any changes.** Fabiana automatically detects the old layout and treats `~/.fabiana/` as the agent home — no migration required to keep using it.

When you're ready to switch to the new multi-agent layout:

```bash
fabiana migrate
```

This copies `config/`, `data/`, and `.env` from `~/.fabiana/` into `~/.fabiana/agents/default/` and creates `agents.json`. Plugins and skills stay at the root — they don't move. The original files are left in place until you remove them manually.

After migration, verify everything works:

```bash
fabiana doctor
fabiana start
```

Then clean up the old directories when you're confident:

```bash
rm -rf ~/.fabiana/config ~/.fabiana/data ~/.fabiana/.env
```

### What changed

| | 1.x | 2.0 |
|---|---|---|
| Config | `~/.fabiana/config/` | `~/.fabiana/agents/<name>/config/` |
| Data / memory | `~/.fabiana/data/` | `~/.fabiana/agents/<name>/data/` |
| Credentials | `~/.fabiana/.env` | `~/.fabiana/agents/<name>/.env` |
| Plugins | `~/.fabiana/plugins/` | `~/.fabiana/plugins/` *(unchanged, shared)* |
| Skills | `~/.fabiana/skills/` | `~/.fabiana/skills/` *(unchanged, shared)* |
| `fabiana start` | Starts one agent | Starts all configured agents |
| `fabiana init` | Creates `~/.fabiana/` | Creates `~/.fabiana/agents/default/` |

### After upgrading the package

After `npm i -g fabiana`, always run:

```bash
fabiana sync
```

This copies updated bundled plugins and skills into `~/.fabiana/plugins/` and `~/.fabiana/skills/`. Your per-agent `config/plugins.json` is not touched — your enabled/disabled settings are preserved.

---

## Further reading

- [docs/plugins.md](./docs/plugins.md) — writing and publishing plugins
- [docs/skills.md](./docs/skills.md) — writing and publishing skills
- [docs/initiative.md](./docs/initiative.md) — how proactive messaging works
- [docs/solitude.md](./docs/solitude.md) — Fabiana's unstructured self-time
- [docs/providers.md](./docs/providers.md) — supported AI providers and config
- [docs/sqlite-memory.md](./docs/sqlite-memory.md) — structured memory system

---

## License

MIT

---

*Built with the Pi SDK · For Arif — who wanted a companion, not a chatbot*
