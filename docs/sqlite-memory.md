# SQLite Memory System

**Date:** 2026-03-17
**Status:** Implementation

---

## Why SQLite?

The current file-based memory system works but has hard limits:

- No way to search across memories without reading every file
- No temporal queries ("what were we discussing last week?")
- No relational queries ("what do I know about Maria, and what events involve her?")
- Mood is a single snapshot, not a history
- Promoting a memory from warm→hot requires manually moving a file

SQLite solves all of these. It's a single file at `~/.fabiana/data/memory.db`, the agent queries it with the `sqlite3` CLI, and a skill teaches her how.

The flat files for `identity.md` and `core.md` stay — they still load directly into the hot prompt. SQLite handles everything else: search, aggregation, people, events, mood history, and conversation indexing.

---

## Schema

The schema lives at `src/db/schema.sql` and is applied automatically on first run.

```sql
-- Core memory atom: a single fact, observation, or note
CREATE TABLE IF NOT EXISTS memories (
  id           INTEGER PRIMARY KEY,
  content      TEXT    NOT NULL,
  tier         TEXT    NOT NULL DEFAULT 'warm', -- 'hot' | 'warm' | 'cold'
  category     TEXT    NOT NULL,               -- 'person' | 'event' | 'interest' | 'fact' | 'mood' | 'news'
  subject      TEXT,                           -- e.g. person name, topic slug
  importance   INTEGER DEFAULT 5,              -- 1–10; drives hot/warm/cold promotion
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  accessed_at  TEXT,
  access_count INTEGER DEFAULT 0,
  expires_at   TEXT,                           -- null = permanent
  session_id   TEXT
);

CREATE TABLE IF NOT EXISTS memory_tags (
  memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (memory_id, tag)
);

-- Structured people (replaces people/*.md files)
CREATE TABLE IF NOT EXISTS people (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  relationship TEXT,        -- 'family' | 'friend' | 'colleague' | 'acquaintance'
  contact      TEXT,        -- JSON: {"telegram": "@x", "email": "x@y"}
  bio          TEXT,        -- free-form markdown notes
  last_contact TEXT         -- ISO datetime
);

-- Structured events and dates (replaces dates/upcoming.md)
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,    -- YYYY-MM-DD
  recurrence TEXT,             -- 'annual' | 'monthly' | null
  person_id  INTEGER REFERENCES people(id),
  notes      TEXT,
  notified   INTEGER DEFAULT 0 -- 1 if Fabiana has proactively mentioned this
);

-- Queryable conversation log (complements the daily .log files)
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  direction  TEXT NOT NULL,    -- 'inbound' | 'outbound'
  mode       TEXT NOT NULL,    -- 'chat' | 'initiative' | 'solitude' | ...
  content    TEXT NOT NULL,
  timestamp  TEXT NOT NULL DEFAULT (datetime('now')),
  sentiment  TEXT,             -- 'positive' | 'neutral' | 'negative' (agent-assessed)
  topics     TEXT              -- JSON array of tags, e.g. '["travel","career"]'
);

-- Mood history (replaces mood.md snapshot with queryable time series)
CREATE TABLE IF NOT EXISTS moods (
  id          INTEGER PRIMARY KEY,
  value       TEXT NOT NULL,   -- 'curious' | 'reflective' | 'restless' | ...
  intensity   INTEGER,         -- 1–10
  note        TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  session_id  TEXT
);

-- Full-text search across all memories
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content, subject,
  content='memories',
  content_rowid='id'
);

-- Keep FTS in sync automatically
CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, content, subject) VALUES (new.id, new.content, new.subject);
END;
CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, subject) VALUES ('delete', old.id, old.content, old.subject);
  INSERT INTO memories_fts(rowid, content, subject) VALUES (new.id, new.content, new.subject);
END;
CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, subject) VALUES ('delete', old.id, old.content, old.subject);
END;
```

---

## How Fabiana Knows How to Use It

A skill at `~/.fabiana/skills/memory-db/SKILL.md` teaches her. At session start she sees the skill name and one-line description in her system prompt. When she judges a query needs the DB, she reads SKILL.md herself, then issues `sqlite3` commands.

The SKILL.md includes:
- **The schema** — compact `CREATE TABLE` DDL (no triggers) so she knows every column name
- **Example queries** — copy-paste patterns for the most common operations

This means Fabiana never has to guess column names or invent table structures.

The bundled skill lives at `src/skills/memory-db/SKILL.md` and is copied to `~/.fabiana/skills/` during `fabiana init`.

---

## Solitude and the DB

Solitude sessions produce two kinds of output:

| Output | Where it goes |
|--------|--------------|
| Long-form prose (diary entries, reflections, creative writing) | Files in `data/memory/self/` — markdown stays best for this |
| Structured insights (people, events, facts, news items, mood) | SQLite via the memory-db skill |

