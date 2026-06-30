CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL CHECK (
        action IN ('approve', 'reject', 'edit', 'offline', 'republish', 'merge')
    ),
    target_id INTEGER,
    meta TEXT NOT NULL DEFAULT '{}',
    at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON audit_logs(at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
