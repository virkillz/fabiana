---
name: memory-db
description: Query and write structured SQLite memory at ~/.fabiana/data/memory.db. Use for searching memories, looking up people, querying upcoming events, logging mood, and storing structured insights. Prefer this over reading individual markdown files when you need to search or aggregate.
---

# Memory Database

**DB path:** `~/.fabiana/data/memory.db`

---

## Schema

```sql
CREATE TABLE memories (
  id           INTEGER PRIMARY KEY,
  content      TEXT    NOT NULL,
  tier         TEXT    NOT NULL DEFAULT 'warm', -- 'hot' | 'warm' | 'cold'
  category     TEXT    NOT NULL,               -- 'person' | 'event' | 'interest' | 'fact' | 'mood' | 'news'
  subject      TEXT,
  importance   INTEGER DEFAULT 5,              -- 1–10
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  accessed_at  TEXT,
  access_count INTEGER DEFAULT 0,
  expires_at   TEXT,
  session_id   TEXT
);

CREATE TABLE memory_tags (
  memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (memory_id, tag)
);

CREATE TABLE people (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  relationship TEXT,   -- 'family' | 'friend' | 'colleague' | 'acquaintance'
  contact      TEXT,   -- JSON: {"telegram": "@x", "email": "x@y"}
  bio          TEXT,   -- free-form markdown notes
  last_contact TEXT    -- ISO datetime
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,    -- YYYY-MM-DD
  recurrence TEXT,             -- 'annual' | 'monthly' | null
  person_id  INTEGER REFERENCES people(id),
  notes      TEXT,
  notified   INTEGER DEFAULT 0
);

CREATE TABLE messages (
  id         INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  direction  TEXT NOT NULL,   -- 'inbound' | 'outbound'
  mode       TEXT NOT NULL,   -- 'chat' | 'initiative' | 'solitude' | 'consolidate'
  content    TEXT NOT NULL,
  timestamp  TEXT NOT NULL DEFAULT (datetime('now')),
  sentiment  TEXT,            -- 'positive' | 'neutral' | 'negative'
  topics     TEXT             -- JSON array, e.g. '["travel","career"]'
);

CREATE TABLE moods (
  id          INTEGER PRIMARY KEY,
  value       TEXT NOT NULL,  -- 'curious' | 'reflective' | 'restless' | ...
  intensity   INTEGER,        -- 1–10
  note        TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  session_id  TEXT
);

-- Full-text search virtual table over memories
CREATE VIRTUAL TABLE memories_fts USING fts5(content, subject, content='memories', content_rowid='id');
```

---

## Queries

### Full-text search across all memories
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "SELECT content, subject, category FROM memories_fts WHERE memories_fts MATCH 'keyword' LIMIT 10"
```

### Look up everything about a person
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "SELECT p.name, p.relationship, p.bio, m.content
   FROM people p
   LEFT JOIN memories m ON m.subject = p.name
   WHERE p.name LIKE '%Maria%'"
```

### Upcoming events (next 14 days)
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "SELECT title, date, notes FROM events
   WHERE date BETWEEN date('now') AND date('now', '+14 days')
   ORDER BY date"
```

### Annual recurring events coming up this month
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "SELECT title, date FROM events
   WHERE recurrence = 'annual'
   AND strftime('%m-%d', date) BETWEEN strftime('%m-%d', date('now'))
                                   AND strftime('%m-%d', date('now', '+30 days'))"
```

### Write a new memory
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "INSERT INTO memories (content, category, subject, importance)
   VALUES ('she mentioned she is training for a marathon', 'person', 'Maria', 7)"
```

### Upsert a person
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "INSERT INTO people (name, relationship, bio) VALUES ('Maria', 'friend', 'Training for a marathon')
   ON CONFLICT(name) DO UPDATE SET bio = excluded.bio, last_contact = datetime('now')"
```

### Add or update an event
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "INSERT INTO events (title, date, recurrence, notes)
   VALUES ('Maria birthday', '1990-06-15', 'annual', 'Likes plants and coffee')"
```

### Log mood
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "INSERT INTO moods (value, intensity, note) VALUES ('curious', 7, 'got pulled into a rabbit hole about cosmology')"
```

### Recent mood trend
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "SELECT value, intensity, recorded_at FROM moods ORDER BY recorded_at DESC LIMIT 20"
```

### What topics came up last week?
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "SELECT topics, content FROM messages
   WHERE timestamp > datetime('now', '-7 days') AND topics IS NOT NULL"
```

### Promote a memory to hot tier
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "UPDATE memories SET tier = 'hot' WHERE id = 42"
```

### Recent memories by category
```bash
sqlite3 ~/.fabiana/data/memory.db \
  "SELECT content, subject, importance, created_at FROM memories
   WHERE category = 'interest'
   ORDER BY created_at DESC LIMIT 20"
```
