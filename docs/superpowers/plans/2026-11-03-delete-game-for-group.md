# Delete a Game for a Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A group admin can permanently erase an archived game's data for their group, via a typed-name confirmation, with one admin Discord alert.

**Architecture:** One Postgres function (`delete_group_game`) does the checks, erasure, per-game settings reset and notification insert in a single transaction. The existing `DELETE /api/group/games` route is reworked to call it; Game Management gets a confirm dialog; the home-page remove button is deleted. A new `game_deleted` admin notification kind carries the alert.

**Tech Stack:** Next.js route handlers, Supabase (Postgres, service-role RPC), Jest, `node:test` migration tests against `GP_MIGRATION_TEST_DATABASE_URL`.

**Spec:** [docs/superpowers/specs/2026-11-03-delete-game-for-group-design.md](../specs/2026-11-03-delete-game-for-group-design.md)

## Global Constraints

- Work on branch `develop` in the worktree `J:\Projects\guild-planner-develop`; never touch `auth-v2-postgres`. Commit locally; do not push.
- Deletion is scoped to `(group_id, game_slug)`: another game in the same group and the same game in another group must be untouched.
- Only a group `admin` may delete, only when `group_games.archived = true`; the database function re-checks both and locks the `group_games` row (`FOR UPDATE`).
- Confirmation is the game's display name, exact match (case- and whitespace-sensitive), validated server-side. The server supplies the expected name from the game registry; never trust a client-supplied expected name.
- Function is `SECURITY DEFINER`, `SET search_path = ''`, `REVOKE ALL ... FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE ... TO service_role`, using `public.`-qualified names. Migrations start `BEGIN;` and end `COMMIT;` like 015–017.
- Left alone (never delete): `parties`, `announcements`, `siege_events`, `loot_systems`/DKP, `guild_banks`, `freeholds`, `caravan_events`, `alliances`, `activity_log`, `group_achievements`, `group_permission_overrides`.
- No webhook URL, token or role ID in the notification, logs or error responses. Errors use the `AdminError` code pattern from `src/server/admin-errors.ts` and are localised in en-GB, es and nl.
- Per-game `groups` column prefixes: `aoc_`, `sc_` (slug `starcitizen`), `ror_`, `wowforever_`.

## Review Focus

- Game never added to the group (no `group_games` row) → 404, not 409 or 500.
- Archive then restore between the UI's check and the delete → function re-checks under lock and rejects.
- `confirmName` with different case, trailing space, or empty → 400, nothing deleted.
- Officer, member, pending, or non-member callers → 403 with nothing deleted.
- Re-adding the game after deletion shows blank data and default settings (recruitment, ranks, webhooks).
- One deletion produces exactly one notification, not a second `webhook_changed`.
- Deleting a group with a very large game dataset still completes in one transaction (no partial state on timeout).

---

### Task 1: `game_deleted` notification kind

**Files:**

- Create: `supabase/migrations/019_admin_notification_game_deleted.sql`
- Modify: `src/lib/adminNotifications.ts`, `src/server/admin-discord.ts` (titles, colors, link section), `public/locales/{en-GB,es,nl}.json` (`adminNotifications.kinds.game_deleted`)
- Test: `src/server/__tests__/admin-discord.test.ts`, `scripts/__tests__/admin-discord-migration.test.mts`

**Interfaces:**

- Produces: kind string `'game_deleted'` (destination `'group'`) accepted by the `admin_discord_notifications.kind` CHECK, by `save_admin_discord_preferences`, and by `isAdminCategorySettings`/`isAdminRoleMentions`; `AdminNotification.changes` may hold `{ game: <display name> }`.

