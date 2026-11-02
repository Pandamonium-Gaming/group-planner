# PR-02 Auth.js Validation Runbook

Date: 2026-05-22

## Purpose

Provide a repeatable validation path for PR-02 acceptance criteria:

* Successful login/logout in dev with `AUTH_STACK=v2`.
* Session revocation path documented and validated.

## Scope Clarification (Why Supabase is still in setup)

PR-02 migrates authentication and sessions only.

* Auth/session path (`AUTH_STACK=v2`): Auth.js + Postgres adapter sessions.
* Domain data path (current): still Supabase-backed in this phase.

That means Supabase env vars can still be required for normal page rendering, while session state is validated from the Auth.js Postgres-backed endpoint (`/api/auth/session`).

## Setup Paths

Use one of these:

1. Docker-first (recommended): app + Auth.js session DB are started with Compose.
2. Local-only: run app on host and point Auth.js DB to your local Postgres.

## Prerequisites

* Dependencies installed: `corepack yarn install`
* Local env configured in `.env.local` with:
  `AUTH_STACK=v2`, `NEXT_PUBLIC_AUTH_STACK=v2`, `AUTH_SECRET=<strong-random-value>`, `AUTH_DISCORD_ID=<discord-oauth-client-id>`, `AUTH_DISCORD_SECRET=<discord-oauth-client-secret>`, `AUTH_SESSION_STRATEGY=database`, and `AUTH_DATABASE_URL=<postgres-connection-string>` (or `DATABASE_URL` fallback)
* Discord OAuth redirect URI configured in your Discord app:
  `http://localhost:3000/api/auth/callback/discord`

## Option A: Docker-first Setup (Recommended)

* Create `.env.local` from `.env.example` and set:
  * Supabase values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for current domain-data reads
  * Auth.js values (`AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`)
* Start Docker profile:

```powershell
docker compose -f docker/archived/pr02/docker-compose.pr02-auth.yml up -d
```

* Confirm services are healthy:

```powershell
docker compose -f docker/archived/pr02/docker-compose.pr02-auth.yml ps
```

* Open app at `http://localhost:3000`.

* Stop when done:

```powershell
docker compose -f docker/archived/pr02/docker-compose.pr02-auth.yml down
```

* If you need a clean DB reset:

```powershell
docker compose -f docker/archived/pr02/docker-compose.pr02-auth.yml down -v
```

Notes:

* Compose file forces `AUTH_STACK=v2` and wires Auth.js DB to the `authdb` container.
* Auth adapter tables are auto-created from `docker/archived/pr02/auth-db-init.sql` on first start.

## Option B: Local-only Setup

* Ensure Postgres is running locally and create a DB (example):

```sql
CREATE DATABASE guild_planner_auth;
```

* Initialize Auth.js tables with `docker/archived/pr02/auth-db-init.sql` (run once).
* Set `.env.local`:
  * `AUTH_STACK=v2`
  * `NEXT_PUBLIC_AUTH_STACK=v2`
  * `AUTH_SESSION_STRATEGY=database`
  * `AUTH_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guild_planner_auth`
  * `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`
  * `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (still needed in PR-02 for existing non-auth reads)
* Start app:

```powershell
corepack yarn dev
```

## Minimal Auth-focused Validation Mode

If you only want to verify Auth.js session behavior (not full app data reads):

* You can use placeholder Supabase values and focus checks on:
  * login/logout flow
  * `GET /api/auth/session`
  * session revocation behavior

Some non-auth UI sections may show data-load errors in this mode because domain endpoints are still Supabase-backed during PR-02.

## Smoke Test: Login and Session

1. Start app:
   * `corepack yarn dev`
2. Open app and click login.
3. Complete Discord consent.
4. Confirm redirect lands on `/` and user is shown as authenticated.
5. Validate normalized session response:
   * `GET http://localhost:3000/api/auth/session`
   * Expected shape:
     * `stack: "v2"`
     * `authenticated: true`
     * `user.id` present
     * `user.discordId` present (when provided by provider callback)

## Smoke Test: Logout

1. Click sign out in UI.
2. Confirm user is unauthenticated in header/UI.
3. Re-check session endpoint:
   * `GET /api/auth/session`
   * Expected: `authenticated: false`, `user: null`

## Session Revocation Test (Database Sessions)

Use this when `AUTH_SESSION_STRATEGY=database`.

1. Login and keep app open in browser tab A.
2. In DB, inspect active sessions for the current user.
3. Revoke sessions for that user by deleting rows in `sessions` table.

Example SQL:

```sql
-- Inspect active sessions for a user id
SELECT id, user_id, expires
FROM sessions
WHERE user_id = '<user-id>';

-- Revoke all sessions for that user
DELETE FROM sessions
WHERE user_id = '<user-id>';
```

1. In browser tab A, refresh page or perform an authenticated action.
2. Expected outcome:
   * Session endpoint returns unauthenticated.
   * UI transitions to logged-out state.
   * Protected actions fail with expected auth behaviour.

Docker helper command:

```powershell
docker exec -it guild-planner-authdb psql -U postgres -d guild_planner_auth
```

## Notes

* If `AUTH_SESSION_STRATEGY=jwt`, DB deletion does not apply. Use sign-out/token rotation strategy instead.
* Keep `AUTH_STACK=v1` as emergency rollback switch while PR-02 remains in staged rollout.

## Validation Log (2026-05-23)

Automated checks completed in local Docker profile (`docker/archived/pr02/docker-compose.pr02-auth.yml`):

* Service health check:
  * `guild-planner-app-pr02` running on `http://localhost:3000`
  * `guild-planner-authdb` healthy on port `5433`
* Session endpoint check:
  * `GET /api/auth/session` returned:
    * `stack: "v2"`
    * `authenticated: false`
    * `user: null`
* Session revocation path validated (database session strategy):
  * Pre-check: `sessions` table had 1 row
  * Revocation command executed: `DELETE FROM sessions;`
  * Post-check: `sessions` table had 0 rows
  * Post-revocation endpoint check remained unauthenticated as expected

Remaining manual check for full PR-02 acceptance sign-off:

1. Perform interactive Discord login in browser and verify `GET /api/auth/session` returns `authenticated: true` with populated user fields.
2. Perform interactive logout and verify `GET /api/auth/session` returns `authenticated: false`.

Manual check completion (2026-05-23):

* Interactive Discord login/logout flow was verified in browser.
* Confirmed expected forced logout behavior after sessions-table revocation (`DELETE FROM sessions`), matching PR-02 acceptance requirements.
