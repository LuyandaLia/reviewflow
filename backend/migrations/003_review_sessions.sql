CREATE TABLE IF NOT EXISTS review_sessions (
    id            TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL
                      REFERENCES repositories(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    is_active     INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    UNIQUE (repository_id, name)
);
