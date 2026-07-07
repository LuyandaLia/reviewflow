import uuid
from datetime import datetime, timezone

import aiosqlite

from app.exceptions import (
    DuplicateInstanceUrlError,
    InstanceHasRepositoriesError,
    InstanceNotFoundError,
)
from app.models.gitlab_instance import CreateGitLabInstanceRequest, GitLabInstance


class GitLabInstanceService:
    def __init__(self, db: aiosqlite.Connection) -> None:
        self._db = db

    async def create(self, req: CreateGitLabInstanceRequest) -> GitLabInstance:
        now = datetime.now(timezone.utc)
        instance = GitLabInstance(
            id=str(uuid.uuid4()),
            display_name=req.display_name,
            base_url=req.base_url.rstrip("/"),
            api_path=req.api_path,
            ca_bundle_path=req.ca_bundle_path,
            created_at=now,
            updated_at=now,
        )
        try:
            await self._db.execute(
                """
                INSERT INTO gitlab_instances
                    (id, display_name, base_url, api_path, ca_bundle_path, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    instance.id,
                    instance.display_name,
                    instance.base_url,
                    instance.api_path,
                    instance.ca_bundle_path,
                    instance.created_at.isoformat(),
                    instance.updated_at.isoformat(),
                ),
            )
            await self._db.commit()
        except aiosqlite.IntegrityError:
            raise DuplicateInstanceUrlError()
        return instance

    async def list_all(self) -> list[GitLabInstance]:
        async with self._db.execute(
            "SELECT * FROM gitlab_instances ORDER BY display_name"
        ) as cursor:
            rows = await cursor.fetchall()
        return [_row_to_instance(row) for row in rows]

    async def get(self, instance_id: str) -> GitLabInstance:
        async with self._db.execute(
            "SELECT * FROM gitlab_instances WHERE id = ?", (instance_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise InstanceNotFoundError()
        return _row_to_instance(row)

    async def delete(self, instance_id: str) -> None:
        await self.get(instance_id)

        async with self._db.execute(
            "SELECT COUNT(*) FROM repositories WHERE gitlab_instance_id = ?",
            (instance_id,),
        ) as cursor:
            row = await cursor.fetchone()
        count: int = row[0]
        if count > 0:
            raise InstanceHasRepositoriesError(count)

        await self._db.execute(
            "DELETE FROM gitlab_instances WHERE id = ?", (instance_id,)
        )
        await self._db.commit()


def _row_to_instance(row: aiosqlite.Row) -> GitLabInstance:
    return GitLabInstance(
        id=row["id"],
        display_name=row["display_name"],
        base_url=row["base_url"],
        api_path=row["api_path"],
        ca_bundle_path=row["ca_bundle_path"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )
