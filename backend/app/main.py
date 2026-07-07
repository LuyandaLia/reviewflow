from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_db
from app.exceptions import ReviewFlowError
from app.api import draft_comments, gitlab_instances, gitlab_users, repositories, review_sessions


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    yield


app = FastAPI(title="ReviewFlow Backend", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "reviewflow-backend"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["vscode-webview://*"],
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ReviewFlowError)
async def reviewflow_error_handler(request: Request, exc: ReviewFlowError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "message": exc.message},
    )


app.include_router(gitlab_instances.router, prefix="/api/v1")
app.include_router(gitlab_users.router, prefix="/api/v1")
app.include_router(repositories.router, prefix="/api/v1")
app.include_router(draft_comments.router, prefix="/api/v1")
app.include_router(review_sessions.router, prefix="/api/v1")
