# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for [ReviewFlow](../prd.md) — an IDE-native, human-first code review workspace for Cursor.

ADRs document significant architectural choices, the context that drove them, alternatives considered, and their consequences. They are derived from the [Product Requirements Document](../prd.md).

## Index

| ADR | Title | Summary |
|-----|-------|---------|
| [0001](0001-python-backend.md) | Use a Python backend | Python service handles GitLab, AI, persistence, and publish orchestration; extension is a thin UI client |
| [0002](0002-cursor-extension.md) | Use a Cursor extension | VS Code Commenting API + sidebar panel for line-anchored drafts and publish workflow |
| [0003](0003-sqlite-local-persistence.md) | Use SQLite for local persistence | Relational local database for instances, MRs, drafts, and publish history |
| [0004](0004-git-provider-abstraction.md) | Git provider abstraction | `VcsProvider` interface with GitLab first, GitHub deferred to post-MVP |
| [0005](0005-gitlab-instance-abstraction.md) | GitLab instance abstraction | Single provider handles GitLab.com and self-managed instances via instance registry |
| [0006](0006-local-review-storage.md) | Local-first review storage | Drafts stay on the user's machine until explicit publish; GitLab is system of record for published feedback |
| [0007](0007-plugin-architecture.md) | Plugin architecture | Backend plugin host for VCS, AI, and future auth/storage providers |

## Status

All ADRs listed above are **Accepted** as of 2026-07-06.

## Related documents

- [Product Requirements Document](../prd.md)
