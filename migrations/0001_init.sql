PRAGMA foreign_keys = ON;

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (
        length(name) BETWEEN 1 AND 24
        AND name = trim(name)
    ),
    alias_of_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (alias_of_id IS NULL OR alias_of_id <> id),
    FOREIGN KEY (alias_of_id) REFERENCES tags(id) ON DELETE SET NULL
) STRICT;

CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (
        type IN ('comic', 'doujin', 'concert', 'stage', 'dance', 'ipflash', 'online', 'other')
    ),
    scale TEXT NOT NULL CHECK (
        scale IN ('small', 'mid', 'large', 'mega')
    ),
    division_code TEXT NOT NULL CHECK (
        division_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'
        OR division_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
    ),
    venue TEXT NOT NULL,
    address TEXT,
    start_date TEXT NOT NULL CHECK (
        date(start_date) IS NOT NULL
        AND start_date = date(start_date)
    ),
    end_date TEXT NOT NULL CHECK (
        date(end_date) IS NOT NULL
        AND end_date = date(end_date)
    ),
    start_time TEXT CHECK (
        start_time IS NULL OR (
            length(start_time) = 5
            AND start_time GLOB '[0-2][0-9]:[0-5][0-9]'
            AND CAST(substr(start_time, 1, 2) AS INTEGER) BETWEEN 0 AND 23
        )
    ),
    end_time TEXT CHECK (
        end_time IS NULL OR (
            length(end_time) = 5
            AND end_time GLOB '[0-2][0-9]:[0-5][0-9]'
            AND CAST(substr(end_time, 1, 2) AS INTEGER) BETWEEN 0 AND 23
        )
    ),
    cover_url TEXT,
    description TEXT,
    qq_group TEXT,
    ticket_url TEXT,
    source_url TEXT NOT NULL,
    submitter_contact TEXT NOT NULL,
    tag_suggestions TEXT CHECK (
        tag_suggestions IS NULL OR length(tag_suggestions) <= 240
    ),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'published', 'rejected', 'offline')
    ),
    reject_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT CHECK (
        published_at IS NULL OR datetime(published_at) IS NOT NULL
    ),
    CHECK (date(end_date) >= date(start_date)),
    CHECK (
        start_date <> end_date
        OR start_time IS NULL
        OR end_time IS NULL
        OR end_time >= start_time
    )
) STRICT;

CREATE TABLE event_tags (
    event_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (event_id, tag_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL CHECK (
        action IN ('approve', 'reject', 'edit', 'offline', 'republish', 'merge')
    ),
    target_id INTEGER,
    meta TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(meta)),
    at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE INDEX idx_events_public_start
    ON events(status, end_date, start_date, id);
CREATE INDEX idx_events_public_division
    ON events(status, division_code, end_date, start_date, id);
CREATE INDEX idx_events_status_created
    ON events(status, created_at, id);
CREATE INDEX idx_events_status_updated
    ON events(status, updated_at, id);
CREATE INDEX idx_event_tags_tag_event
    ON event_tags(tag_id, event_id);
CREATE INDEX idx_audit_logs_at
    ON audit_logs(at);
CREATE INDEX idx_audit_logs_action_at
    ON audit_logs(action, at);
