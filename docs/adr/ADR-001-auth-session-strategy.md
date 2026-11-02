# ADR-001: Authentication and Session Strategy for Supabase Exit

## Status

Accepted

## Date

2026-05-21

## Context

The application currently depends on Supabase Auth and client-side Supabase session flows. The Supabase exit plan requires app-owned authentication and session management, while preserving existing behaviour around Discord identity and role resolution.

Current characteristics:

* Discord is already the user login provider.
* Discord ID is already part of the ownership strategy.
* Hooks and UI currently rely on client-side auth/session checks.
* We need strong revocation and incident-response capability for moderation and access control.

## Decision

Adopt Auth.js with Discord as the authentication provider, using database-backed sessions.

Decision details:

* Provider: Discord OAuth via Auth.js provider.
* Session strategy: database sessions (not stateless JWT).
* Identity model:
  * `users.id`: internal UUID for relational integrity.
  * `users.discord_id`: immutable external identity key.
* Session payload should include stable identity and role context needed by server authorization checks.

## Why This Decision

* Supports immediate session revocation and better admin control.
* Improves incident response compared to long-lived JWT-only flows.
* Aligns with existing Discord-first identity model in the codebase.
* Reduces migration risk by preserving current conceptual auth behaviour.

## Alternatives Considered

### A) Auth.js with JWT sessions

Pros:

* Lower DB write volume for session handling.
* Simpler infrastructure shape.

Cons:

* Harder real-time revocation.
* Harder immediate propagation for permission-sensitive updates.

Reason not chosen:

* Revocation and administrative control are higher priority for this app.

### B) Keep Supabase Auth

Pros:

* Lower short-term change cost.

Cons:

* Does not satisfy Supabase exit objective.
* Maintains dependency on Supabase auth workflows.

Reason not chosen:

* Conflicts with migration objective.

## Consequences

Positive:

* Full control over auth/session behaviour.
* Better security operations (revocation, auditability).
* Clear contract between auth and authorization layers.

Negative:

* Session schema and lifecycle become app responsibilities.
* Requires migration of `useAuth` and related client flows to app endpoints/cookies.

## Implementation Notes

* Implement Auth.js route handlers and Discord provider configuration.
* Introduce middleware/session helpers for server-side authorization checks.
* Replace direct `supabase.auth.*` usage through an auth service boundary.

## Acceptance Criteria

* Users can log in with Discord and establish app-owned sessions.
* Session revocation works and is test-covered.
* Existing role and group membership checks produce parity results vs current behaviour.
