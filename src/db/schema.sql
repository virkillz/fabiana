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
  mode       TEXT NOT NULL,    -- 'chat' | 'initiative' | 'solitude' | 'consolidate'
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
