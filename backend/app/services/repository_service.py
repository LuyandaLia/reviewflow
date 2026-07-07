import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite

from app.exceptions import (
    DuplicateLocalPathError,
    DuplicateProjectError,
    InstanceNotFoundError,
    PathNotADirectoryError,
    PathNotFoundError,
    RepositoryNotFoundError,
)
from app.models.repository import CreateRepositoryRequest, Repository


class RepositoryService:
    def __init__(self, db: aiosqlite.Connection) -> None:
        self._db = db

    async def create(self, req: CreateRepositoryRequest) -> Repository:
        resolved = os.path.realpath(req.local_path)
        p = Path(resolved)
        if not p.exists():
            raise PathNotFoundError(req.local_path)
        if not p.is_dir():
            raise PathNotADirectoryError(req.local_path)

        async with self._db.execute(
            "SELECT id FROM gitlab_instances WHERE id = ?", (req.gitlab_instance_id,)
        ) as cursor:
            if await cursor.fetchone() is None:
                raise InstanceNotFoundError()

        now = datetime.now(timezone.utc)
        repo = Repository(
            id=str(uuid.uuid4()),
            local_path=resolved,
            gitlab_instance_id=req.gitlab_instance_id,
            gitlab_project_path=req.gitlab_project_path,
            display_name=req.display_name,
            created_at=now,
            updated_at=now,
        )
        try:
            await self._db.execute(
                """
                INSERT INTO repositories
                    (id, local_path, gitlab_instance_id, gitlab_project_path,
                     display_name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    repo.id,
                    repo.local_path,
                    repo.gitlab_instance_id,
                    repo.gitlab_project_path,
                    repo.display_name,
                    repo.created_at.isoformat(),
                    repo.updated_at.isoformat(),
                ),
            )
            await self._db.commit()
        except aiosqlite.IntegrityError as exc:
            if "repositories.local_path" in str(exc):
                raise DuplicateLocalPathError()
            raise DuplicateProjectError()
        return repo

    async def list_all(self) -> list[Repository]:
        async with self._db.execute(
            "SELECT * FROM repositories ORDER BY display_name"
        ) as cursor:
            rows = await cursor.fetchall()
        return [_row_to_repo(row) for row in rows]

    async def get(self, repo_id: str) -> Repository:
        async with self._db.execute(
            "SELECT * FROM repositories WHERE id = ?", (repo_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise RepositoryNotFoundError()
        return _row_to_repo(row)

    async def delete(self, repo_id: str) -> None:
        await self.get(repo_id)
        await self._db.execute("DELETE FROM repositories WHERE id = ?", (repo_id,))
        await self._db.commit()


def _row_to_repo(row: aiosqlite.Row) -> Repository:
    return Repository(
        id=row["id"],
        local_path=row["local_path"],
        gitlab_instance_id=row["gitlab_instance_id"],
        gitlab_project_path=row["gitlab_project_path"],
        display_name=row["display_name"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )
