# Supabase Exit Plan

## Purpose

This document defines a practical migration plan to remove direct Supabase dependency from the application, including auth replacement, database ownership, and a low-risk cutover path.

## Scope

In scope:

* Replace Supabase Auth with Discord-first auth owned by this app.
* Replace Supabase client data access with app-owned server APIs and a direct Postgres layer.
* Migrate operational tooling and local/dev environments to Docker Compose.
* Preserve existing behaviour for permissions, group membership, character ownership, and auditability.

Critical execution rule:

* The migration target must support a fully containerized runtime where `app` and `db` are started together via Docker Compose.
* Supabase exit work must include a reproducible data-migration path from Supabase Postgres into the containerized Postgres target.

Out of scope for initial migration:

* Feature redesign.
* Large UI refactors unrelated to auth/data ownership.
* Immediate storage redesign unless required by bucket/file dependencies.

## Current Baseline (Phase 0 Discovery)

Findings from repository inspection:

* Supabase is deeply coupled in app/runtime code and tests (200+ direct references in `src` were observed before search output cap).
* Supabase environment usage appears across runtime and scripts (42 references to `NEXT_PUBLIC_SUPABASE*` / `SUPABASE_*` across source/docs/scripts/config).
* Existing migrations are in `supabase/migrations/` and include Discord ID migration + RLS policy evolution.
* Current auth and ownership model already uses Discord-linked identity fields, which lowers auth migration risk.

Key existing assets that reduce risk:

* Discord ID strategy is already documented and validated in `docs/DISCORD_ID_MIGRATION_PLAN.md`.
* Existing DB shape and entities are documented in `docs/DATABASE_ERD.md`.

## Target Architecture

### Auth

* Auth.js (NextAuth) with Discord provider.
* Session strategy:
  * Preferred: database sessions for revocation and admin control.
  * Alternative: JWT sessions if operational simplicity is prioritized.
* Canonical identity mapping:
  * Internal user ID (UUID) for app relations.
  * Discord ID as immutable external identity.

### Data

* App-owned Postgres connection (no client-side direct DB access).
* ORM/query layer:
  * Preferred: Prisma for ecosystem maturity and migration ergonomics.
  * Alternative: Drizzle for lighter runtime and SQL-first control.
* Server-only data access from API routes/server actions.

### Runtime/Operations

* Docker Compose for local/dev stack:
  * `app` (Next.js)
  * `db` (Postgres)
  * Optional: `redis`, `PgAdmin`/`adminer`
* Structured migrations via ORM migration tooling.

## Migration Strategy (Phased)

### Phase 0: Decision + Contract (now)

Goals:

* Lock technology choices.
* Define migration contract boundaries.
* Define acceptance criteria for cutover readiness.

Deliverables:

* Architecture Decision Record (ADR) for auth/session and ORM choice.
  * `docs/adr/ADR-001-auth-session-strategy.md` (accepted)
  * `docs/adr/ADR-002-orm-and-migration-strategy.md` (accepted)
* Identity contract (`users.id`, `users.discord_id`, session claims).
* Initial domain boundaries for repository/service interfaces.

### Identity and Session Contract

Canonical identity:

* `users.id` (UUID): internal, relational primary identity used by app tables and FK links.
* `users.discord_id` (string or bigint-normalized string): immutable external identity from Discord.
* `users.discord_id` must be unique globally.

Session contract (Auth.js, DB sessions):

* Session lookup key: Auth.js session token (database-backed).
* Required server session fields:
  * `user.id` (UUID)
  * `user.discordId`
  * `user.displayName` (nullable)
* Optional derived claims (resolved server-side per request or short-lived cache):
  * `activeGroupId`
  * `groupRole` (`admin|officer|member|trial|pending`)

Authorization contract:

* Authorization decisions are server-owned and must not rely solely on client claims.
* Group role checks are resolved from authoritative DB state (`group_members`) for protected operations.
* Discord identity is used for account linking and resilience; internal UUID remains FK source of truth.

