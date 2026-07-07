from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel


@dataclass
class DraftComment:
    id: str
    repository_id: str
    review_session_id: str
    file_path: str
    line_number: int
    end_line_number: int | None
    comment_text: str
    severity: str
    status: str
    origin: str
    gitlab_note_id: str | None
    gitlab_discussion_id: str | None
    gitlab_mr_iid: int | None
    created_at: datetime
    updated_at: datetime


class UpdateDraftCommentRequest(BaseModel):
    comment_text: str


class CreateDraftCommentRequest(BaseModel):
    review_session_id: str
    file_path: str
    line_number: int
    end_line_number: int | None = None
    comment_text: str
    severity: str = "info"
    origin: str = "manual"


class UpdatePublishStatusRequest(BaseModel):
    status: str
    gitlab_note_id: str | None = None
    gitlab_discussion_id: str | None = None
    gitlab_mr_iid: int | None = None


class DraftCommentResponse(BaseModel):
    id: str
    repository_id: str
    review_session_id: str
    file_path: str
    line_number: int
    end_line_number: int | None
    comment_text: str
    severity: str
    status: str
    origin: str
    gitlab_note_id: str | None
    gitlab_discussion_id: str | None
    gitlab_mr_iid: int | None
    created_at: str
    updated_at: str

    @classmethod
    def from_domain(cls, c: DraftComment) -> "DraftCommentResponse":
        return cls(
            id=c.id,
            repository_id=c.repository_id,
            review_session_id=c.review_session_id,
            file_path=c.file_path,
            line_number=c.line_number,
            end_line_number=c.end_line_number,
            comment_text=c.comment_text,
            severity=c.severity,
            status=c.status,
            origin=c.origin,
            gitlab_note_id=c.gitlab_note_id,
            gitlab_discussion_id=c.gitlab_discussion_id,
            gitlab_mr_iid=c.gitlab_mr_iid,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
