from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

import aiosqlite

from app.database import get_db
from app.models.gitlab_user import GitLabUserResponse, UpsertGitLabUserRequest
from app.services.gitlab_user_service import GitLabUserService

router = APIRouter(tags=["gitlab_users"])


def _svc(db: aiosqlite.Connection = Depends(get_db)) -> GitLabUserService:
    return GitLabUserService(db)


@router.get("/gitlab-instances/{instance_id}/user", response_model=GitLabUserResponse)
async def get_instance_user(
    instance_id: str,
    svc: GitLabUserService = Depends(_svc),
):
    user = await svc.get(instance_id)
    if user is None:
        raise HTTPException(status_code=404, detail="No user profile stored for this instance.")
    return GitLabUserResponse.from_domain(user)


@router.put("/gitlab-instances/{instance_id}/user", response_model=GitLabUserResponse)
async def upsert_instance_user(
    instance_id: str,
    req: UpsertGitLabUserRequest,
    svc: GitLabUserService = Depends(_svc),
):
    user = await svc.upsert(instance_id, req)
    return GitLabUserResponse.from_domain(user)


@router.delete(
    "/gitlab-instances/{instance_id}/user",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_instance_user(
    instance_id: str,
    svc: GitLabUserService = Depends(_svc),
):
    await svc.delete(instance_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
