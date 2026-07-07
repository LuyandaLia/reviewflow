from fastapi import APIRouter, Depends, status
from fastapi.responses import Response

import aiosqlite

from app.database import get_db
from app.models.draft_comment import (
    CreateDraftCommentRequest,
    DraftCommentResponse,
    UpdateDraftCommentRequest,
    UpdatePublishStatusRequest,
)
from app.services.draft_comment_service import DraftCommentService

router = APIRouter(tags=["draft_comments"])


def _svc(db: aiosqlite.Connection = Depends(get_db)) -> DraftCommentService:
    return DraftCommentService(db)


@router.post(
    "/draft-comments",
    response_model=DraftCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_draft_comment(
    req: CreateDraftCommentRequest,
    svc: DraftCommentService = Depends(_svc),
):
    comment = await svc.create(req)
    return DraftCommentResponse.from_domain(comment)


@router.get(
    "/repositories/{repository_id}/draft-comments",
    response_model=list[DraftCommentResponse],
)
async def list_draft_comments(
    repository_id: str,
    svc: DraftCommentService = Depends(_svc),
):
    comments = await svc.list_by_repository(repository_id)
    return [DraftCommentResponse.from_domain(c) for c in comments]


@router.patch("/draft-comments/{comment_id}", response_model=DraftCommentResponse)
async def update_draft_comment(
    comment_id: str,
    req: UpdateDraftCommentRequest,
    svc: DraftCommentService = Depends(_svc),
):
    comment = await svc.update(comment_id, req)
    return DraftCommentResponse.from_domain(comment)


@router.patch("/draft-comments/{comment_id}/publish-status", response_model=DraftCommentResponse)
async def update_publish_status(
    comment_id: str,
    req: UpdatePublishStatusRequest,
    svc: DraftCommentService = Depends(_svc),
):
    comment = await svc.update_publish_status(comment_id, req)
    return DraftCommentResponse.from_domain(comment)


@router.post("/draft-comments/{comment_id}/accept", response_model=DraftCommentResponse)
async def accept_ai_suggestion(
    comment_id: str,
    svc: DraftCommentService = Depends(_svc),
):
    comment = await svc.accept_suggestion(comment_id)
    return DraftCommentResponse.from_domain(comment)


@router.delete("/draft-comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft_comment(
    comment_id: str,
    svc: DraftCommentService = Depends(_svc),
):
    await svc.delete(comment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
