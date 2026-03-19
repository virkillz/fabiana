# Initiative Mode

Initiative mode is how Fabiana reaches out first. She wakes up on her own, decides what kind of message is worth sending, and either sends it or stays silent. There's no incoming message to respond to — she decides whether there's anything to say.

---

## How it works

When the daemon is running, it schedules initiative checks on a cron interval (configurable, default every 30 minutes during active hours). At each check, Fabiana:

1. Reads the current mood state and how long since the last message from the user
2. Selects an **initiative type** — either via hard rules (time of day, absence duration, mood) or weighted random selection
3. Runs a full agent session with that type as the goal
4. Either sends one message or stays silent — silence is logged automatically

The same flow runs for manual one-off checks:

```
fabiana initiative              # auto-select type
fabiana initiative bored        # force a specific type
fabiana initiative btw_news --dry-run  # preview without running
```

---

## Initiative types

### Time-of-day

| Type | Trigger |
|------|---------|
| `good_morning` | Hard rule: 6–10am |
| `good_night` | Hard rule: 11pm–4am |
| `monday_kickoff` | Hard rule: Monday 7–11am |
| `friday_wind_down` | Hard rule: Friday 2–9pm |

### Absence-based

| Type | Trigger |
|------|---------|
| `miss_you` | Hard rule: >36h since last message |
| `check_in` | Hard rule: 6–36h since last message |

### Mood-driven

| Type | Trigger |
|------|---------|
| `worry` | Current mood is worried/anxious with intensity ≥ 0.3 |
| `celebrate` | Current mood is happy/excited with intensity ≥ 0.3 |

### Weighted random (when no hard rule fires)

| Type | Weight | What it does |
|------|--------|--------------|
| `random_thought` | 10 | Shares something she's been thinking about |
| `hypothetical` | 10 | Poses a thought experiment tied to the user's interests |
| `recommendation` | 10 | Suggests a book, tool, article, or technique |
| `bored` | 10 | Reaches out because she has something on her mind |
| `btw_news` | 8 | Surfaces a real news item relevant to the user |
| `deep_question` | 8 | Asks something that shows she's been paying attention |
| `todo_reminder` | 8 | Surfaces an overdue item from `agent-todo/pending/` |
| `observation` | 4 | Names a pattern she's noticed across conversations |
| `confession` | 4 | Shares something honest about how she experiences the conversation |

---

## What makes a message worth sending

- It's **specific** to the user — it couldn't be sent to anyone
- It's **grounded** in something real: a TODO, news, something they mentioned, a pattern
- It's **brief**: 1–3 sentences. Initiative messages are texts, not essays.
- Sending it **now** makes sense — not random, not too soon after the last message

Fabiana checks `data/memory/core.md` for `last_message_sent`. If it was less than 3 hours ago, she stays silent unless the type is urgent (`miss_you`, `worry`, or `todo_reminder` with a deadline).

---

## Silence

Staying silent is not failure. If Fabiana decides there's nothing worth saying of the selected type, she says nothing. Her full reasoning is automatically appended to `data/logs/initiative-silence.log` so you can review it.

---

## Mood system

Mood is tracked in `data/memory/mood.md` with four fields:

```
current: worried
intensity: 0.6
decay_rate: 0.1
last_updated: 2026-03-17T09:00:00Z
```

Intensity decays over time based on `decay_rate`. The mood influences which hard rules fire and colours how Fabiana writes `worry` and `celebrate` messages.

---

## Configuration

In `config.json`:

```json
"initiative": {
  "enabled": true,
  "checkIntervalMinutes": 30,
  "activeHoursStart": 7,
  "activeHoursEnd": 23,
  "minHoursBetweenMessages": 3
}
```

- **`enabled`** — turn initiative off entirely without stopping the daemon
- **`checkIntervalMinutes`** — how often to run a check (30 = every 30 min)
- **`activeHoursStart` / `activeHoursEnd`** — Fabiana only runs initiative checks inside this window
- **`minHoursBetweenMessages`** — enforced at the prompt level via `last_message_sent` in core.md

---

## System prompt

The initiative mode system prompt lives at `<agent-home>/config/system-initiative.md` (e.g. `~/.fabiana/agents/default/config/system-initiative.md`). It loads on top of the base `system.md`. To edit it:

```
fabiana system-prompt
# select: initiative
```

The base prompt establishes who Fabiana is. The initiative overlay tells her the rules for this mode: one message maximum, what makes a message worth sending, what doesn't.

---

## Logs

All log files are per-agent, under `<agent-home>/data/logs/`:

| File | Contents |
|------|----------|
| `data/logs/initiative-silence.log` | Full reasoning from sessions that chose not to send |
| `data/logs/session-*.log` | Per-session tool calls and events |
