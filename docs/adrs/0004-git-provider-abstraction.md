# ADR-0004: Introduce a Git provider abstraction (VCS-agnostic boundary)

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** ReviewFlow architecture

## Decision

The Python backend will define a **`VcsProvider` interface** that abstracts version-control review operations. The interface covers:

- Merge request / pull request discovery and metadata
- Diff fetch for a given change request
- Existing discussion and comment read
- Batch publish of locally drafted comments to the remote review thread

**GitLab** is the first and only MVP implementation. **GitHub** support is deferred to post-MVP but must not require a core rewrite when added.

Provider implementations are registered via the plugin host described in [ADR-0007](0007-plugin-architecture.md). GitLab-specific instance handling (SaaS vs self-managed) is further abstracted in [ADR-0005](0005-gitlab-instance-abstraction.md).

## Context

The [PRD](../prd.md) explicitly excludes GitHub in MVP (§4 Non-goals) but lists full GitHub Pull Request support in future scope (§12 Future Scope). The product principle is "GitLab first, GitHub later."

Without a provider abstraction, GitLab API calls would be scattered throughout the backend — publish orchestration, draft anchoring, MR browser, and diff fetch would all be GitLab-coupled. Adding GitHub later would become a large-scale refactor rather than a new plugin.

The draft comment model, publish wizard, and extension UI should remain provider-agnostic: a reviewer sees drafts and a publish action regardless of whether the underlying VCS is GitLab or GitHub.

**Related ADRs:** [ADR-0005](0005-gitlab-instance-abstraction.md) (GitLab-specific layer), [ADR-0007](0007-plugin-architecture.md) (plugin registration), [ADR-0006](0006-local-review-storage.md) (provider-agnostic draft model).

## Alternatives

### GitLab-only concrete client (no abstraction)

Direct GitLab API v4 calls throughout the backend with no interface boundary.

- **Pros:** Fastest path to MVP; no upfront interface design.
- **Cons:** Highest rewrite cost when GitHub is added; publish wizard and draft services become GitLab-coupled; harder to test without live GitLab.

### Third-party unified VCS API (vendor SaaS)

Use an external service that normalizes GitLab, GitHub, and other VCS APIs behind one REST surface.

- **Pros:** Less provider code to maintain; faster multi-VCS coverage.
- **Cons:** Adds external dependency, cost, and latency; enterprise data-residency risk (review metadata transits a third party); conflicts with local-first and on-prem requirements (§8 Enterprise-readiness).

### Extension-side VCS logic

Each IDE client implements its own GitLab/GitHub integration; backend only stores drafts.

- **Pros:** Extension team owns VCS UX end-to-end.
- **Cons:** Duplicates provider logic per IDE; token exposure in extension runtime; publish orchestration split across clients.

## Consequences

### Positive

- GitHub becomes a new `VcsProvider` implementation, not a core refactor.
- Publish wizard, draft inbox, and local storage ([ADR-0003](0003-sqlite-local-persistence.md)) stay provider-agnostic.
- Provider interface enables unit testing with mock providers.
- Capability flags on the interface allow provider-specific features (e.g. GitLab discussions vs GitHub review comments) without breaking the common model.

### Negative

- Upfront design cost to define a common comment anchor and publish model that maps cleanly to both GitLab Discussions API and GitHub Pull Request Review Comments API.
- Lowest-common-denominator risk: the shared interface may not expose all GitLab-specific features in MVP; mitigate with provider capability discovery.
- GitLab MVP implementation must be built against the interface from day one, adding a thin indirection layer.

### Neutral

- The `VcsProvider` interface lives in the Python backend only; the Cursor extension ([ADR-0002](0002-cursor-extension.md)) communicates via the stable backend REST API, not directly with providers.
