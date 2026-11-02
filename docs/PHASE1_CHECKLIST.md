# Phase 1 Checklist - Supabase Exit

Date created: 2026-05-21

## Objective

Execute Phase 1 (abstraction seam) in a non-breaking way, with a clear PR sequence, explicit owners, and measurable acceptance criteria.

## Roles

* Owner placeholders:
  * `@auth-owner`: Auth.js and session path
  * `@api-owner`: API route and service implementation
  * `@data-owner`: Repository/ORM seam and migration mapping
  * `@qa-owner`: Test parity and rollout validation

## PR Sequence

### PR-01: Feature Flag and Scaffolding

* Target window: 2026-05-22 to 2026-05-23
* Primary owner: `@api-owner`
* Scope:
  * Add runtime flag for auth stack selection (for example `AUTH_STACK=v1|v2`).
  * Add initial server folder conventions for services/repositories.
  * Add no-op wiring in app startup/middleware paths (without switching behaviour).
* Acceptance criteria:
  * App behaviour unchanged with default flag value (`v1`).
  * Lint and tests pass.

### PR-02: Auth.js Discord Bootstrap

* Target window: 2026-05-23 to 2026-05-26
* Primary owner: `@auth-owner`
* Scope:
  * Add Auth.js route handlers and Discord provider config.
  * Implement DB session setup and session helpers.
  * Add `GET /api/auth/session` normalized response shape.
* Acceptance criteria:
  * Successful login/logout in dev with Auth.js path when flag is `v2`.
  * Session revocation test path documented and validated (`docs/PR02_AUTHJS_VALIDATION.md`).
  * Lint and tests pass.

### PR-03: Profile Read Path

* Target window: 2026-05-26 to 2026-05-27
* Primary owner: `@data-owner`
* Scope:
  * Introduce `session-service` and `user-profile-repository` seam.
  * Add `GET /api/me/profile` and map to current profile contract.
  * Keep Supabase-backed path available behind `v1` flag.
* Acceptance criteria:
  * Profile parity verified against baseline fixture data.
  * Authenticated and unauthenticated response behaviour matches expected status codes.

### PR-04: Group Permissions Read Path

* Target window: 2026-05-27 to 2026-05-29
* Primary owner: `@api-owner`
* Scope:
  * Introduce `group-permissions-service` seam.
  * Add `GET /api/groups/:groupId/permissions`.
  * Resolve role from authoritative membership data and compute effective permissions.
* Acceptance criteria:
  * Role parity for `admin|officer|member|trial|pending` matches baseline fixtures.
  * Non-member and group mismatch cases return expected status codes.

### PR-05: Client Hook Integration (First Slice)

* Target window: 2026-05-29 to 2026-06-02
* Primary owner: `@auth-owner`
* Secondary owner: `@qa-owner`
* Scope:
  * Update `useAuth` and relevant permission/profile read consumers to call new endpoints under `v2`.
  * Keep fallback to current path when `v1`.
* Acceptance criteria:
  * No functional regression in settings/admin gating surfaces.
  * Lint/tests pass and first-slice parity checklist is complete.

## Cross-PR Test Checklist

* Unit tests:
  * Session normalization and identity mapping.
  * Permission resolution matrix by role.
* Integration tests:
  * Authenticated/unauthenticated responses for all first-slice endpoints.
  * Group mismatch and non-member behaviour.
* Regression checks:
  * `yarn lint`
  * `yarn test --runInBand`

## Go/No-Go Gate for Enabling `AUTH_STACK=v2`

* Go when all are true:
  * First-slice endpoint tests pass.
  * Role/permission parity matches baseline fixture dataset.
  * No auth-related error spike during staged test window.
* No-go if any are true:
  * Privilege escalation or unexpected denials.
  * Session invalidation delay or failure.
  * Repeated 401/403 regression pattern after enabling `v2`.

## Rollback Procedure

* Immediate action:
  * Set runtime flag back to `AUTH_STACK=v1`.
* Follow-up actions:
  * Capture failing request traces and parity diff.
  * Open remediation issue(s) linked to failed gate criteria.
  * Do not run destructive schema rollback during incident response.

## Status Tracker

Status key: `[ ]` not started, `[~]` in progress, `[x]` complete.

