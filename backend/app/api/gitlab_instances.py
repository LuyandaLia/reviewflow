from fastapi import APIRouter, Depends, status
from fastapi.responses import Response

import aiosqlite

from app.database import get_db
from app.models.gitlab_instance import CreateGitLabInstanceRequest, GitLabInstanceResponse
from app.services.gitlab_instance_service import GitLabInstanceService

router = APIRouter(tags=["gitlab-instances"])


def _svc(db: aiosqlite.Connection = Depends(get_db)) -> GitLabInstanceService:
    return GitLabInstanceService(db)


@router.get("/gitlab-instances", response_model=list[GitLabInstanceResponse])
async def list_instances(svc: GitLabInstanceService = Depends(_svc)):
    instances = await svc.list_all()
    return [GitLabInstanceResponse.from_domain(i) for i in instances]


@router.post(
    "/gitlab-instances",
    response_model=GitLabInstanceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_instance(
    req: CreateGitLabInstanceRequest,
    svc: GitLabInstanceService = Depends(_svc),
):
    instance = await svc.create(req)
    return GitLabInstanceResponse.from_domain(instance)


@router.delete("/gitlab-instances/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instance(
    instance_id: str,
    svc: GitLabInstanceService = Depends(_svc),
):
    await svc.delete(instance_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
