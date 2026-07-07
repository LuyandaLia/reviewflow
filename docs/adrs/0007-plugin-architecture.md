# ADR-0007: Plugin architecture for extensible providers

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** ReviewFlow architecture

## Decision

The Python backend will be structured as a **plugin host** with a formal registration and composition model for extensible provider types:

| Plugin type | MVP | Future |
|-------------|-----|--------|
| **VCS providers** | GitLab (`GitLabProvider`) | GitHub (`GitHubProvider`) |
| **AI providers** | One configurable LLM backend | Additional vendors, on-prem models |
| **Auth providers** | PAT / OAuth (built-in) | Enterprise SSO / OIDC |
| **Storage providers** | SQLite (built-in) | Remote DB for team features |

**Rules:**

1. The Cursor extension ([ADR-0002](0002-cursor-extension.md)) communicates only with the stable backend REST API — never with plugins directly.
2. Core services (draft CRUD, publish orchestration, draft inbox) depend on plugin **interfaces**, not concrete implementations.
3. MVP ships with **built-in plugins only**; dynamic loading of third-party plugin packages is deferred post-MVP.
4. Each plugin declares a **capability manifest** (supported operations, version, provider id) for discovery and feature gating.

This ADR defines the **composition and registration model**. The VCS interface itself is defined in [ADR-0004](0004-git-provider-abstraction.md). GitLab instance handling is defined in [ADR-0005](0005-gitlab-instance-abstraction.md).

## Context

ReviewFlow's roadmap extends beyond a single GitLab client:

- GitHub Pull Request support (PRD §12 Future Scope).
- Configurable AI providers for draft suggestions (PRD §7 AI Assistant, §11 MVP Scope).
- Enterprise SSO and on-prem LLM deployment (PRD §8 Enterprise-readiness, §12 Future Scope).

The PRD's non-functional requirements include extensibility: a provider interface for VCS (GitLab now, GitHub later). Ad-hoc modules without a registration model would make each new provider a invasive change to core publish and draft logic.

A plugin architecture separates **what the system does** (draft lifecycle, publish orchestration per [ADR-0006](0006-local-review-storage.md)) from **who it talks to** (GitLab, GitHub, OpenAI, etc.).

**Related ADRs:** [ADR-0004](0004-git-provider-abstraction.md), [ADR-0005](0005-gitlab-instance-abstraction.md), [ADR-0001](0001-python-backend.md), [ADR-0003](0003-sqlite-local-persistence.md).

## Alternatives

### Monolithic backend modules

GitLab client, AI client, and storage layer as plain Python modules imported directly by services.

- **Pros:** Simplest MVP structure; no plugin registry or lifecycle management.
- **Cons:** Adding GitHub or a new AI vendor requires touching core services; enterprise private integrations require forking the codebase.

### Microservices per provider

Separate processes for GitLab integration, AI, and storage, orchestrated locally.

- **Pros:** Maximum isolation; independent scaling and deployment per provider.
- **Cons:** Excessive operational complexity for a local-first single-user MVP; inter-process overhead for every draft save and publish.

### Extension-side plugins

Plugins run inside the Cursor extension; backend is a thin proxy.

- **Pros:** Extension team can ship provider plugins without backend releases.
- **Cons:** Token exposure in extension runtime; splits business logic across runtimes; violates the security boundary established in [ADR-0001](0001-python-backend.md).

## Consequences

### Positive

- New VCS or AI vendor = new plugin implementing a narrow interface; core publish and draft logic unchanged.
- Enterprise customers can ship private plugins (custom GitLab forks, on-prem LLM endpoints) without forking ReviewFlow core.
- Capability discovery enables the extension UI to hide unsupported actions per provider (e.g. GitHub-specific review comment threading).
- Built-in plugins in MVP validate the architecture without requiring external plugin distribution infrastructure.

### Negative

- Plugin lifecycle, versioning, and capability discovery add design and implementation complexity beyond a monolith.
- Interface stability becomes a contract: breaking changes to plugin interfaces require coordinated updates across built-in plugins.
- External/third-party plugin loading (pip packages, local plugin directories) is explicitly deferred; architecture must not over-engineer for it in MVP.

### Neutral

- MVP plugin set: `GitLabProvider`, one `AiProvider`, `SqliteStorage`, built-in `PatOAuthAuth`.
- Plugin registration happens at backend startup; hot-reloading plugins is out of scope for MVP.
- Future ADRs may be needed for external plugin distribution, signing, and sandboxing when third-party plugins are supported.