- [ ] **Step 1: Write failing tests.** In `admin-discord.test.ts`: `adminNotificationPayload` for kind `game_deleted` returns an embed whose title is "Game deleted" and whose fields contain the game name from `changes.game`; and `isAdminCategorySettings({ game_deleted: false })` is true. In the migration test: after applying 015–019, inserting a row with kind `game_deleted` succeeds and `save_admin_discord_preferences` accepts `{"game_deleted": true}`.
- [ ] **Step 2: Run** `npx jest src/server/__tests__/admin-discord.test.ts` and `GP_MIGRATION_TEST_DATABASE_URL=... node --test scripts/__tests__/admin-discord-migration.test.mts`. Expected: FAIL (unknown kind).
- [ ] **Step 3: Write migration 019.** Drop and re-add the `kind` CHECK on `admin_discord_notifications` with the existing ten kinds plus `game_deleted`; `CREATE OR REPLACE` the two functions that hard-code the kind list (`save_admin_discord_preferences` from 017, the group-roles function from 016) with the same bodies plus the new kind. Copy their bodies from those migrations unchanged except the list.
- [ ] **Step 4: Update TS and locales.** Add `'game_deleted'` to `ADMIN_NOTIFICATION_KINDS`; add title `'Game deleted'` and a colour to the title/colour maps in `admin-discord.ts`; render `changes.game` as a field named "Game"; link section for the kind is `''` (settings root). Add the localised label in all three locale files.
- [ ] **Step 5: Run** both test commands plus `npx jest`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: add game_deleted admin notification kind`.

### Task 2: Suppress the duplicate `webhook_changed` alert

**Files:**

- Create: `supabase/migrations/020_suppress_alert_flag.sql` (replaces `capture_admin_discord_change` from 015 with a flag check)
- Test: `scripts/__tests__/admin-discord-migration.test.mts`

**Interfaces:**

- Produces: when the transaction-local setting `app.suppress_admin_config_alert` equals `'on'` (set via `set_config('app.suppress_admin_config_alert','on',true)`), the trigger's final `ELSE` branch (groups webhook/role column changes) returns `NEW` without queuing anything. All other branches unchanged.

- [ ] **Step 1: Write the failing test.** In the migration test, apply 015–020: updating a `groups.*_webhook_url` queues one `webhook_changed` row; with the setting on in the same transaction it queues none.
- [ ] **Step 2: Run** the migration test. Expected: FAIL on the suppression case.
- [ ] **Step 3: Write migration 020.** `CREATE OR REPLACE FUNCTION public.capture_admin_discord_change()` with the 015 body (as it stands after 016/017 changes; check those migrations for modifications first) and one added early-return at the top of the config-change `ELSE` branch. Keep the existing `REVOKE`.
- [ ] **Step 4: Run** the migration test. Expected: PASS.
- [ ] **Step 5: Commit** `feat: allow suppressing duplicate config-change alerts`.

### Task 3: `delete_group_game` database function

**Files:**

- Create: `supabase/migrations/021_delete_group_game.sql`, `scripts/__tests__/delete-group-game-migration.test.mts`

**Interfaces:**

- Produces: `public.delete_group_game(p_group_id uuid, p_game_slug text, p_confirm_name text, p_expected_name text, p_actor_id uuid) RETURNS void`. Raises exceptions whose `MESSAGE` is exactly one of `NOT_ADMIN`, `GAME_NOT_FOUND`, `GAME_NOT_ARCHIVED`, `CONFIRMATION_MISMATCH`. Executable by `service_role` only.
- Order of checks: actor is `admin` in `group_members` → lock the `group_games` row (`FOR UPDATE`; none → `GAME_NOT_FOUND`) → `archived` true → `p_confirm_name = p_expected_name`.

- [ ] **Step 1: Write failing tests** (node:test, same schema-rewrite harness as the admin-discord migration test, applying baseline and migrations through 021). Tests by name:
  - `deletes only the target group and game`: seed two groups × two games with a member, event, RSVP, guest RSVP, profession, recruitment application, ship permission and webhook log each; after deleting group A / game X, A/X rows are gone (including cascaded children) and A/Y, B/X, B/Y counts are unchanged.
  - `leaves group-wide tables alone`: a party, announcement and alliance row for the group still exist.
  - `resets per-game groups columns to defaults`: set `<prefix>_recruitment_open`, `_recruitment_message`, `_webhook_url`, `_custom_ranks` etc. for the deleted game's prefix and a different value for another game's prefix; afterwards only the deleted game's columns equal column defaults.
  - `rejects`: non-admin (officer) → `NOT_ADMIN`; unknown game → `GAME_NOT_FOUND`; unarchived → `GAME_NOT_ARCHIVED`; `p_confirm_name` differing by case or trailing space or empty → `CONFIRMATION_MISMATCH`; each leaves all rows intact.
  - `queues exactly one game_deleted notification` for destination `group`, with `changes->>'game' = p_expected_name`, no URL text anywhere in the row, and zero `webhook_changed` rows.
  - `grants`: `anon`/`authenticated` cannot execute; `service_role` can.
- [ ] **Step 2: Run** `GP_MIGRATION_TEST_DATABASE_URL=... node --test scripts/__tests__/delete-group-game-migration.test.mts`. Expected: FAIL (function missing).
- [ ] **Step 3: Write migration 021.** Per spec table: delete `members`, `events`, `recruitment_applications`, `game_ship_permissions`, `discord_webhook_logs` for `(group, game)`, then delete the `group_games` row; verify the foreign keys cascade children (RSVPs, guest RSVPs, professions, roster, ships); where a child lacks a cascade, delete explicitly before its parent. Reset per-game `groups` columns with `SET col = DEFAULT` in one static `CASE p_game_slug` branch per game; unknown slugs reset nothing. Call `set_config('app.suppress_admin_config_alert','on',true)` before that reset. Insert the notification row last (`kind 'game_deleted'`, destination `'group'`, `destination_id` from `group_admin_discord`, `actor_id`, `subject_name` = `p_expected_name`, `changes` = `{"game": p_expected_name}`).
- [ ] **Step 4: Run** the migration test. Expected: PASS.
- [ ] **Step 5: Add the mapping guard.** Test `every game slug in src/config/games and every slug present in group_games migrations has a branch in migration 021`, reading the SQL text and the config directory; it fails when a registered game has no branch or the slug differs (note `star-citizen` vs `starcitizen`; resolve which slug `group_games` actually stores and branch on that).
- [ ] **Step 6: Run** the full migration tests. Expected: PASS.
- [ ] **Step 7: Commit** `feat: add delete_group_game database function`.

### Task 4: Rework `DELETE /api/group/games`

**Files:**

- Modify: `src/app/api/group/games/route.ts`, `src/server/admin-errors.ts` (codes `game_not_found`, `game_not_archived`, `game_confirmation`, `game_delete`), `public/locales/{en-GB,es,nl}.json` (`adminNotifications.errors.*` are for site settings; add `gameManagement.errors.*` instead)
- Test: `src/app/api/group/games/__tests__/route.test.ts`

**Interfaces:**

- Consumes: `delete_group_game` RPC from Task 3; game display name from the game registry in `src/config` (find the existing lookup by slug).
- Produces: `DELETE /api/group/games` body `{ groupId: string, gameSlug: string, confirmName: string }`. Responses: 200 `{ success: true }`; 400 `{code:'game_confirmation'}` or missing fields; 401; 403; 404 `{code:'game_not_found'}` (also for an unknown slug); 409 `{code:'game_not_archived'}`; 500 `{code:'game_delete'}`. Each error body is `{ error, code }`.

- [ ] **Step 1: Write failing route tests.** Mock `@/auth` and `@supabase/supabase-js` as in `admin-discord.test.ts`. Assert: RPC called with `p_expected_name` equal to the registry name (not the client's), and `p_actor_id` the session user; mapping of RPC messages to 403/404/409/400; unauthenticated → 401; non-admin role (checked in route before the RPC) → 403; missing `confirmName` → 400 without calling the RPC; unknown RPC error → 500 with code `game_delete` and the raw message only in the server log.
- [ ] **Step 2: Run** `npx jest src/app/api/group/games`. Expected: FAIL.
- [ ] **Step 3: Rework `DELETE`** to validate input, keep the existing `getAuthorizedMembership` admin check, call the RPC, and translate errors with `adminFailure`/`AdminError`. Keep `GET` and `POST` unchanged.
- [ ] **Step 4: Run** `npx jest`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: delete game data through the games API`.