* `[x]` PR-01 Feature flag and scaffolding
* `[x]` PR-02 Auth.js Discord bootstrap (automated runbook checks, DB session revocation, and manual Discord login/logout verification completed on 2026-05-23)
* `[x]` PR-03 Profile read path (repository seam + `GET /api/me/profile` completed; live parity sign-off validated on 2026-05-23 with authenticated v2 session and profile contract response)
* `[x]` PR-04 Group permissions read path (service seam + `GET /api/groups/:groupId/permissions` completed with role parity and non-member status coverage on 2026-05-23)
* `[x]` PR-05 Client hook integration (updated `useAuth` and permissions/profile consumers for v2 endpoint reads with v1 fallback on 2026-05-23)
* `[x]` Go/no-go gate review completed (2026-05-23)
* `[ ]` PR-06 Runtime decoupling sprint (remove priority direct Supabase client coupling and route through app-owned API services)

## Go/No-Go Review (2026-05-23)

* Decision: **Go** (ready to enable `AUTH_STACK=v2` in staged rollout)
* Evidence:
  * ✅ Lint gate passes: `yarn lint` → `LINT_EXIT=0`
  * ✅ First-slice endpoint and regression tests pass: `yarn test --runInBand --silent` → `24/24` suites, `395/395` tests, `TEST_EXIT=0`
  * ✅ Role/permission parity checks pass via automated coverage:
    * `src/server/permissions/__tests__/group-permissions-service.test.ts`
    * `src/app/api/groups/__tests__/permissions-route.test.ts`
    * `src/hooks/__tests__/usePermissions.test.ts`
* Rollout note:
  * Enable `AUTH_STACK=v2` with staged monitoring for 401/403 error patterns and session revocation behavior.

## Staged Rollout Plan (Develop -> Vercel Dev)

This repository deploys dev builds from `develop` to Vercel automatically. Use that pipeline as the rollout vehicle for `AUTH_STACK=v2`.

### Stage A: Baseline Deploy (control)

* Goal: capture a short baseline window before flipping the flag.
* Steps:
  * Confirm Vercel dev environment has `AUTH_STACK=v1`.
  * Push a no-risk `develop` commit (docs/chore is fine) to trigger a fresh dev deployment.
  * Validate baseline auth paths:
    * `GET /api/auth/session`
    * `GET /api/me/profile`
    * `GET /api/groups/:groupId/permissions`
* Exit criteria:
  * No unusual 401/403 pattern.
  * No session-loop behavior after Discord login.

### Stage B: Enable v2 in Vercel Dev

* Goal: run the first real staged rollout in the automatically deployed dev build.
* Steps:
  * Set Vercel dev env var `AUTH_STACK=v2`.
  * Redeploy `develop` (or trigger redeploy from Vercel).
  * Execute smoke tests for:
    * login/logout
    * profile load and hydration
    * role-gated pages (admin/officer/member)
    * non-member and group-mismatch paths
* Exit criteria:
  * Permission outcomes match expected role matrix.
  * No privilege escalation or unexpected denials.

### Stage C: Observe + Decide

* Goal: confirm stability before wider promotion.
* Monitoring window:
  * At least one normal dev usage cycle after deploy.
* Watch for:
  * Repeated 401/403 spikes
  * Session invalidation lag/failure
  * Endpoint regressions on first-slice routes
* Decision:
  * If stable, mark v2 as the default for next promotion path.
  * If unstable, execute rollback immediately.

### Rollback Trigger and Action

* Trigger:
  * Any observed privilege escalation, persistent 401/403 spikes, or session breakage.
* Action:
  * Set Vercel dev env var `AUTH_STACK=v1`.
  * Redeploy `develop`.
  * Capture traces and parity diffs, then open remediation issue(s).

## PR-06 Focus Checklist (Next)

* Scope owner: `@api-owner` with support from `@auth-owner` and `@qa-owner`.
* Goal: remove high-impact direct Supabase runtime coupling in client surfaces.
* Scope expansion approved: include compatibility-first internal naming normalization (`clan/guild` -> `group`) during containerized Postgres migration.

### PR-06 Tracking Table

| Slice | Status | Primary owner | Supporting owners | Evidence / notes |
| --- | --- | --- | --- | --- |
| PR-06A Runtime decoupling | In progress | `@api-owner` | `@auth-owner`, `@qa-owner` | Priority hooks and settings/event/member surfaces |
| PR-06B Containerized Postgres rehearsal | Not started | `@data-owner` | `@api-owner`, `@qa-owner` | `docker-compose.stack.yml`, `.env.stack.example` |
| PR-06C Data migration + naming compatibility | Not started | `@data-owner` | `@api-owner`, `@qa-owner` | File-based dump/restore + `group` canonical naming |
| PR-06D App cutover to canonical contracts | Not started | `@api-owner` | `@auth-owner`, `@data-owner`, `@qa-owner` | Read-first cutover, then writes, then stabilization |

### PR-06A First Work Slice (Wave 1 - Locked)

Wave 1 goal:

* Remove direct client Supabase imports from the highest-impact runtime surfaces first (auth/session entry points, core group hooks, events/settings/member mutation paths).

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

Wave 1 acceptance evidence:

* Direct import inventory snapshot captured on 2026-05-24:
  * Hooks: 15 direct `@/lib/supabase` imports
  * Settings components: 5 direct imports
  * App pages: 3 direct imports
  * View components: 5 direct imports
* For Wave 1 files, direct imports are removed or wrapped behind app-owned API clients.
* Parity checks pass for session/profile, group data, members, events, and settings mutation flows.
* Gates: `yarn lint`, `yarn test --runInBand --silent`.

### PR-06A: Runtime decoupling (priority hooks/surfaces)

Execution items:

1. Replace client auth/session reads with API session paths in priority surfaces.
2. Replace direct client data writes in settings/events/membership slices with API-only calls.
3. Remove obsolete direct `@/lib/supabase` imports in touched files.
4. Add or update integration tests for migrated endpoints and fallback behavior.

Acceptance gate:

* Priority surfaces no longer call `supabase.auth.*` on the client.
* Endpoint parity confirmed for migrated reads/writes.
* `yarn lint` and `yarn test --runInBand --silent` pass.

Rollback checkpoint:

* Keep `AUTH_STACK=v1|v2` fallback active.
* On regression, switch to `AUTH_STACK=v1`, redeploy, capture parity diff, and log remediation tasks.

### PR-06B: Containerized Postgres rehearsal

Execution items:

1. Validate `docker-compose.stack.yml` and `.env.stack.example` as the canonical local stack path.
2. Start app+db together and verify API smoke checks against the stack.
3. Record environment/bootstrap notes for repeatable onboarding.

Acceptance gate:

* App + DB run together via Compose with no manual patch steps.
* Smoke checks for auth/session/profile/permissions succeed.

Rollback checkpoint:

* If stack health is unstable, pause cutover work and keep runtime on current Supabase-backed paths.

### PR-06C: Data migration + naming compatibility layer

Execution items:

1. Execute file-based Supabase export/import into containerized Postgres.
2. Introduce canonical `group/groups` naming in migration target structures.
3. Add compatibility views/aliases for legacy `clan/guild` contracts used by existing app paths.
4. Validate parity with row counts, FK/unique integrity checks, and representative domain queries.

Acceptance gate:

* File-based migration runbook is repeatable end-to-end.
* Canonical names are available without breaking existing contract consumers.
* Validation checks pass for groups, members, events, permissions, and builds domains.

Rollback checkpoint:

* Rebuild target DB from prior dump snapshot.
* Keep compatibility layer active and defer canonical-only cutover until parity is restored.

### PR-06D: App cutover to canonical contracts

Execution items:

1. Migrate app reads to canonical `group` contracts first.
2. Migrate writes after read parity is stable.
3. Remove fallback usage only after staged dev burn-in succeeds.
4. Defer deletion of compatibility views/aliases to a follow-up PR after production stability window.

Acceptance gate:

* No direct `@/lib/supabase` usage remains in priority PR-06 buckets.
* `yarn build`, `yarn lint`, and `yarn test --runInBand --silent` all pass.
* Staged dev rollout shows no auth callback/session regressions and no sustained 401/403 spikes.

Rollback checkpoint:

* Re-enable compatibility contract reads/writes and `AUTH_STACK=v1` as needed.
* Record rollback trigger, failed criterion, and corrected re-entry plan before retry.

PR-06 completion criteria:

* No direct `@/lib/supabase` usage remains in priority PR-06 buckets.
* App + DB can run together in Compose for local migration/cutover rehearsal.
* Supabase data migration runbook to containerized Postgres is documented and repeatable.
* No auth callback/session regressions in staged dev rollout.
* Endpoint parity behavior documented for migrated surfaces.
