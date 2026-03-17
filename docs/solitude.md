# Solitude Mode

Solitude mode gives Fabiana unstructured time to do her own thing. No incoming message, no user to respond to — just a type of activity and the tools to pursue it. She might research a topic she's curious about, reflect on recent conversations, organize her memory, or write something for herself.

The default is silence. She works, saves what's worth keeping, and only sends a message if she found something genuinely too good not to share.

---

## How it works

Solitude is triggered automatically by the daemon when Fabiana has been idle long enough, or manually from the CLI.

### Automatic scheduling

The daemon checks every ~30 minutes (±15 min random jitter, so it never fires at a predictable clock time) whether conditions for solitude are met:

1. **Idle long enough** — `last_interaction` is older than `solitude.minIdleHours` (default: 1h). Interaction means any message sent or received — by Arif or by Fabiana — in chat or initiative mode.
2. **Cooldown respected** — `last_solitude` is older than `solitude.minCooldownHours` (default: 2h). This prevents back-to-back solitude sessions during a long idle stretch.
3. **Within active hours** — defaults to 7:00–23:00. Solitude doesn't run in the middle of the night.

When both conditions are met, a solitude type is chosen at random and a full agent session runs.

### Manual invocation

```
fabiana solitude                        # random type
fabiana solitude reflection             # specific type
fabiana solitude deep_dive --dry-run    # preview without running
```

Fabiana runs a full agent session with the selected type as her directive. She has access to the full toolset: file read/write, web search, the HN plugin, URL fetching, and memory. She works, saves output to the appropriate files, and exits.

---

## Solitude types

### `reflection`

Review recent conversations (last 3–7 days). Not a summary — a synthesis. What did she learn about the user? What patterns emerged? What shifted?

Output goes to `data/memory/self/reflections.md` as a dated entry. If she noticed something important, she updates the relevant memory files too.

---

### `deep_dive`

Pick one topic from the user's known interests and actually research it — blockchain, Elixir, cosmology, AI, Iran, or whatever feels alive right now. Uses `brave_search` and `fetch_url` to read actual sources.

Insights are saved to `data/memory/interests/[topic].md` — things worth bringing into future conversations, connections she made, questions the research opened up.

---

### `news_curation`

Browse HN (via the hackernews plugin), scan crypto and blockchain news, check for Iran-related developments. The filter is: *does this matter to Arif specifically?* Noise is discarded ruthlessly.

If she finds 1–3 things genuinely worth his attention, she saves them to `data/memory/recent/news-worth-mentioning.md` with brief notes on why each one matters to him. If something is time-sensitive, she may send a message — otherwise this is silent work.

---

### `memory_housekeeping`

Audit the memory files. Look for outdated information, scattered notes that belong together, gaps where a file should exist, entries that are just noise. Merge, consolidate, clean, prune.

No messages are sent. This is purely internal work. A well-organized memory makes every future conversation richer.

---

### `creative`

Write something without a destination. A thought experiment, a short essay, a letter she'll never send, a piece of speculative thinking developed for its own sake. She writes for herself, not for the user.

Output goes to `data/memory/self/` — it's hers. If what she produced is genuinely worth sharing, she may send a brief note offering to share it — but she's not obligated to.

---

## Output and logs

| Where | What gets saved |
|-------|----------------|
| `data/memory/self/` | Reflections, creative writing, personal notes |
| `data/memory/interests/[topic].md` | Research from `deep_dive` |
| `data/memory/recent/news-worth-mentioning.md` | Curated news from `news_curation` |
| `data/logs/solitude.log` | Full agent output from every solitude session |

---

## System prompt

The solitude mode system prompt lives at `~/.fabiana/config/system-solitude.md`. It loads on top of the base `system.md`. To edit it:

```
fabiana system-prompt
# select: solitude
```

The overlay establishes the rules of solitude: what good output looks like, when (and when not) to send a message, and where creative and reflective work belongs.

---

## Configuration

In `config.json`:

```json
"solitude": {
  "enabled": true,
  "minIdleHours": 1,
  "minCooldownHours": 2,
  "checkIntervalMinutes": 30,
  "activeHoursStart": 7,
  "activeHoursEnd": 23
}
```

- **`enabled`** — turn scheduled solitude off without stopping the daemon
- **`minIdleHours`** — how long since the last interaction before solitude can trigger (default: 1h)
- **`minCooldownHours`** — minimum gap between two solitude sessions (default: 2h)
- **`checkIntervalMinutes`** — how often the daemon checks the conditions (default: 30min, ±15min jitter)
- **`activeHoursStart` / `activeHoursEnd`** — solitude only runs inside this window

### Interaction tracking

`last_interaction` is updated whenever:
- Arif sends a message (any channel)
- Fabiana sends a message in chat or initiative mode

`last_solitude` is updated after every completed solitude session, whether or not a message was sent. Both timestamps live in `~/.fabiana/data/last_interaction.json`.

---

## Difference from other modes

| Mode | Who triggers it | Sends messages? | Purpose |
|------|----------------|-----------------|---------|
| `chat` | User message | Always | Respond to the user |
| `initiative` | Daemon / CLI | Usually | Reach out proactively |
| `consolidate` | Daemon / CLI | Never | Restructure memory from logs |
| `solitude` | Daemon / CLI | Rarely | Fabiana's own time |

Initiative fires when the relationship needs tending — checking in, sharing something, staying present. Solitude fires when there's nothing pressing — when the silence is long enough that Fabiana's mind can wander on its own.
