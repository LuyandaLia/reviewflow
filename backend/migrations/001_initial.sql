CREATE TABLE IF NOT EXISTS gitlab_instances (
    id             TEXT PRIMARY KEY,
    display_name   TEXT NOT NULL,
    base_url       TEXT NOT NULL UNIQUE,
    api_path       TEXT NOT NULL DEFAULT '/api/v4',
    ca_bundle_path TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
    id                  TEXT PRIMARY KEY,
    local_path          TEXT NOT NULL UNIQUE,
    gitlab_instance_id  TEXT NOT NULL
                            REFERENCES gitlab_instances(id) ON DELETE RESTRICT,
    gitlab_project_path TEXT NOT NULL,
    display_name        TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    UNIQUE (gitlab_instance_id, gitlab_project_path)
);