The system prompt for solitude mode explicitly directs this split: use `memory-db` for structured data, use `data/memory/self/` for prose. The `messages` table already captures solitude session messages with `mode='solitude'`.

---

## How the Content Is Updated

Three mechanisms, each serving a different time horizon:

### 1. Agent writes during sessions (real-time)

Fabiana writes to the DB herself during any session via the memory-db skill. Examples:

- User mentions their sister's birthday → INSERT into `events`
- Interesting fact comes up about a topic → INSERT into `memories` with `category='interest'`
- Mood at session end → INSERT into `moods`
- New person introduced → INSERT into `people`
- News item found during solitude → INSERT into `memories` with `category='news'`

This is the primary write path.

### 2. Consolidation mode (nightly, structured extraction)

The nightly consolidation run gains a new responsibility: reading the day's conversation logs and promoting noteworthy content into `memories`.

Concretely, consolidation:
- Reads `messages` from the past day
- Identifies recurring topics and writes/updates `memories` rows
- Extracts people mentions and upserts `people` rows
- Archives low-importance cold memories older than 90 days (sets `expires_at`)

### 3. Migration (one-time)

A migration script converts existing `.md` files into DB rows on first run:

| Source file | Target table | Category |
|-------------|--------------|----------|
| `memory/people/*.md` | `people` (bio col) + `memories` | `person` |
| `memory/dates/upcoming.md` | `events` | — |
| `memory/interests/topics.md` | `memories` | `interest` |
| `memory/recent/this-week.md` | `memories` | `fact` (bulk import) |

The flat files are kept as-is post-migration; the DB becomes the canonical source going forward.

---

## What This Does Not Change

- `identity.md` and `core.md` still load as text into every session prompt (hot tier stays file-based — they're small and always needed)
- `data/memory/self/` — diary, creative writing, reflections — stays file-based (long-form prose doesn't belong in a DB)
- Daily `.log` files still exist for full conversation replay
- The `manifest.json` permission system still controls file access for `safe_read`/`safe_write`
- No existing tools change — the skill uses bash + sqlite3, no new ToolDefinition needed

---

## System Prompt Changes

The Write Protocol in `system.md` (and `src/prompts/system.ts`) changes from file-only to a two-path protocol:

**SQLite via memory-db skill** — for structured, searchable data:
- People → `people` table
- Events/dates → `events` table
- Discrete facts, interests, news → `memories` table
- Mood → `moods` table

**Files** — for hot-tier identity and long-form prose:
- `identity.md` / `core.md` — always loaded, keep current
- `data/memory/self/` — diary, reflections, creative writing

The solitude system prompt (`system-solitude.md`) is updated to reflect the same split.

---

## Deployment

### Ubuntu (and Linux generally)

`sqlite3` CLI is not pre-installed on all distros but is one line to add:

```bash
sudo apt install sqlite3
```

This is a runtime dependency, not a build dependency. It needs to be on `PATH`.

### macOS

`sqlite3` is pre-installed. No action needed.

### Making it part of `npm install -g fabiana`

npm can't install system packages, but `fabiana` handles the rest:

1. **Schema file** bundled at `src/db/schema.sql`
2. **DB initialization** runs automatically on first startup (or via `fabiana init`)
3. **`sqlite3` binary check** on startup: if missing, warn with the install command

```typescript
// src/db/init.ts
export function initDb() {
  // 1. Check sqlite3 is available — warn + return if missing
  // 2. If memory.db doesn't exist, apply schema.sql
}
```

Called before `program.parse()` in `src/cli.ts`.

**Summary of what `npm install -g fabiana` gives you:**
- Schema bundled in the package
- Auto-init on first run
- The memory-db skill bundled at `src/skills/memory-db/SKILL.md`, copied to `~/.fabiana/skills/` on `fabiana init`

---

## Implementation Order

1. ✅ **Schema file** — `src/db/schema.sql`
2. ✅ **Init module** — `src/db/init.ts` with sqlite3 check + schema apply
3. ✅ **Startup hook** — call `initDb()` in `src/cli.ts` before sessions begin
4. ✅ **Bundled skill** — `src/skills/memory-db/SKILL.md` (with schema + example queries)
5. ✅ **`fabiana init` command** — copies skill to `~/.fabiana/skills/`, runs `initDb()`
6. ✅ **System prompt update** — SQLite-first write protocol in `src/prompts/system.ts` + live `system.md`
7. ✅ **Solitude prompt update** — `src/prompts/system-solitude.ts` reflects prose/structured split
8. ✅ **Migration script** — `src/db/migrate-from-files.ts` (run once manually: `fabiana db migrate`)
9. ✅ **Consolidation update** — extend nightly consolidation to write structured rows
