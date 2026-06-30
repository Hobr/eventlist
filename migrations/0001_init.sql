PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    province TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_types (
    name TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_scales (
    name TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    alias_of_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (alias_of_id) REFERENCES tags(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    scale TEXT NOT NULL,
    city_id INTEGER NOT NULL,
    venue TEXT NOT NULL,
    address TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    cover_url TEXT,
    description TEXT,
    qq_group TEXT,
    ticket_url TEXT,
    source_url TEXT NOT NULL,
    submitter_contact TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'offline')),
    reject_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT,
    CHECK (date(start_date) IS NOT NULL),
    CHECK (date(end_date) IS NOT NULL),
    CHECK (date(end_date) >= date(start_date)),
    FOREIGN KEY (type) REFERENCES event_types(name),
    FOREIGN KEY (scale) REFERENCES event_scales(name),
    FOREIGN KEY (city_id) REFERENCES cities(id)
);

CREATE TABLE IF NOT EXISTS event_tags (
    event_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (event_id, tag_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_status_start ON events(status, start_date);
CREATE INDEX IF NOT EXISTS idx_events_city_end ON events(city_id, end_date);
CREATE INDEX IF NOT EXISTS idx_events_status_city_start ON events(status, city_id, start_date);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_event_tags_tag ON event_tags(tag_id);
