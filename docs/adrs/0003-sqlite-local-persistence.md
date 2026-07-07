# ADR-0003: Use SQLite for local persistence

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** ReviewFlow architecture

## Decision

ReviewFlow will persist all local application state in a **SQLite database** on the user's machine. This includes GitLab instance registry, repository and merge request metadata, draft comments, and publish history. JSON or filesystem storage is not the primary persistence mechanism.

GitLab access tokens and API keys are **not** stored in SQLite; they are stored in the OS keychain per the [PRD](../prd.md) 8 Security.

## Context

The [PRD](../prd.md) requires local state management for drafts per repository and merge request (§7 State Management) and allows SQLite or JSON-based persistence (§11 MVP Scope). ReviewFlow supports multi-repository workflows where a reviewer may have drafts across several MRs simultaneously (§3 Goals, §6 User Stories).

The planned data model includes relational entities:

- `GitLabInstance` → `Repository` → `MergeRequest` → `DraftComment`
- `PublishRecord` for audit and retry tracking

Publish is a transactional operation: multiple drafts must be marked published atomically alongside their corresponding `PublishRecord` entries. Failed publishes must leave drafts intact with error detail ([ADR-0006](0006-local-review-storage.md)).

**Related ADRs:** [ADR-0006](0006-local-review-storage.md) (what is stored locally), [ADR-0005](0005-gitlab-instance-abstraction.md) (instance registry in DB).

## Alternatives



### JSON / filesystem per repository-MR

One JSON file per MR containing draft comments, stored under a `.reviewflow/` directory in the project or user home.

- **Pros:** Human-readable, easy to inspect and debug, no schema migrations.
- **Cons:** Weak querying across MRs and repos (no draft inbox without scanning all files), no atomic multi-draft publish, race conditions on concurrent writes, poor fit for multi-repo inbox views.



### Embedded key-value store (LevelDB / RocksDB)

A fast embedded KV store for serialized draft blobs.

- **Pros:** High write throughput, simple key-value access patterns.
- **Cons:** Awkward relational joins for MR/draft queries, no built-in schema enforcement, harder to implement transactional publish.



### Remote database (PostgreSQL)

A local or remote Postgres instance for review state.

- **Pros:** Strong relational model, scales to future team/multi-user features.
- **Cons:** Overkill for individual local-first MVP; adds deployment complexity; conflicts with offline-first draft safety unless replicated.



## Consequences



### Positive

- ACID transactions enable atomic publish: drafts and `PublishRecord` update together or not at all.
- Indexed queries support fast draft inbox, filtering by MR/repo, and publish history lookups.
- Single database file simplifies backup and portability.
- Natural fit for the `GitLabInstance` → `Repository` → `MergeRequest` → `DraftComment` hierarchy.



### Negative

- Schema migrations are required as the data model evolves; not human-readable like JSON.
- SQLite file corruption (rare) could affect all local state; mitigation via periodic backup or WAL mode.
- Tokens deliberately excluded from SQLite add a second storage dependency (OS keychain).



### Neutral

- Database location defaults to user application data directory (e.g. `~/.reviewflow/reviewflow.db`); exact path is an implementation detail.
- Future team features may introduce a remote database; SQLite remains correct for single-user local-first MVP.

