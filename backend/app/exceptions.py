class ReviewFlowError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class DuplicateInstanceUrlError(ReviewFlowError):
    def __init__(self) -> None:
        super().__init__(
            "DUPLICATE_INSTANCE_URL",
            "A GitLab instance with this base URL is already registered.",
        )


class DuplicateLocalPathError(ReviewFlowError):
    def __init__(self) -> None:
        super().__init__(
            "DUPLICATE_LOCAL_PATH",
            "A repository with this local path is already registered.",
        )


class DuplicateProjectError(ReviewFlowError):
    def __init__(self) -> None:
        super().__init__(
            "DUPLICATE_PROJECT",
            "This GitLab project is already registered for this instance.",
        )


class InstanceNotFoundError(ReviewFlowError):
    def __init__(self) -> None:
        super().__init__("INSTANCE_NOT_FOUND", "GitLab instance not found.", 404)


class RepositoryNotFoundError(ReviewFlowError):
    def __init__(self) -> None:
        super().__init__("REPOSITORY_NOT_FOUND", "Repository not found.", 404)


class InstanceHasRepositoriesError(ReviewFlowError):
    def __init__(self, count: int) -> None:
        noun = "repository" if count == 1 else "repositories"
        super().__init__(
            "INSTANCE_HAS_REPOSITORIES",
            f"Cannot delete instance: {count} {noun} registered to it.",
        )


class PathNotFoundError(ReviewFlowError):
    def __init__(self, path: str) -> None:
        super().__init__("PATH_NOT_FOUND", f"Path does not exist: {path}")


class PathNotADirectoryError(ReviewFlowError):
    def __init__(self, path: str) -> None:
        super().__init__("PATH_NOT_A_DIRECTORY", f"Path is not a directory: {path}")


class DraftCommentNotFoundError(ReviewFlowError):
    def __init__(self) -> None:
        super().__init__("DRAFT_COMMENT_NOT_FOUND", "Draft comment not found.", 404)


class ReviewSessionNotFoundError(ReviewFlowError):
    def __init__(self) -> None:
        super().__init__("REVIEW_SESSION_NOT_FOUND", "Review session not found.", 404)


class DuplicateSessionNameError(ReviewFlowError):
    def __init__(self) -> None:
        super().__init__(
            "DUPLICATE_SESSION_NAME",
            "A review session with this name already exists for this repository.",
        )
