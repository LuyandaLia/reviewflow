# ADR-0005: Abstract GitLab SaaS and self-managed instances

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** ReviewFlow architecture

## Decision

ReviewFlow will model each GitLab deployment as a **`GitLabInstance`** with instance-aware configuration:

- Base URL (e.g. `https://gitlab.com` or `https://gitlab.corp.example.com`)
- API version path (`/api/v4`)
- Authentication credentials (PAT or OAuth tokens, stored in OS keychain)
- Optional custom CA bundle for enterprise TLS

A **single `GitLabProvider` implementation** of the `VcsProvider` interface ([ADR-0004](0004-git-provider-abstraction.md)) handles both GitLab.com (SaaS) and arbitrary self-managed GitLab hosts. Instance differences are resolved at runtime via configuration, not separate code paths.

## Context

The [PRD](../prd.md) requires:

- Compatibility with self-hosted GitLab instances (§8 Enterprise-readiness).
- MVP support for a configured GitLab instance, cloud or self-hosted (§11 MVP Scope).
- Secure authentication via PAT or OAuth (§7 GitLab Integration).

Enterprise users commonly run self-managed GitLab behind custom hostnames, internal CAs, and version-skewed API surfaces. GitLab.com SaaS and self-managed instances share the same API v4 surface in principle, but differ in hostname, TLS configuration, rate limits, and minor version-specific behavior.

Treating each deployment as a first-class `GitLabInstance` in the local SQLite registry ([ADR-0003](0003-sqlite-local-persistence.md)) allows a reviewer to connect to both GitLab.com and a corporate self-managed instance simultaneously.

**Related ADRs:** [ADR-0004](0004-git-provider-abstraction.md) (VCS interface), [ADR-0003](0003-sqlite-local-persistence.md) (instance registry), [ADR-0007](0007-plugin-architecture.md) (GitLab as built-in plugin).

## Alternatives

### GitLab.com only in MVP

Ship against `https://gitlab.com` with hardcoded base URL; defer self-managed support.

- **Pros:** Simplest MVP; fewer TLS and version-matrix test cases.
- **Cons:** Excludes enterprise self-managed users — a key persona in the PRD (§5 Security/Enterprise User); contradicts enterprise-readiness goals (§8).

### Separate code paths per deployment type

Distinct `GitLabSaaSClient` and `GitLabSelfManagedClient` classes with duplicated logic.

- **Pros:** Allows deployment-specific optimizations without conditional branches.
- **Cons:** Code duplication and drift; every API change must be applied twice; harder to maintain.

### GitLab CLI (`glab`) wrapper

Shell out to the `glab` CLI for GitLab operations.

- **Pros:** Leverages maintained CLI for auth and API calls.
- **Cons:** Shell dependency, weak error handling and typing, poor fit for batch publish orchestration and retry logic, difficult to embed in a Python service.

## Consequences

### Positive

- One integration surface for all GitLab deployments; instance registry stored in local SQLite.
- Reviewer can register multiple instances (GitLab.com + corporate) with separate credentials.
- PAT and OAuth per instance; tokens in OS keychain, not in the database.
- Rate-limit handling and version negotiation are instance-scoped.
- Custom CA bundle support for enterprise TLS interception or internal CAs.

### Negative

- Must test against a matrix of GitLab.com and at least one self-managed version before MVP release.
- Line-anchor and discussion API quirks may require instance-level feature detection (capability flags).
- Slightly more complex instance manager UI in the extension ([ADR-0002](0002-cursor-extension.md)).

### Neutral

- MVP PRD mentions "a single configured GitLab instance" (§11); the architecture supports multiple instances from day one, but MVP UI may expose only one active instance at a time.
- GitHub instance abstraction is out of scope; handled by a future `GitHubProvider` per [ADR-0004](0004-git-provider-abstraction.md).