Session lifecycle:

* Session creation: after successful Discord OAuth callback and user link/upsert.
* Session revocation: supported via DB session invalidation (global or targeted).
* Role-change propagation: protected endpoints must resolve role from DB at request time or bounded cache TTL.

Data invariants:

* Every authenticated principal maps to exactly one `users.id`.
* `users.discord_id` uniqueness is enforced at DB level.
* No domain table should depend on Discord OAuth token persistence.

### Phase 1: Abstraction Seam

* Introduce app-owned interfaces for auth/data operations.
* Keep Supabase implementation behind adapters temporarily.
* Convert direct component/hook dependencies to call domain services.

### Phase 2: Parallel Backend

* Implement Discord auth via Auth.js.
* Stand up Compose Postgres and ORM models/migrations.
* Implement first server API endpoints with app-owned authorization checks.

### Phase 3: Data Migration + Validation

* Export/import schema and data to app-owned Postgres.
* Validate counts and integrity (PK/FK/unique constraints).
* Optionally dual-read/dual-write for high-risk domains.

### Phase 4: Incremental Cutover

* Migrate domain by domain (auth, permissions, characters, events, etc.).
* Move hooks/components to app endpoints.
* Monitor and validate behaviour parity.

### Phase 5: Decommission Supabase

* Remove direct client dependency and env vars.
* Remove Supabase-specific runtime flows and scripts.
* Keep archived migration history for audit/rollback documentation.

## Phase 0 Tracker (Started)

Status key: `[ ]` not started, `[~]` in progress, `[x]` complete.

* `[~]` Inventory Supabase coupling and env dependencies.
* `[x]` Choose auth/session strategy (Auth.js DB sessions vs JWT) - ADR-001 accepted.
* `[x]` Choose ORM/migration tool (Prisma vs Drizzle) - ADR-002 accepted.
* `[x]` Define identity and authorization contract.
* `[x]` Define first migration slice (auth + permissions read path).
* `[x]` Define rollback strategy and go/no-go criteria.
* `[x]` Create dated Phase 1 checklist with PR sequence (`docs/PHASE1_CHECKLIST.md`).

## Phase 0 Decision Matrix

### 1) Auth/session

Option A: Auth.js + DB sessions (recommended)

* Pros: revocation, admin control, easier incident response.
* Cons: session table management and slightly more DB load.

Option B: Auth.js + JWT sessions

* Pros: simpler infra and fewer DB writes.
* Cons: harder revocation and role update propagation.

### 2) ORM/migrations

Option A: Prisma (recommended)

* Pros: strong ecosystem, migration workflow, good type-safety for teams.
* Cons: heavier generated client and occasional migration verbosity.

Option B: Drizzle

* Pros: lightweight, SQL-first clarity.
* Cons: team familiarity and migration ergonomics vary by workflow.

## Proposed Initial Defaults (to confirm)

* Auth: Auth.js + Discord provider + DB sessions.
* DB: Postgres in Docker Compose for local/dev.
* Data layer: Prisma + server-side repository/services.
* Cutover style: incremental, domain-by-domain (no big-bang rewrite).

## Acceptance Criteria for Completing Phase 0

* Technology choices are explicitly approved.
* Identity/session contract is documented.
* First migration slice is selected and sized.
* Risk register includes top 5 migration risks and mitigations.
* A dated Phase 1 implementation checklist exists.

## Risks and Mitigations

1. Auth parity regressions

* Mitigation: preserve Discord ID mapping and create parity tests around login, membership checks, and role resolution.

1. Authorization drift without RLS

* Mitigation: centralize authorization in server services and add role-based integration tests.

1. Data migration integrity

* Mitigation: scripted verification (counts, orphan checks, unique constraints, FK checks).

1. Feature freeze pressure

* Mitigation: incremental vertical slices with short-lived branch flags.

1. Test suite churn

* Mitigation: replace Supabase chain mocks with service-level test doubles gradually.

## Suggested First Slice (Phase 1 Candidate)

* Auth/session bootstrap.
* Group permissions read endpoint.
* Current-user profile read endpoint.

Reason: this validates identity + authorization early and unlocks downstream domain migration safely.

### First Slice Definition (Locked)

Scope boundaries:

* In scope:
  * Discord login callback and app-owned session issuance.
  * Current authenticated user profile read.
  * Group permission read for current user in active group.
* Out of scope:
  * Writes to recruitment/events/builds domains.
  * Bulk data migration and dual-write.
  * Storage/bucket migration.

Proposed endpoints and handlers:

* `GET /api/auth/session`
  * Returns normalized session payload (`user.id`, `user.discordId`, display fields).
* `GET /api/me/profile`
  * Returns app profile record for authenticated user.
* `GET /api/groups/:groupId/permissions`
  * Returns resolved role + effective permissions for authenticated user in group.

Service/repository modules to introduce:

* `src/server/auth/session-service.ts`
* `src/server/users/user-profile-repository.ts`
* `src/server/permissions/group-permissions-service.ts`

Consumer cutover targets (first slice):

* `useAuth` and auth callback flow.
* Existing permissions read path used by settings/admin gating.
* Current-user profile reads in app shell and settings surfaces.

Effort sizing (engineering days):

* Auth.js bootstrap + Discord provider wiring: 1.0-1.5 days.
* Session and profile endpoint implementation: 1.0 day.
* Group permissions endpoint + role resolution parity tests: 1.0-1.5 days.
* Hook/client integration and cleanup for slice: 1.0 day.
* Total estimated first-slice effort: 4.0-5.0 days.

Test plan and parity checks:

* Unit:
  * Session normalization and identity mapping.
  * Permission resolution for each role (`admin|officer|member|trial|pending`).
* Integration:
  * Authenticated and unauthenticated access for all three endpoints.
  * Group mismatch and non-member scenarios return expected status.
* Regression/parity:
  * Compare outputs against current Supabase-backed path for a fixed fixture dataset.

Go/no-go criteria for slice cutover:

* Go:
  * All new endpoint tests pass.
  * Existing `yarn lint` and `yarn test --runInBand` pass.
  * Role/permission parity matches baseline fixtures in all supported roles.
  * No increase in auth-related error rate during staged rollout window.
* No-go:
  * Any role mismatch causing privilege escalation or unexpected denial.
  * Session invalidation/revocation does not take effect immediately.
  * Repeated 401/403 spikes after enabling slice path.

Rollback strategy for first slice:

* Keep a runtime feature flag (example: `AUTH_STACK=v1|v2`) for endpoint/router selection.
* On failure, switch reads back to Supabase-backed auth/permission path.
* Preserve new tables/sessions for diagnostics; do not run destructive rollback migrations during incident response.
* Require post-rollback incident note with failed criteria and remediation tasks before reattempt.

## PR-06: Runtime Decoupling Sprint (Next)

Goal:

* Remove remaining high-impact direct Supabase runtime usage from client hooks/components and route all reads and writes through app-owned API services.

Scope:

* In scope:
  * Replace direct client-side Supabase auth/session reads in hooks and UI entry points.
  * Replace direct client-side Supabase data mutations in high-impact domains.
  * Define API parity checks for each migrated surface.
* Out of scope:
  * Full data-store replacement in one PR.
  * Bulk schema migration cutover.

Acceptance criteria:

* No direct `@/lib/supabase` imports remain in priority PR-06 target surfaces.
* Equivalent API endpoints exist for each replaced read/write path.
* A runnable Compose profile exists for app + Postgres (`docker-compose.stack.yml`) with documented env bootstrap.
* A documented migration runbook exists for Supabase -> containerized Postgres (file-based export/import).
* `yarn build`, `yarn lint`, and `yarn test --runInBand --silent` pass.
* Feature-flag fallback behavior remains available where required.

### Supabase Coupling Inventory (Current)

Observed runtime coupling areas (non-test sources):

* Client/runtime imports of `@/lib/supabase` remain widespread across hooks, components, app pages, and library actions.
* Server/API routes still initialize Supabase clients for service-role and anon token bridge operations.

Priority extraction buckets for PR-06:

1. Auth/session client coupling
   * Examples:
     * `src/hooks/useAuth.ts`
     * `src/app/auth/callback/page.tsx`
     * `src/app/page.tsx`
2. High-impact data hooks (read/write)
   * Examples:
     * `src/hooks/useGroupData.ts`
     * `src/hooks/useEvents.ts`
     * `src/hooks/useGroupMembership.ts`
     * `src/hooks/useBuilds.ts`
3. Settings and admin UI mutations
   * Examples:
     * `src/components/settings/RecruitmentSettings.tsx`
     * `src/components/settings/GroupDiscordSettings.tsx`
     * `src/components/settings/ClanSettings.tsx`
4. Game operations and logistics domains
   * Examples:
     * `src/hooks/useGuildBank.ts`
     * `src/hooks/useLootSystem.ts`
     * `src/hooks/useCaravans.ts`
     * `src/hooks/useFreeholds.ts`

### PR-06 Tracking Table

| Slice | Status | Primary owner | Supporting owners | Evidence / notes |
| --- | --- | --- | --- | --- |
| PR-06A Runtime decoupling | In progress | `@api-owner` | `@auth-owner`, `@qa-owner` | Priority hooks and settings/event/member surfaces |
| PR-06B Containerized Postgres rehearsal | Not started | `@data-owner` | `@api-owner`, `@qa-owner` | `docker-compose.stack.yml`, `.env.stack.example` |
| PR-06C Data migration + naming compatibility | Not started | `@data-owner` | `@api-owner`, `@qa-owner` | File-based dump/restore + `group` canonical naming |
| PR-06D App cutover to canonical contracts | Not started | `@api-owner` | `@auth-owner`, `@data-owner`, `@qa-owner` | Read-first cutover, then writes, then stabilization |

### PR-06A First Work Slice (Wave 1 - Locked)

Wave 1 target files:

1. `src/app/page.tsx`
2. `src/app/settings/page.tsx`
3. `src/hooks/useEvents.ts`
4. `src/hooks/useGroupData.ts`
5. `src/hooks/useGroupMembership.ts`
6. `src/hooks/useBuilds.ts`
7. `src/components/settings/RecruitmentSettings.tsx`
8. `src/components/settings/GroupDiscordSettings.tsx`
9. `src/components/settings/ClanSettings.tsx`
10. `src/components/views/PublicEventsView.tsx`

Current inventory evidence (captured 2026-05-24):

* Hooks with direct `@/lib/supabase` imports: 15
* Settings components with direct imports: 5
* App pages with direct imports: 3
* View components with direct imports: 5

Wave 1 acceptance checks:

* Wave 1 files no longer use direct `@/lib/supabase` imports for runtime paths.
* Equivalent API-backed read/write behaviors are validated for events/settings/member/group surfaces.
* `yarn lint` and `yarn test --runInBand --silent` pass before moving to Wave 2.

### PR-06A: Runtime decoupling (priority hooks/surfaces)

Implementation sequence:

1. Create API-first contract list for each priority bucket.
2. Migrate auth/session calls to API session endpoints only.
3. Migrate group/member/event/settings mutation paths to API-only calls.
4. Remove obsolete direct Supabase imports in touched surfaces.
5. Add or extend integration tests for migrated endpoints.

Acceptance checks:

