import uuid
from datetime import datetime, timezone

import aiosqlite

from app.exceptions import DraftCommentNotFoundError, ReviewSessionNotFoundError
from app.models.draft_comment import (
    CreateDraftCommentRequest,
    DraftComment,
    UpdateDraftCommentRequest,
    UpdatePublishStatusRequest,
)


class DraftCommentService:
    def __init__(self, db: aiosqlite.Connection) -> None:
        self._db = db

    async def create(self, req: CreateDraftCommentRequest) -> DraftComment:
        async with self._db.execute(
            "SELECT repository_id FROM review_sessions WHERE id = ?",
            (req.review_session_id,),
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise ReviewSessionNotFoundError()

        repository_id = row[0]
        now = datetime.now(timezone.utc)
        comment = DraftComment(
            id=str(uuid.uuid4()),
            repository_id=repository_id,
            review_session_id=req.review_session_id,
            file_path=req.file_path,
            line_number=req.line_number,
            end_line_number=req.end_line_number,
            comment_text=req.comment_text,
            severity=req.severity,
            status="draft",
            origin=req.origin,
            gitlab_note_id=None,
            gitlab_discussion_id=None,
            gitlab_mr_iid=None,
            created_at=now,
            updated_at=now,
        )
        await self._db.execute(
            """
            INSERT INTO draft_comments
                (id, repository_id, review_session_id, file_path, line_number,
                 end_line_number, comment_text, severity, status, origin,
                 gitlab_note_id, gitlab_discussion_id, gitlab_mr_iid,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                comment.id,
                comment.repository_id,
                comment.review_session_id,
                comment.file_path,
                comment.line_number,
                comment.end_line_number,
                comment.comment_text,
                comment.severity,
                comment.status,
                comment.origin,
                comment.gitlab_note_id,
                comment.gitlab_discussion_id,
                comment.gitlab_mr_iid,
                comment.created_at.isoformat(),
                comment.updated_at.isoformat(),
            ),
        )
        await self._db.commit()
        return comment

    async def list_by_repository(self, repository_id: str) -> list[DraftComment]:
        async with self._db.execute(
            "SELECT * FROM draft_comments WHERE repository_id = ? ORDER BY file_path, line_number",
            (repository_id,),
        ) as cursor:
            rows = await cursor.fetchall()
        return [_row_to_comment(row) for row in rows]

    async def list_by_session(self, session_id: str) -> list[DraftComment]:
        async with self._db.execute(
            "SELECT * FROM draft_comments WHERE review_session_id = ? ORDER BY file_path, line_number",
            (session_id,),
        ) as cursor:
            rows = await cursor.fetchall()
        return [_row_to_comment(row) for row in rows]

    async def update(self, comment_id: str, req: UpdateDraftCommentRequest) -> DraftComment:
        async with self._db.execute(
            "SELECT * FROM draft_comments WHERE id = ?", (comment_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise DraftCommentNotFoundError()

        now = datetime.now(timezone.utc)
        await self._db.execute(
            "UPDATE draft_comments SET comment_text = ?, updated_at = ? WHERE id = ?",
            (req.comment_text, now.isoformat(), comment_id),
        )
        await self._db.commit()

        updated = _row_to_comment(row)
        updated.comment_text = req.comment_text
        updated.updated_at = now
        return updated

    async def update_publish_status(
        self,
        comment_id: str,
        req: UpdatePublishStatusRequest,
    ) -> DraftComment:
        async with self._db.execute(
            "SELECT * FROM draft_comments WHERE id = ?", (comment_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise DraftCommentNotFoundError()

        now = datetime.now(timezone.utc)
        await self._db.execute(
            """
            UPDATE draft_comments
            SET status = ?, gitlab_note_id = ?, gitlab_discussion_id = ?,
                gitlab_mr_iid = ?, updated_at = ?
            WHERE id = ?
            """,
            (req.status, req.gitlab_note_id, req.gitlab_discussion_id,
             req.gitlab_mr_iid, now.isoformat(), comment_id),
        )
        await self._db.commit()

        comment = _row_to_comment(row)
        comment.status = req.status
        comment.gitlab_note_id = req.gitlab_note_id
        comment.gitlab_discussion_id = req.gitlab_discussion_id
        comment.gitlab_mr_iid = req.gitlab_mr_iid
        comment.updated_at = now
        return comment

    async def accept_suggestion(self, comment_id: str) -> DraftComment:
        """Convert an AI suggestion to a manual draft comment by setting origin='manual'."""
        async with self._db.execute(
            "SELECT * FROM draft_comments WHERE id = ?", (comment_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise DraftCommentNotFoundError()

        now = datetime.now(timezone.utc)
        await self._db.execute(
            "UPDATE draft_comments SET origin = 'manual', updated_at = ? WHERE id = ?",
            (now.isoformat(), comment_id),
        )
        await self._db.commit()

        comment = _row_to_comment(row)
        comment.origin = "manual"
        comment.updated_at = now
        return comment

    async def delete(self, comment_id: str) -> None:
        async with self._db.execute(
            "SELECT id FROM draft_comments WHERE id = ?", (comment_id,)
        ) as cursor:
            if await cursor.fetchone() is None:
                raise DraftCommentNotFoundError()
        await self._db.execute("DELETE FROM draft_comments WHERE id = ?", (comment_id,))
        await self._db.commit()


def _row_to_comment(row: aiosqlite.Row) -> DraftComment:
    return DraftComment(
        id=row["id"],
        repository_id=row["repository_id"],
        review_session_id=row["review_session_id"],
        file_path=row["file_path"],
        line_number=row["line_number"],
        end_line_number=row["end_line_number"],
        comment_text=row["comment_text"],
        severity=row["severity"],
        status=row["status"],
        origin=row["origin"],
        gitlab_note_id=row["gitlab_note_id"],
        gitlab_discussion_id=row["gitlab_discussion_id"],
        gitlab_mr_iid=row["gitlab_mr_iid"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )
