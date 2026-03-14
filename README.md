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

**She's simple enough to trust.** The codebase is intentionally small. TypeScript, a handful of dependencies, plain text files. You can read the whole thing in an afternoon. Or ask an LLM to explain it to you.

---

## How It Works

Fabiana runs as a background daemon and does three things on a loop:

| Mode | What it does |
|------|-------------|
| **Chat** | Listens for your Telegram messages and responds |
| **Initiative** | Checks her TODO list and calendar, decides if there's something worth telling you |
| **Consolidation** | Every night at midnight, distills the day's conversations into structured memory |

She's built on [Pi SDK](https://github.com/mariozechner/pi) — the same LLM harness that powers OpenClaw. Pi supports Anthropic, OpenAI, Google Gemini, Groq, Mistral, Amazon Bedrock, and more — including [OpenRouter](https://openrouter.ai) as a meta-provider for 240+ models. You choose the provider and model.

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

Tools live in `plugins/` and are auto-discovered at startup. Fabiana ships with three: `brave_search`, `calendar`, and `hackernews`. Adding your own is a single TypeScript file — see [Plugin Development](docs/plugins.md).

---

## Installation

### Prerequisites

- **Node.js ≥ 22**
- A **Telegram bot** (takes 2 minutes via [@BotFather](https://t.me/BotFather))
- An API key for your chosen LLM provider — [OpenRouter](https://openrouter.ai/keys) is the easiest starting point (one key for 240+ models)

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

# Add the key for whichever provider you choose (see docs/providers.md)
OPENROUTER_API_KEY=sk-or-v1-...   # OpenRouter (default)
# ANTHROPIC_API_KEY=...           # Anthropic direct
# OPENAI_API_KEY=...              # OpenAI direct
# GEMINI_API_KEY=...              # Google Gemini direct

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
export OPENROUTER_API_KEY=sk-or-v1-...  # or whichever provider key you're using
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

## Choosing a Provider and Model

Edit `config.json` to change the provider or model:

```json
{
  "model": {
    "provider": "openrouter",
    "modelId": "anthropic/claude-sonnet-4-5",
    "thinkingLevel": "low"
  }
}
```

Fabiana supports a wide range of providers — Anthropic, OpenAI, Google Gemini, Groq, Mistral, Amazon Bedrock, xAI, and more. OpenRouter is the default because one API key covers them all, but you can switch to any provider directly if you prefer.

**Popular choices:**

| Provider | Model | Notes |
|---|---|---|
| `openrouter` | `anthropic/claude-sonnet-4-5` | Best quality via OpenRouter |
| `openrouter` | `google/gemini-2.5-flash` | Fast and cheap |
| `anthropic` | `claude-sonnet-4-6` | Direct Anthropic, slightly cheaper |
| `google` | `gemini-2.5-flash` | Direct Google |
| `groq` | `llama-3.3-70b-versatile` | Very fast, generous free tier |

See [docs/providers.md](docs/providers.md) for the full list of supported providers, model IDs, and the env var each one needs.

---

## Plugin Development

See [docs/plugins.md](docs/plugins.md) for the full guide — file structure, the `ToolDefinition` interface, `plugin.json` manifest format, and how to publish and install plugins from GitHub.

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