* Priority auth/session surfaces no longer call `supabase.auth.*` on client.
* Priority mutation surfaces use API routes only under v2 path.
* Endpoint parity tests are updated and passing.

Rollback:

* Keep `AUTH_STACK=v1|v2` feature-flag fallback available for staged rollback.
* On regression, revert runtime flag to `v1`, redeploy, and record parity deltas before retry.

### PR-06B: Containerized Postgres rehearsal

Implementation sequence:

1. Validate stack artifacts (`docker-compose.stack.yml` and `.env.stack.example`) as canonical local setup.
2. Run app + db together in Compose and execute smoke checks for auth/session/profile/permissions.
3. Document reproducible bootstrap steps for contributors.

Acceptance checks:

* Containerized stack profile (`app + db`) runs end-to-end.
* Smoke checks pass without ad hoc local patches.

Rollback:

* If stack stability fails, pause cutover activities and keep traffic on Supabase-backed runtime.

Profile guidance:

* Use `docker-compose.stack.yml` for migration rehearsal and parity checks.
* Use `docker-compose.prod.stack.yml` only when you want the production app override layered onto the local Postgres stack.

### PR-06C: Data migration + naming compatibility layer

Implementation sequence:

1. Execute Supabase -> containerized Postgres file-based migration (dump to file, restore from file).
2. Introduce canonical `group/groups` naming in migration target structures.
3. Add compatibility views/aliases for legacy `clan/guild` contracts used by current app paths.
4. Validate parity using row counts, FK/unique checks, and representative domain queries.

Acceptance checks:

* Migration runbook is documented and validated on sample data.
* Canonical naming is available without breaking existing consumers.
* Parity checks pass for groups, members, events, permissions, and builds domains.

Rollback:

* Rebuild containerized DB from previous dump snapshot and keep compatibility layer active.

### PR-06D: App cutover to canonical contracts

Implementation sequence:

1. Migrate app reads to canonical contracts first.
2. Migrate writes after read-path parity is stable.
3. Re-run gate checks and record parity outcomes.
4. Defer removal of compatibility views/aliases to a follow-up stabilization PR.

Acceptance checks:

* No direct `@/lib/supabase` usage remains in priority PR-06 buckets.
* `yarn build`, `yarn lint`, and `yarn test --runInBand --silent` pass.
* Rollout notes updated in `docs/PHASE1_CHECKLIST.md` (or follow-on tracker).

Rollback:

* Re-enable compatibility contract paths and staged auth fallback as needed.
* Capture failed gate criteria and corrective actions before re-entry.

### Containerized Migration Runbook (PR-06)

Use file-based export/import to move data from Supabase Postgres to the containerized Postgres stack.

Safety rules:

* Do not perform direct source->target streaming writes.
* Always export to a local file first, then restore from file.

Example flow (PowerShell):

1. Start stack.

```powershell
Copy-Item .env.stack.example .env.stack
docker compose -f docker-compose.stack.yml up --build -d
```

1. Export from Supabase Postgres to file.

```powershell
pg_dump "<SUPABASE_POSTGRES_URL>" --data-only --no-owner --no-privileges --file supabase-data.sql
```

1. Restore into containerized Postgres.

```powershell
Get-Content supabase-data.sql | docker exec -i guild-planner-db psql -U postgres -d guild_planner
```

1. Validate target data.

```powershell
docker exec -it guild-planner-db psql -U postgres -d guild_planner -c "SELECT COUNT(*) FROM groups;"
docker exec -it guild-planner-db psql -U postgres -d guild_planner -c "SELECT COUNT(*) FROM members;"
```

1. Run app gates against stack.

```powershell
yarn build
yarn lint
yarn test --runInBand --silent
```

## Next Actions

1. Execute PR-06 Sequence step 1 by publishing API-first contract list per priority bucket.
2. Implement PR-06 step 2 (auth/session client decoupling) as the first commit slice.
3. Run parity tests and staged rollout checks after each bucket migration.
