<p align="center">
  <img src="fabiana.png" alt="Fabiana" width="180" />
</p>

<h1 align="center">Fabiana</h1>
<p align="center"><em>she texts first.</em></p>

---

## The pitch

Every other AI assistant sits there, waiting, blinking, and answer to you like an overpolite receptionist with fake smiles. Fabiana doesn't wait. She has places to be, things she noticed, a story she thought you'd find interesting. She'll message you before you even open the app.

She's not an assistant. She's a companion. One who remembers your sister's name, knows you hate meetings before 10am, and will roast you (gently) if you said you'd go to bed early and you're still up at 1am asking her about the news.

No dashboards. No commands to remember. She slides into your DM.

---

## What she does

**She messages you first.** She has a schedule and a TODO list she manages herself. She'll reach out when there's something worth saying — not when you remember to ask.

**She remembers everything.** Every conversation gets distilled into plain-text memory. Next week she still knows what you're working on, who you mentioned, and what's stressing you out. Next month too.

**Her memory is yours.** All data lives in `.fabiana/data/` as plain text files. Read it, edit it, back it up, delete it. No black boxes. No vector embeddings. No vendor lock-in.

**She learns new tricks.** Drop a plugin into `plugins/` and she wakes up with a new capability. Web search, calendar, Hacker News — or whatever you build.

**She's small enough to trust.** The codebase is intentionally tiny. TypeScript, a handful of dependencies, plain text files. You can read the whole thing in an afternoon.

---

## How it works

Fabiana runs as a background daemon doing three things on a loop:

| Mode | What it does |
|------|-------------|
| **Chat** | Listens for your Telegram messages and responds |
| **Initiative** | Checks her TODO list and calendar, decides if there's something worth telling you |
| **Consolidation** | Every night at midnight, distills the day's conversations into structured memory |

She's built on [Pi SDK](https://github.com/mariozechner/pi) — which means she runs on Anthropic, OpenAI, Google Gemini, Groq, Mistral, Amazon Bedrock, and more. [OpenRouter](https://openrouter.ai) is the default because one key gets you 240+ models.

### Memory — plain text, always

```
.fabiana/data/memory/
├── identity.md          ← who you are
├── core.md              ← what's happening in your life right now
├── people/              ← one file per person you mention
├── interests/topics.md  ← what you care about
├── recent/this-week.md  ← short-term context
└── diary/               ← daily entries (auto-written)
```

Memory is tiered — hot files load every session, warm files load when relevant, cold files sit in the archive, searchable when needed. She writes and organizes it herself. You can read any of it any time.

---

## Installation

### What you need

- **Node.js ≥ 22**
- A **Telegram bot** — takes 2 minutes via [@BotFather](https://t.me/BotFather)
- An LLM API key — [OpenRouter](https://openrouter.ai/keys) is the easiest starting point (one key, 240+ models)

### Setup

```bash
git clone https://github.com/your-username/fabiana
cd fabiana
npm install
fabiana init
```

`fabiana init` walks you through the whole setup. Or do it manually:

Create a `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_token_from_botfather
TELEGRAM_CHAT_ID=your_chat_id

# Pick one (or more)
OPENROUTER_API_KEY=sk-or-v1-...   # OpenRouter (recommended — covers everything)
ANTHROPIC_API_KEY=...             # Direct Anthropic
OPENAI_API_KEY=...                # Direct OpenAI
GEMINI_API_KEY=...                # Direct Google

# Optional extras
BRAVE_API_KEY=...                 # Web search
GOOGLE_CALENDAR_EMAIL=your@gmail.com  # Calendar awareness
```

**Getting your Telegram credentials:**
1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token
2. Message [@userinfobot](https://t.me/userinfobot) → copy your numeric ID

### Check everything's wired up

```bash
fabiana doctor
```

Verifies your environment, credentials, plugins, and data directories. Fix anything it flags, then:

```bash
fabiana start
```

She'll start listening on Telegram and schedule herself from there.

---

## Commands

| Command | What it does |
|---------|-------------|
| `fabiana init` | First time? Let's get acquainted |
| `fabiana start` | Wake her up — she'll take it from there |
| `fabiana initiative` | Make her think. Just once. (good for testing) |
| `fabiana consolidate` | Tidy up the mind palace |
| `fabiana doctor` | Is everything okay in there? Let's check |
| `fabiana backup` | Save her brain to a zip file |
| `fabiana restore <file>` | Bring her back from the archive |
| `fabiana plugins add <user/repo>` | Teach her a new trick from GitHub |
| `fabiana plugins list` | What can she do? |

---

## Choosing a model

Edit `config.json`:

```json
{
  "model": {
    "provider": "openrouter",
    "modelId": "anthropic/claude-sonnet-4-5",
    "thinkingLevel": "low"
  }
}
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

## Optional: Google Calendar

```bash
npm install -g @mariozechner/gccli
gccli accounts credentials ~/path/to/oauth-credentials.json
gccli accounts add your@gmail.com
```

Then add `GOOGLE_CALENDAR_EMAIL=your@gmail.com` to `.env`. Now she'll actually know when you have that meeting you keep forgetting.

---

## Optional: Brave Search

1. Create a free account at [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com/register)
2. Grab an API key and add `BRAVE_API_KEY=your_key` to `.env`

---

## Backup & restore

```bash
# Save everything
fabiana backup
# → fabiana-2026-03-14T09-51-08.tar.gz

# Bring it back
fabiana restore fabiana-2026-03-14T09-51-08.tar.gz
```

Memory, diary, conversations — all of it, safely portable.

---

## Plugin development

Plugins live in `plugins/` and are auto-discovered at startup. A plugin is just a TypeScript file that exports a tool definition. See [docs/plugins.md](docs/plugins.md) for the full guide.

---

## License

MIT

---

*Built with the Pi SDK · For Arif — who wanted a companion, not a chatbot*
