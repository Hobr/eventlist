CREATE TABLE IF NOT EXISTS event_scales (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vocabulary_terms (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('event_type', 'event_ip')),
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kind, slug)
);

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    venue TEXT NOT NULL,
    address TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    type_id TEXT,
    event_ip_id TEXT,
    scale_id TEXT,
    raw_type_text TEXT,
    raw_event_ip_text TEXT,
    official_qq_group TEXT,
    ticket_url TEXT,
    description TEXT,
    internal_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES vocabulary_terms(id),
    FOREIGN KEY (event_ip_id) REFERENCES vocabulary_terms(id),
    FOREIGN KEY (scale_id) REFERENCES event_scales(id)
);

CREATE TABLE IF NOT EXISTS event_submissions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    submitter_contact TEXT,
    submitter_ip_hash TEXT NOT NULL,
    turnstile_outcome TEXT NOT NULL DEFAULT 'passed',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_covers (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    object_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
    public_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS event_view_observations (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    observed_on TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE (event_id, visitor_hash, observed_on)
);

CREATE INDEX IF NOT EXISTS idx_events_public_list
    ON events(status, ends_at, city, type_id, event_ip_id, scale_id);
CREATE INDEX IF NOT EXISTS idx_events_slug_status ON events(slug, status);
CREATE INDEX IF NOT EXISTS idx_events_scale_start ON events(scale_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_vocab_kind_active_sort ON vocabulary_terms(kind, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_scales_active_priority ON event_scales(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_covers_event_status ON event_covers(event_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_event ON event_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_view_observations_window ON event_view_observations(observed_on, event_id);

