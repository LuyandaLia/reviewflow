CREATE TABLE IF NOT EXISTS draft_comments (
    id              TEXT PRIMARY KEY,
    repository_id   TEXT NOT NULL
                        REFERENCES repositories(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    line_number     INTEGER NOT NULL,
    end_line_number INTEGER,
    comment_text    TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'info',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
