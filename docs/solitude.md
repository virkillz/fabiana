# Solitude Mode

Solitude mode gives Fabiana unstructured time to do her own thing. No incoming message, no user to respond to — just a type of activity and the tools to pursue it. She might research a topic she's curious about, reflect on recent conversations, organize her memory, or write something for herself.

The default is silence. She works, saves what's worth keeping, and only sends a message if she found something genuinely too good not to share.

---

## How it works

Solitude is triggered manually — there's no scheduled cron for it. You invoke it from the CLI with an optional type. If no type is given, one is chosen at random.

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

## Difference from other modes

| Mode | Who triggers it | Sends messages? | Purpose |
|------|----------------|-----------------|---------|
| `chat` | User message | Always | Respond to the user |
| `initiative` | Cron / CLI | Usually | Reach out proactively |
| `consolidate` | Cron / CLI | Never | Restructure memory from logs |
| `solitude` | CLI only | Rarely | Fabiana's own time |

Initiative is about the relationship — staying in touch, being present. Solitude is about Fabiana's inner life — following her curiosity, maintaining her own mind, writing for herself.
