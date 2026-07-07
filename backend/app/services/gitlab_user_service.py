from datetime import datetime, timezone

import aiosqlite

from app.models.gitlab_user import GitLabUser, UpsertGitLabUserRequest


class GitLabUserService:
    def __init__(self, db: aiosqlite.Connection) -> None:
        self._db = db

    async def get(self, instance_id: str) -> GitLabUser | None:
        async with self._db.execute(
            "SELECT * FROM gitlab_users WHERE gitlab_instance_id = ?",
            (instance_id,),
        ) as cursor:
            row = await cursor.fetchone()
        return _row_to_user(row) if row else None

    async def upsert(self, instance_id: str, req: UpsertGitLabUserRequest) -> GitLabUser:
        now = datetime.now(timezone.utc)
        await self._db.execute(
            """
            INSERT INTO gitlab_users
                (gitlab_instance_id, gitlab_user_id, username, display_name, email, avatar_url, last_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(gitlab_instance_id) DO UPDATE SET
                gitlab_user_id = excluded.gitlab_user_id,
                username       = excluded.username,
                display_name   = excluded.display_name,
                email          = excluded.email,
                avatar_url     = excluded.avatar_url,
                last_verified  = excluded.last_verified
            """,
            (
                instance_id,
                req.gitlab_user_id,
                req.username,
                req.display_name,
                req.email,
                req.avatar_url,
                now.isoformat(),
            ),
        )
        await self._db.commit()
        return GitLabUser(
            gitlab_instance_id=instance_id,
            gitlab_user_id=req.gitlab_user_id,
            username=req.username,
            display_name=req.display_name,
            email=req.email,
            avatar_url=req.avatar_url,
            last_verified=now,
        )

    async def delete(self, instance_id: str) -> None:
        await self._db.execute(
            "DELETE FROM gitlab_users WHERE gitlab_instance_id = ?",
            (instance_id,),
        )
        await self._db.commit()


def _row_to_user(row: aiosqlite.Row) -> GitLabUser:
    return GitLabUser(
        gitlab_instance_id=row["gitlab_instance_id"],
        gitlab_user_id=row["gitlab_user_id"],
        username=row["username"],
        display_name=row["display_name"],
        email=row["email"],
        avatar_url=row["avatar_url"],
        last_verified=datetime.fromisoformat(row["last_verified"]),
    )
