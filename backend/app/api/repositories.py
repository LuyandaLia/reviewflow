from fastapi import APIRouter, Depends, status
from fastapi.responses import Response

import aiosqlite

from app.database import get_db
from app.models.repository import CreateRepositoryRequest, RepositoryResponse
from app.services.repository_service import RepositoryService

router = APIRouter(tags=["repositories"])


def _svc(db: aiosqlite.Connection = Depends(get_db)) -> RepositoryService:
    return RepositoryService(db)


@router.get("/repositories", response_model=list[RepositoryResponse])
async def list_repositories(svc: RepositoryService = Depends(_svc)):
    repos = await svc.list_all()
    return [RepositoryResponse.from_domain(r) for r in repos]


@router.post(
    "/repositories",
    response_model=RepositoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_repository(
    req: CreateRepositoryRequest,
    svc: RepositoryService = Depends(_svc),
):
    repo = await svc.create(req)
    return RepositoryResponse.from_domain(repo)


@router.delete("/repositories/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repository(
    repo_id: str,
    svc: RepositoryService = Depends(_svc),
):
    await svc.delete(repo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
