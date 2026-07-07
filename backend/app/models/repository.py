from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel


@dataclass
class Repository:
    id: str
    local_path: str
    gitlab_instance_id: str
    gitlab_project_path: str
    display_name: str
    created_at: datetime
    updated_at: datetime


class CreateRepositoryRequest(BaseModel):
    local_path: str
    gitlab_instance_id: str
    gitlab_project_path: str
    display_name: str


class RepositoryResponse(BaseModel):
    id: str
    local_path: str
    gitlab_instance_id: str
    gitlab_project_path: str
    display_name: str
    created_at: str
    updated_at: str

    @classmethod
    def from_domain(cls, repo: Repository) -> "RepositoryResponse":
        return cls(
            id=repo.id,
            local_path=repo.local_path,
            gitlab_instance_id=repo.gitlab_instance_id,
            gitlab_project_path=repo.gitlab_project_path,
            display_name=repo.display_name,
            created_at=repo.created_at.isoformat(),
            updated_at=repo.updated_at.isoformat(),
        )
