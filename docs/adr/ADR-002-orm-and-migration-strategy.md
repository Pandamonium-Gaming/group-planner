# ADR-002: ORM and Database Migration Strategy for Supabase Exit

## Status

Accepted

## Date

2026-05-21

## Context

The application currently performs extensive direct Supabase client operations from hooks, components, and library modules. The Supabase exit requires an app-owned Postgres access layer and managed schema migrations independent of Supabase tooling.

Current characteristics:

* Existing SQL migration history in `supabase/migrations`.
* 200+ Supabase call sites observed in `src` before search cap.
* Existing scripts and API routes reference Supabase environment variables.

## Decision

Adopt Prisma as the ORM and migration tool for the target stack.

Decision details:

* Database: Postgres owned by the application.
* Access model: server-only data access through API routes/server actions.
* Migration tooling: Prisma migrations as the canonical forward migration path.

## Why This Decision

* Strong TypeScript support and ecosystem maturity.
* Clear migration workflow and team onboarding path.
* Good fit for incremental migration from direct client calls to service/repository abstractions.

## Alternatives Considered

### A) Drizzle

Pros:

* Lightweight runtime.
* SQL-first ergonomics.

Cons:

* Team migration ergonomics may vary.
* Additional decision overhead for mixed SQL + migration workflow conventions.

Reason not chosen:

* Prisma offers a more standardized migration path for this codebase and team profile.

### B) Raw SQL + custom migration runner

Pros:

* Maximum control.

Cons:

* Higher maintenance and consistency burden.
* Slower developer velocity and higher onboarding cost.

Reason not chosen:

* Unnecessary complexity for this migration.

## Consequences

Positive:

* Single typed data access layer and schema source.
* Predictable migration process outside Supabase.
* Better testability at repository/service boundaries.

Negative:

* Initial translation effort from existing schema/migration conventions.
* Potential query rewrites for Supabase-specific patterns.

## Implementation Notes

* Introduce Prisma schema and baseline migration derived from current Postgres state.
* Add repository/services per domain and migrate consumers incrementally.
* Keep a temporary compatibility map between old Supabase tables/views and new Prisma models during transition.

## Acceptance Criteria

* Prisma migration workflow can provision local/dev database from scratch.
* Core read/write paths for first migration slice run through Prisma-backed services.
* No direct client-side database access is needed for migrated domains.
