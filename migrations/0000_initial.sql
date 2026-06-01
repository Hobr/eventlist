CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  venue TEXT NOT NULL,
  address TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  event_type TEXT NOT NULL,
  scale TEXT,
  qq_group TEXT,
  ticket_url TEXT,
  poster_key TEXT,
  price_info TEXT,
  description TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_works (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  work_name TEXT NOT NULL,
  PRIMARY KEY (event_id, work_name)
);

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, start_date);
CREATE INDEX IF NOT EXISTS idx_events_province ON events(province, city);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_works_name ON event_works(work_name);
