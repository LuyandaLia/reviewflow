# ADR-0001: Use a Python backend for business logic and integrations

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** ReviewFlow architecture

## Decision

ReviewFlow will run a **Python service** as the sole integration and business-logic layer. The service runs locally by default and can be deployed on-premise for enterprise use. It owns GitLab API communication, AI draft generation, local persistence, publish orchestration, and credential management. The Cursor extension is a thin UI client that communicates with the backend over a local API (REST).

## Context

ReviewFlow must integrate with GitLab API v4 across multiple instances, orchestrate batch publish of draft comments with idempotent retries, generate optional AI draft suggestions, and persist review state locally. The [PRD](../prd.md) requires:

- A backend that survives network disconnects and keeps drafts safe when publishing fails (§8 Reliability).
- On-premise deployment and self-hosted GitLab compatibility (§8 Enterprise-readiness).
- Secure storage of API keys and access tokens via the OS keychain (§8 Security).

Centralizing these concerns in a dedicated backend creates a clear security boundary: the extension never holds GitLab tokens or talks to external services directly. Python is well suited to enterprise on-prem deployments, has mature HTTP and GitLab client libraries, and aligns with the PRD's stated platform choice (§3 Goals, §11 MVP Scope).

**Related ADRs:** [ADR-0002](0002-cursor-extension.md) (extension as thin client), [ADR-0007](0007-plugin-architecture.md) (plugin host in backend).

## Alternatives

### All logic in the Cursor extension (TypeScript only)

A single-process extension that calls GitLab and AI APIs directly from the IDE.

- **Pros:** Simpler local install (one process), no inter-process communication.
- **Cons:** Poor secret handling in the extension runtime, harder to reuse GitLab/AI SDK logic, weak on-prem deployment story, business logic coupled to IDE lifecycle.

### Node.js backend

A local Node.js service consumed by the TypeScript extension.

- **Pros:** Shared language with the extension team, large npm ecosystem.
- **Cons:** Weaker fit for enterprise Python ops environments, duplicates language without eliminating the two-process model, no compelling advantage over Python for GitLab/AI integration.

### Cloud-only SaaS backend

A hosted ReviewFlow API with cloud-synced drafts.

- **Pros:** Easier multi-device sync, centralized updates.
- **Cons:** Conflicts with local-first privacy requirements (§8 Security), increases data-residency risk for enterprise users, drafts would leave the machine before publish — contrary to core product principles (§3 Goals).

## Consequences

### Positive

- Rich ecosystem for GitLab API clients, HTTP tooling, and AI provider SDKs.
- Strong on-prem and enterprise deployment fit; backend can run as a systemd service or container.
- Clear security boundary: tokens in OS keychain, secrets never in extension code.
- Extension stays thin and testable against a stable API contract.
- Publish orchestration, retry logic, and rate-limit handling live in one place.

### Negative

- Two-process local install: extension plus backend daemon; requires health checks and process management.
- API versioning and backward compatibility become ongoing concerns as the extension and backend evolve independently.
- Local development and debugging span two runtimes (TypeScript + Python).

### Neutral

- Backend may be cloud-hosted in future team scenarios, but MVP defaults to local execution per [ADR-0006](0006-local-review-storage.md).
