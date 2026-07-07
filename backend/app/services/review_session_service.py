import uuid
from datetime import datetime, timezone

import aiosqlite

from app.exceptions import (
    DuplicateSessionNameError,
    RepositoryNotFoundError,
    ReviewSessionNotFoundError,
)
from app.models.review_session import ReviewSession


class ReviewSessionService:
    def __init__(self, db: aiosqlite.Connection) -> None:
        self._db = db

    async def create(self, repository_id: str, name: str) -> ReviewSession:
        async with self._db.execute(
            "SELECT id FROM repositories WHERE id = ?", (repository_id,)
        ) as cursor:
            if await cursor.fetchone() is None:
                raise RepositoryNotFoundError()

        now = datetime.now(timezone.utc)
        session = ReviewSession(
            id=str(uuid.uuid4()),
            repository_id=repository_id,
            name=name,
            is_active=False,
            created_at=now,
            updated_at=now,
        )

        # Count existing sessions: if first, make active automatically
        async with self._db.execute(
            "SELECT COUNT(*) FROM review_sessions WHERE repository_id = ?", (repository_id,)
        ) as cursor:
            count = (await cursor.fetchone())[0]
        if count == 0:
            session.is_active = True

        try:
            await self._db.execute(
                """
                INSERT INTO review_sessions (id, repository_id, name, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session.id,
                    session.repository_id,
                    session.name,
                    int(session.is_active),
                    session.created_at.isoformat(),
                    session.updated_at.isoformat(),
                ),
            )
            await self._db.commit()
        except aiosqlite.IntegrityError:
            raise DuplicateSessionNameError()

        return session

    async def list_by_repository(self, repository_id: str) -> list[ReviewSession]:
        async with self._db.execute(
            "SELECT * FROM review_sessions WHERE repository_id = ? ORDER BY created_at",
            (repository_id,),
        ) as cursor:
            rows = await cursor.fetchall()
        return [_row_to_session(row) for row in rows]

    async def get(self, session_id: str) -> ReviewSession:
        async with self._db.execute(
            "SELECT * FROM review_sessions WHERE id = ?", (session_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise ReviewSessionNotFoundError()
        return _row_to_session(row)

    async def rename(self, session_id: str, name: str) -> ReviewSession:
        session = await self.get(session_id)
        now = datetime.now(timezone.utc)
        try:
            await self._db.execute(
                "UPDATE review_sessions SET name = ?, updated_at = ? WHERE id = ?",
                (name, now.isoformat(), session_id),
            )
            await self._db.commit()
        except aiosqlite.IntegrityError:
            raise DuplicateSessionNameError()
        session.name = name
        session.updated_at = now
        return session

    async def activate(self, session_id: str) -> ReviewSession:
        session = await self.get(session_id)
        now = datetime.now(timezone.utc)
        await self._db.execute(
            "UPDATE review_sessions SET is_active = 0, updated_at = ? WHERE repository_id = ?",
            (now.isoformat(), session.repository_id),
        )
        await self._db.execute(
            "UPDATE review_sessions SET is_active = 1, updated_at = ? WHERE id = ?",
            (now.isoformat(), session_id),
        )
        await self._db.commit()
        session.is_active = True
        session.updated_at = now
        return session

    async def delete(self, session_id: str) -> None:
        await self.get(session_id)
        await self._db.execute("DELETE FROM review_sessions WHERE id = ?", (session_id,))
        await self._db.commit()


def _row_to_session(row: aiosqlite.Row) -> ReviewSession:
    return ReviewSession(
        id=row["id"],
        repository_id=row["repository_id"],
        name=row["name"],
        is_active=bool(row["is_active"]),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )
