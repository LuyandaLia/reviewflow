from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel


@dataclass
class GitLabUser:
    gitlab_instance_id: str
    gitlab_user_id: int
    username: str
    display_name: str
    email: str | None
    avatar_url: str | None
    last_verified: datetime


class UpsertGitLabUserRequest(BaseModel):
    gitlab_user_id: int
    username: str
    display_name: str
    email: str | None = None
    avatar_url: str | None = None


class GitLabUserResponse(BaseModel):
    gitlab_instance_id: str
    gitlab_user_id: int
    username: str
    display_name: str
    email: str | None
    avatar_url: str | None
    last_verified: str

    @classmethod
    def from_domain(cls, u: GitLabUser) -> "GitLabUserResponse":
        return cls(
            gitlab_instance_id=u.gitlab_instance_id,
            gitlab_user_id=u.gitlab_user_id,
            username=u.username,
            display_name=u.display_name,
            email=u.email,
            avatar_url=u.avatar_url,
            last_verified=u.last_verified.isoformat(),
        )
