import os
from collections.abc import AsyncGenerator
from pathlib import Path

import aiosqlite

DB_DIR = Path(os.environ.get("REVIEWFLOW_DATA_DIR", str(Path.home() / ".reviewflow")))
DB_PATH = DB_DIR / "reviewflow.db"
_MIGRATIONS_DIR = Path(__file__).parent.parent / "migrations"


async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys = ON")
        await conn.execute("PRAGMA journal_mode = WAL")
        yield conn


async def init_db() -> None:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        await conn.execute("PRAGMA foreign_keys = ON")
        await conn.execute("PRAGMA journal_mode = WAL")
        sql = (_MIGRATIONS_DIR / "001_initial.sql").read_text()
        await conn.executescript(sql)
        await _migrate_remove_project_id(conn)


async def _migrate_remove_project_id(conn: aiosqlite.Connection) -> None:
    """One-time migration: drop gitlab_project_id from repositories if it exists."""
    async with conn.execute("PRAGMA table_info(repositories)") as cursor:
        columns = {row[1] for row in await cursor.fetchall()}
    if "gitlab_project_id" not in columns:
        return
    await conn.executescript("""
        CREATE TABLE repositories_new (
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
        INSERT INTO repositories_new
            (id, local_path, gitlab_instance_id, gitlab_project_path,
             display_name, created_at, updated_at)
        SELECT id, local_path, gitlab_instance_id, gitlab_project_path,
               display_name, created_at, updated_at
        FROM repositories;
        DROP TABLE repositories;
        ALTER TABLE repositories_new RENAME TO repositories;
    """)
