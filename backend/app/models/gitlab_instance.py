from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel


@dataclass
class GitLabInstance:
    id: str
    display_name: str
    base_url: str
    api_path: str
    ca_bundle_path: str | None
    created_at: datetime
    updated_at: datetime


class CreateGitLabInstanceRequest(BaseModel):
    display_name: str
    base_url: str
    api_path: str = "/api/v4"
    ca_bundle_path: str | None = None


class GitLabInstanceResponse(BaseModel):
    id: str
    display_name: str
    base_url: str
    api_path: str
    ca_bundle_path: str | None
    created_at: str
    updated_at: str

    @classmethod
    def from_domain(cls, instance: GitLabInstance) -> "GitLabInstanceResponse":
        return cls(
            id=instance.id,
            display_name=instance.display_name,
            base_url=instance.base_url,
            api_path=instance.api_path,
            ca_bundle_path=instance.ca_bundle_path,
            created_at=instance.created_at.isoformat(),
            updated_at=instance.updated_at.isoformat(),
        )
