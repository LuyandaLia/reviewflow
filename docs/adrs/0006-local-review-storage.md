# ADR-0006: Local-first review storage until explicit publish

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** ReviewFlow architecture

## Decision

All review comments created in ReviewFlow are **drafts stored locally** on the user's machine until the reviewer explicitly confirms publish. **GitLab remains the system of record** for published feedback only. ReviewFlow does not modify source code based on review comments.

Key rules:

1. Draft CRUD is local-only and must complete in under 100ms (PRD §8 Performance).
2. AI-generated suggestions are always drafts with `source: ai` and never auto-published.
3. Publish is a deliberate, confirmed batch action initiated by the reviewer.
4. Failed publishes leave all drafts intact locally with structured error detail for retry.
5. Drafts are persisted across IDE restarts via SQLite ([ADR-0003](0003-sqlite-local-persistence.md)).

## Context

Local-first storage is a core product principle stated throughout the [PRD](../prd.md):

- "Ensure all draft comments are stored securely on the local machine until explicitly published" (§3 Goals).
- "Human reviewers always control publication" and "AI suggestions are always drafts" (product principles).
- "Reviews are stored locally until published" (implicit in §6 User Stories, §7 Local Workspace).
- "Review drafts must not be sent to any external server other than the authorized AI provider and GitLab" (§8 Security).
- "The Python backend must handle network disconnects gracefully, keeping drafts safe locally if publishing fails" (§8 Reliability).
- "Replacing the source of truth (GitLab remains the system of record for the final review)" is a non-goal to avoid (§4 Non-goals).

This decision defines the **data lifecycle** for review comments: create locally → edit/organize locally → preview → confirm publish → GitLab. It complements [ADR-0003](0003-sqlite-local-persistence.md) (how drafts are stored) and [ADR-0001](0001-python-backend.md) (publish orchestration in backend).

**Related ADRs:** [ADR-0003](0003-sqlite-local-persistence.md), [ADR-0001](0001-python-backend.md), [ADR-0004](0004-git-provider-abstraction.md) (publish via provider).

## Alternatives

### Cloud-synced drafts

Store drafts in a ReviewFlow cloud service with multi-device sync.

- **Pros:** Drafts available across machines; easier team visibility into in-progress reviews.
- **Cons:** Privacy and compliance risk for unreleased review opinions and proprietary code context; conflicts with PRD security requirements (§8); drafts leave the machine before publish.

### Write-through to GitLab on every save

Each draft keystroke creates or updates a GitLab discussion note immediately.

- **Pros:** No local persistence layer needed; drafts visible in GitLab UI in real time.
- **Cons:** No offline draft safety; noisy MR history with half-formed comments; violates human-first publish control; network failures lose in-progress edits.

### Ephemeral in-memory drafts

Hold drafts only in extension memory; persist on explicit save or publish.

- **Pros:** Simplest implementation; no database.
- **Cons:** Data loss on IDE restart or crash; contradicts user story "my draft comments saved locally" (§6).

## Consequences

### Positive

- Strong privacy posture: unreleased review opinions never leave the machine except when sent to the authorized AI provider (opt-in) or GitLab (on publish).
- Publish is idempotent and retry-safe; `PublishRecord` entries in SQLite provide a local audit trail.
- Network failures during publish do not destroy drafts; reviewer can retry after fixing connectivity or token issues.
- Clear separation between draft state (local) and published state (GitLab), simplifying the mental model for reviewers.

### Negative

- No cross-machine draft sync in MVP; reviewer must use the same machine to continue an in-progress review.
- SHA and line-anchor drift after new commits on the MR require re-anchoring or a warn-before-publish step (risk noted in PRD planning).
- Extension and backend must handle stale draft indicators when the remote MR changes.

### Neutral

- AI draft suggestions follow the same lifecycle as human drafts; `source` field distinguishes origin but publish rules are identical.
- Future team features (shared draft queues, cloud sync) would be additive and require a separate ADR; this decision governs MVP.
