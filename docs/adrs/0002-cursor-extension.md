# ADR-0002: Use a Cursor extension as the IDE frontend

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** ReviewFlow architecture

## Decision

ReviewFlow will ship as a **Cursor / VS Code extension** that provides the reviewer-facing UI. The extension uses the VS Code **Commenting API** (`CommentController`) for line-anchored draft comments on diffs, and a **dedicated sidebar panel** for the draft inbox, MR browser, instance manager, and publish wizard. All business logic and external integrations are delegated to the Python backend per [ADR-0001](0001-python-backend.md).

## Context

ReviewFlow's core value proposition is eliminating context switching between the IDE (where code is understood) and a web browser (where reviews are conducted). The [PRD](../prd.md) states:

- Reviewers need to add draft comments directly on lines of code in the IDE (§6 User Stories).
- The local draft UI must have zero perceptible latency — under 100ms (§8 Performance).
- MVP scope includes a Cursor extension frontend using the VS Code Commenting API and a dedicated panel for pending drafts (§11 MVP Scope).

Inline, line-level commenting requires deep integration with the editor's diff view and file model. A native extension is the only practical way to achieve sub-100ms draft CRUD while preserving the reviewer's existing Cursor workflow.

**Related ADRs:** [ADR-0001](0001-python-backend.md) (thin client model), [ADR-0006](0006-local-review-storage.md) (local draft UX).

## Alternatives

### Standalone desktop application

A custom Electron or native app with its own diff viewer.

- **Pros:** Full UI control, no extension API constraints.
- **Cons:** Loses editor integration and diff context; reviewers must leave Cursor; high build and maintenance cost.

### Web application

A browser-based review workspace.

- **Pros:** Cross-platform without IDE dependency.
- **Cons:** Reintroduces the context-switching problem ReviewFlow exists to solve; no access to Cursor's inline commenting on local diffs.

### GitLab browser extension

A Chrome/Firefox extension that augments the GitLab web UI.

- **Pros:** Works in the reviewer's existing GitLab workflow.
- **Cons:** No integration with Cursor's editor, diff view, or AI assist context; does not address IDE-native drafting.

### JetBrains plugin (first)

An IntelliJ/PyCharm plugin as the primary client.

- **Pros:** Large enterprise IDE market.
- **Cons:** Smaller addressable market for MVP given Cursor-first positioning; PRD explicitly targets Cursor (§3 Goals, §11 MVP Scope).

## Consequences

### Positive

- Native diff and line anchoring within the editor the reviewer already uses.
- Minimal context switch; drafts appear inline on the code under review.
- Leverages Cursor/VS Code extension distribution and update mechanisms.
- Aligns directly with PRD MVP scope and user stories.

### Negative

- Bound by VS Code / Cursor extension API limits on inline commenting UI — a risk called out in the PRD (§10 Risks). Early prototyping of `CommentController` is required.
- Extension API churn across Cursor versions requires a thin adapter layer and pinned supported versions.
- Extension cannot function without the Python backend running locally.

### Neutral

- Future IDE support (e.g. plain VS Code, JetBrains) would be separate clients against the same backend API, not replacements for this decision.