### Task 5: Game Management dialog; remove the home-page button

**Files:**

- Modify: `src/components/settings/GameManagement.tsx`, `src/lib/group-games.ts` (add `deleteGameForGroup(groupId, gameSlug, confirmName): Promise<{ ok: true } | { ok: false; code: string | null }>` calling the route; delete `removeGameFromGroup`), `src/app/[group]/page.tsx` (remove the trash button, `handleRemoveGame`, `removingGame` state and the import), `public/locales/{en-GB,es,nl}.json` (`gameManagement.delete*` strings and `gameManagement.errors.*` from Task 4)
- Test: `src/components/settings/__tests__/GameManagement.test.tsx` (create or extend); update any `[group]` page test that referenced the button

**Interfaces:**

- Consumes: `DELETE /api/group/games` contract from Task 4.

- [ ] **Step 1: Write failing component tests.** (a) **Delete permanently** shows only on archived games; (b) the dialog's confirm button stays disabled until the typed text equals the game name exactly; (c) confirming calls `deleteGameForGroup` with the typed text, closes and removes the game from the list on success; (d) on `{ ok:false, code:'game_not_archived' }` the dialog stays open showing the localised message; (e) the home page no longer renders the "Remove this game from the group" control.
- [ ] **Step 2: Run** `npx jest src/components/settings src/app`. Expected: FAIL.
- [ ] **Step 3: Implement** the dialog (focus-trapped, Escape cancels, explains what is erased and that it is permanent, uses existing modal styling in the repo) and remove the old button and helper.
- [ ] **Step 4: Run** `npx jest` and `npx tsc --noEmit -p tsconfig.json` filtered to the touched files. Expected: PASS, no new type errors.
- [ ] **Step 5: Commit** `feat: add permanent game deletion dialog and remove home-page remove button`.

### Task 6: Docs and changelog

**Files:**

- Modify: `CHANGELOG.md` (Unreleased → Added/Changed/Fixed as appropriate; CRLF line endings), `docs/ADDING_NEW_GAMES.md` (new section: register the game's per-game `groups` columns in `delete_group_game` and update the mapping test), the spec (migration numbers are 019–021, not 019 only)

- [ ] **Step 1: Write** the changelog entries: new permanent delete (archive first, typed name, one admin alert, group-wide untagged tables are kept); removed the home-page remove button; the `DELETE /api/group/games` contract change.
- [ ] **Step 2: Run** `npm run` check scripts the repo uses for changelog/lint if present (`node scripts/check-changelog.js`), `npx eslint` on changed files, `npx jest`. Expected: all pass.
- [ ] **Step 3: Commit** `docs: document game deletion`.

## Self-review notes

- Spec coverage: erase table (T3), column reset and mapping test (T3), archive-first and typed name (T3, T4, T5), reworked route (T4), button removal (T5), notification kind and single alert (T1–T3), docs (T6).
- Deviations from the spec, decided in this plan: three migrations (019 notification kind, 020 alert-suppression flag, 021 deletion function) instead of one numbered 019, for reviewable units; the server supplies the expected display name to the function.
- Migrations must be applied to the prod Supabase project manually before the new code is deployed; deploying the route first yields a 500 `game_delete`.
