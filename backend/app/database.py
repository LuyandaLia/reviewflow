import os
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
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
        sql2 = (_MIGRATIONS_DIR / "002_draft_comments.sql").read_text()
        await conn.executescript(sql2)
        sql3 = (_MIGRATIONS_DIR / "003_review_sessions.sql").read_text()
        await conn.executescript(sql3)
        await _migrate_add_review_sessions(conn)
        await _migrate_add_publish_status(conn)
        await _migrate_add_origin(conn)


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


async def _migrate_add_publish_status(conn: aiosqlite.Connection) -> None:
    """One-time migration: add status and gitlab tracking fields to draft_comments."""
    async with conn.execute("PRAGMA table_info(draft_comments)") as cursor:
        columns = {row[1] for row in await cursor.fetchall()}
    if "status" not in columns:
        await conn.execute(
            "ALTER TABLE draft_comments ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'"
        )
        await conn.execute("ALTER TABLE draft_comments ADD COLUMN gitlab_note_id TEXT")
        await conn.execute("ALTER TABLE draft_comments ADD COLUMN gitlab_discussion_id TEXT")
        await conn.execute("ALTER TABLE draft_comments ADD COLUMN gitlab_mr_iid INTEGER")
        await conn.commit()
    elif "gitlab_mr_iid" not in columns:
        # Databases that got status/note/discussion before gitlab_mr_iid was added.
        await conn.execute("ALTER TABLE draft_comments ADD COLUMN gitlab_mr_iid INTEGER")
        await conn.commit()


async def _migrate_add_origin(conn: aiosqlite.Connection) -> None:
    """One-time migration: add origin field to draft_comments ('manual' | 'ai')."""
    async with conn.execute("PRAGMA table_info(draft_comments)") as cursor:
        columns = {row[1] for row in await cursor.fetchall()}
    if "origin" in columns:
        return
    await conn.execute(
        "ALTER TABLE draft_comments ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'"
    )
    await conn.commit()


async def _migrate_add_review_sessions(conn: aiosqlite.Connection) -> None:
    """One-time migration: add review_session_id to draft_comments.

    Existing comments are assigned to a 'Default' session per repository.
    """
    async with conn.execute("PRAGMA table_info(draft_comments)") as cursor:
        columns = {row[1] for row in await cursor.fetchall()}
    if "review_session_id" in columns:
        return

    now = datetime.now(timezone.utc).isoformat()

    # Create a Default session for every repository that has existing comments
    async with conn.execute("SELECT DISTINCT repository_id FROM draft_comments") as cursor:
        repo_ids = [row[0] for row in await cursor.fetchall()]

    session_by_repo: dict[str, str] = {}
    for repo_id in repo_ids:
        sid = str(uuid.uuid4())
        session_by_repo[repo_id] = sid
        await conn.execute(
            "INSERT INTO review_sessions (id, repository_id, name, is_active, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (sid, repo_id, "Default", 1, now, now),
        )
    await conn.commit()

    # Add nullable column
    await conn.execute("ALTER TABLE draft_comments ADD COLUMN review_session_id TEXT")

    # Assign existing comments to their default session
    for repo_id, sid in session_by_repo.items():
        await conn.execute(
            "UPDATE draft_comments SET review_session_id = ? WHERE repository_id = ?",
            (sid, repo_id),
        )
    await conn.commit()

    # Recreate table with NOT NULL constraint and correct FK
    await conn.executescript("""
        CREATE TABLE draft_comments_new (
            id                TEXT PRIMARY KEY,
            repository_id     TEXT NOT NULL
                                  REFERENCES repositories(id) ON DELETE CASCADE,
            review_session_id TEXT NOT NULL
                                  REFERENCES review_sessions(id) ON DELETE CASCADE,
            file_path         TEXT NOT NULL,
            line_number       INTEGER NOT NULL,
            end_line_number   INTEGER,
            comment_text      TEXT NOT NULL,
            severity          TEXT NOT NULL DEFAULT 'info',
            created_at        TEXT NOT NULL,
            updated_at        TEXT NOT NULL
        );
        INSERT INTO draft_comments_new
            SELECT id, repository_id, review_session_id, file_path, line_number,
                   end_line_number, comment_text, severity, created_at, updated_at
            FROM draft_comments;
        DROP TABLE draft_comments;
        ALTER TABLE draft_comments_new RENAME TO draft_comments;
    """)
