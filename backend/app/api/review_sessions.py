from fastapi import APIRouter, Depends, status
from fastapi.responses import Response

import aiosqlite

from app.database import get_db
from app.models.draft_comment import DraftCommentResponse
from app.models.review_session import CreateReviewSessionRequest, ReviewSessionResponse, UpdateReviewSessionRequest
from app.services.draft_comment_service import DraftCommentService
from app.services.review_session_service import ReviewSessionService

router = APIRouter(tags=["review_sessions"])


def _svc(db: aiosqlite.Connection = Depends(get_db)) -> ReviewSessionService:
    return ReviewSessionService(db)


@router.post(
    "/repositories/{repository_id}/review-sessions",
    response_model=ReviewSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_review_session(
    repository_id: str,
    req: CreateReviewSessionRequest,
    svc: ReviewSessionService = Depends(_svc),
):
    session = await svc.create(repository_id, req.name)
    return ReviewSessionResponse.from_domain(session)


@router.get(
    "/repositories/{repository_id}/review-sessions",
    response_model=list[ReviewSessionResponse],
)
async def list_review_sessions(
    repository_id: str,
    svc: ReviewSessionService = Depends(_svc),
):
    sessions = await svc.list_by_repository(repository_id)
    return [ReviewSessionResponse.from_domain(s) for s in sessions]


@router.patch("/review-sessions/{session_id}", response_model=ReviewSessionResponse)
async def rename_review_session(
    session_id: str,
    req: UpdateReviewSessionRequest,
    svc: ReviewSessionService = Depends(_svc),
):
    session = await svc.rename(session_id, req.name)
    return ReviewSessionResponse.from_domain(session)


@router.post(
    "/review-sessions/{session_id}/activate",
    response_model=ReviewSessionResponse,
)
async def activate_review_session(
    session_id: str,
    svc: ReviewSessionService = Depends(_svc),
):
    session = await svc.activate(session_id)
    return ReviewSessionResponse.from_domain(session)


@router.delete("/review-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review_session(
    session_id: str,
    svc: ReviewSessionService = Depends(_svc),
):
    await svc.delete(session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/review-sessions/{session_id}/draft-comments",
    response_model=list[DraftCommentResponse],
)
async def list_session_draft_comments(
    session_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    svc = DraftCommentService(db)
    comments = await svc.list_by_session(session_id)
    return [DraftCommentResponse.from_domain(c) for c in comments]
