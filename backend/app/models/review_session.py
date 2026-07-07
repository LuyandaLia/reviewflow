from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel


@dataclass
class ReviewSession:
    id: str
    repository_id: str
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateReviewSessionRequest(BaseModel):
    name: str


class UpdateReviewSessionRequest(BaseModel):
    name: str


class ReviewSessionResponse(BaseModel):
    id: str
    repository_id: str
    name: str
    is_active: bool
    created_at: str
    updated_at: str

    @classmethod
    def from_domain(cls, s: ReviewSession) -> "ReviewSessionResponse":
        return cls(
            id=s.id,
            repository_id=s.repository_id,
            name=s.name,
            is_active=s.is_active,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        )
