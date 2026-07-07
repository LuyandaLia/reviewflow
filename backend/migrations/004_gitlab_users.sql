CREATE TABLE IF NOT EXISTS gitlab_users (
    gitlab_instance_id TEXT PRIMARY KEY
        REFERENCES gitlab_instances(id) ON DELETE CASCADE,
    gitlab_user_id     INTEGER NOT NULL,
    username           TEXT NOT NULL,
    display_name       TEXT NOT NULL,
    avatar_url         TEXT,
    last_verified      TEXT NOT NULL
);
