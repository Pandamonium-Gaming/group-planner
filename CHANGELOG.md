# Changelog

## \[Unreleased]

### Changed

* Integrated main's subscriber ship fixes into develop and prepared the 0.3.0 release.

### Fixed

* Made the pre-push build log work with separate Git working trees and preserved failed build exit codes.

## \[0.3.0] - 2026-11-02

### Fixed

* Reconciled subscriber ship parsing across main and develop, preserving explicit subscription tiers,
  database ship IDs, duplicate variant filtering, and the current ship database format.

## \[0.2.8] - 2026-03-09

### Fixed

* **Ship name parsing bug in subscriber ships fetcher** - Fixed duplicate ship matching
  * Parser was matching both "Ursa" and "Ursa Medivac" from the same text, causing incorrect ship IDs
  * Now skips sub-names of already-matched longer ship names
  * Example: if "Ursa Medivac" is matched, "Ursa" is skipped to prevent the plain ursa from being added

## \[0.2.7] - 2026-03-09

### Fixed

* **March 2026 subscriber ships** - Removed base Ursa from Imperator tier
  * Only Ursa Medivac should be in the March subscriber promotions
  * Corrected Imperator tier: apollo-medivac, ursa-medivac (removed plain ursa)

## \[0.2.6] - 2026-03-09

### Fixed

* **Subscriber ship sync duplication** - Fixed sync to remove old ships before adding new ones
  * Sync function now deletes existing subscriber ships before upserting new ones
  * Prevents February ships from lingering when syncing to different months
  * Added `needsSubscriberShipResync()` helper to detect if resync is needed
  * Ships are now correctly replaced on each sync instead of accumulating

## \[0.2.5] - 2026-03-09

* **Subscriber ships debugging** - Added diagnostic console logging
  * Logs the detected month key and available months to console
  * Logs which ships are loaded for each tier
  * Helps troubleshoot month detection issues

### Fixed

* **Subscriber ships automation** - Fixed script and ship ID mapping
  * Fetch script now loads actual ship database instead of using hardcoded names
  * Ship names are now correctly mapped to database IDs (e.g., 'Apollo Medivac' -> 'apollo-medivac')
  * Eliminates incorrect `rsi-` prefix that was being added to ship IDs
  * Updated March 2026 ships with correct IDs: apollo-medivac, ursa-medivac, ursa
  * Future automated updates will now use correct ship identifiers

## \[0.2.1] - 2026-03-09

### Added

* **Customizable game rank settings per group**
  * Added group-level rank settings storage columns and migration: `supabase/migrations/007_game_rank_settings.sql`
  * Added `GameRankSettings` to game settings pages for:
    * Enabling/disabling rank usage per game
    * Defining custom rank names and order (highest to lowest)
  * Updated game rank management to use group-configured rank definitions instead of only static game config
  * Updated character create/edit rank dropdowns to use group-configured game rank definitions and respect per-game rank enabled toggles
  * Added shared helpers in `src/lib/gameRankSettings.ts` for rank column mapping, normalization, and effective rank resolution

* **PR-03 profile read endpoint and repository seam**
  * Added app-owned profile endpoint `GET /api/me/profile` in `src/app/api/me/profile/route.ts`
  * Added v2 session-cookie auth path and v1 bearer-token fallback for authenticated profile reads
  * Implemented profile repository seam in `src/server/users/user-profile-repository.ts` with create-on-miss support for legacy users
  * Added route tests for authenticated/unauthenticated behavior across v1/v2 auth modes in `src/app/api/me/profile/__tests__/route.test.ts`

* **Discord profile fields now refresh on login**
  * Updated Auth.js Discord sign-in flow to sync `users.discord_username` and `users.discord_avatar` for existing linked users on each login
  * Keeps existing custom `display_name` intact unless it was previously empty

* **PR-04 group permissions read path**
  * Added app-owned endpoint `GET /api/groups/:groupId/permissions` in `src/app/api/groups/[groupId]/permissions/route.ts`
  * Implemented authoritative permissions service seam in `src/server/permissions/group-permissions-service.ts` to resolve membership role from `group_members` and compute effective permissions from role defaults plus `group_permission_overrides`
  * Added route coverage for unauthorized/non-member/member responses in `src/app/api/groups/__tests__/permissions-route.test.ts`
  * Added service parity coverage for `admin|officer|member|trial|pending` and override application in `src/server/permissions/__tests__/group-permissions-service.test.ts`

* **PR-05 first-slice client hook integration**
  * Updated `usePermissions` to call `GET /api/groups/:groupId/permissions` under `AUTH_STACK=v2` and consume authoritative `role + permissions` snapshots
  * Preserved `v1` fallback behavior in `usePermissions` by continuing to read `GET /api/group/permissions` overrides with bearer-token auth
  * Updated `useAuth` v2 profile hydration to call `GET /api/me/profile` with safe fallback to session-derived profile fields
  * Added v2 client-hook coverage in `src/hooks/__tests__/usePermissions.test.ts`

* **Lint gate compatibility fixes for PR-05 rollout**
  * Updated `usePermissions` and `FleetView` effect scheduling to avoid `react-hooks/set-state-in-effect` lint errors while preserving behavior
  * Restored `yarn lint` pass status required by the phase go/no-go gate

* **General Docker container scaffolding**
  * Added multi-stage production `Dockerfile` for Next.js build and runtime
  * Added `.dockerignore` to reduce build context and exclude local artifacts
  * Added root `docker-compose.yml` for general local/prod-like container runs
  * Added build/run documentation to `README.md`

* **Production compose override profile**
  * Added `docker-compose.prod.yml` to layer production env-file, healthcheck, and resource metadata
  * Added production compose command examples to `README.md`

* **Production env template for containers**
  * Added `.env.production.example` with required app, Supabase, and Auth.js variables for containerized production runs
  * Clarified in `README.md` that current compose profiles include the app container only and expect an external/managed database

* **PR-06 containerized migration baseline (app + db)**
  * Added `docker-compose.stack.yml` to run the app with a co-located Postgres container for Supabase-exit migration rehearsal
  * Added `.env.stack.example` for stack bootstrap variables
  * Updated `docs/SUPABASE_EXIT_PLAN.md` and `docs/PHASE1_CHECKLIST.md` with a mandatory containerized migration rule and a file-based Supabase -> containerized Postgres runbook
  * Updated `README.md` with stack start/stop commands for the new app + db profile

* **Dockerfile Yarn 4 compatibility for container builds**
  * Updated `Dockerfile` to force `node-modules` linker during container install/build so compose images can build reliably under Yarn 4

* **Comprehensive Test Coverage for Discord ID Functions**
  * New test file: `src/lib/__tests__/character-lookup.test.ts` (38 tests)
  * Test coverage for `getCharacterByDiscordId()` - Discord ID lookup with user\_id fallback
  * Test coverage for `getCharactersByDiscordId()` - Multi-character queries
  * Test coverage for `getCurrentUserMainCharacter()` - Main character resolution with dual-path access
  * Test coverage for `checkCharacterResilience()` - Validation for disaster recovery resilience
  * Added `syncDiscordIdToMembers()` tests in `auth.test.ts` (8 tests)
  * All edge cases covered: no auth, missing Discord ID, database errors, non-blocking behaviour
  * 32 new tests added (321 → 353 total tests)
  * All tests passing

* **Discord ID Migration for Disaster Recovery Resilience (2 Consolidated Migrations)**
  * Phase 1 & 2: Schema and data population in single migration
    * Migration: `005_discord_id_schema_and_population.sql` ✅
    * Adds `discord_id` column with indexes
    * Populates from Discord OAuth metadata (auth.users) with identities table fallback
    * Tested on production backup restore: 1 member synced, 12 pending auth linkage
  * Phase 3: App-side Discord sync on login (non-blocking, gradual population)
    * Implementation: `syncDiscordIdToMembers()` in `src/lib/auth.ts` ✅
    * Integrated: `src/app/auth/callback/page.tsx` calls sync after session established ✅
  * Phase 4: Resilient character lookup helpers with dual-path access
    * Created: `src/lib/character-lookup.ts` with Discord ID + user\_id fallback ✅
    * Functions: `getCharacterByDiscordId()`, `getCurrentUserMainCharacter()`, `checkCharacterResilience()`
  * Phase 5: RLS policies with Discord ID-based fallback access
    * Migration: `006_discord_id_rls_policies.sql` ✅
    * New functions: `user_has_clan_role_by_discord()` for Discord-based access checks
    * Updated policies: Members can view/manage via auth UUID or Discord ID
    * Tested: Discord ID fallback working, functions callable
  * Phase 6: Optional - Deprecate user\_id entirely (future work)
  * Impact: Characters remain accessible after database restore even if auth UUID changes

* **Machine-enforced Copilot command compliance system**
  * `.copilot-rules.json`: Declarative rules for OS context, file policies, and violations
  * `validate-copilot-compliance.js`: Pre-commit validation script
  * `.github/workflows/copilot-compliance.yml`: CI workflow running on Windows, Linux, macOS
  * Enforces: OS-appropriate commands, CHANGELOG updates, translation sync
  * Prevents Unix commands (`head`, `grep`) being committed in Windows context
  * Provides clear violation messages with fixes for developers
  * Stops repeating broken patterns across conversations by using external validation

### Changed

* **Phase 1 PR-01 auth seam scaffolding (non-breaking)**
  * Added `AUTH_STACK`/`NEXT_PUBLIC_AUTH_STACK` migration flags in `.env.example` (default `v1`)
  * Added runtime auth-stack selector helpers in `src/lib/authStack.ts`
  * Added server seam scaffolding modules for upcoming migration slices:
    * `src/server/auth/session-service.ts`
    * `src/server/users/user-profile-repository.ts`
    * `src/server/permissions/group-permissions-service.ts`
  * Added no-op `v2` feature-flag branches in `useAuth` and auth callback while preserving current `v1` behaviour
  * Updated migration trackers: marked PR-01 complete in `docs/PHASE1_CHECKLIST.md` and advanced next actions in `docs/SUPABASE_EXIT_PLAN.md`

* **Phase 1 PR-02 Auth.js Discord bootstrap (in progress)**
  * Added Auth.js configuration and Discord provider bootstrap in `src/auth.ts`
  * Added Auth.js route handlers in `src/app/api/auth/[...nextauth]/route.ts`
  * Added normalized session endpoint `GET /api/auth/session` in `src/app/api/auth/session/route.ts`
  * Implemented v2 session resolution in `src/server/auth/session-service.ts`
  * Added v2-gated sign-in/sign-out/session wiring in `src/hooks/useAuth.ts` while preserving default `v1` behavior
  * Added Auth.js environment variables to `.env.example`
  * Added Docker-first validation stack (`docker-compose.pr02-auth.yml`) with Postgres bootstrap schema (`docker/auth-db-init.sql`)
  * Added step-by-step local and Docker setup guidance in `docs/PR02_AUTHJS_VALIDATION.md`

* **Archived PR-02 Docker validation assets**
  * Moved PR-02 compose profile to `docker/archived/pr02/docker-compose.pr02-auth.yml`
  * Moved Auth.js DB bootstrap script to `docker/archived/pr02/auth-db-init.sql`
  * Updated runbook and README references to use archived paths

* **Package manager standardization on Yarn**
  * Added/confirmed Yarn package manager metadata in `package.json`
  * Added `.npmrc` with `package-lock=false` to prevent npm lockfile churn
  * Removed `package-lock.json` and standardized lockfile source on `yarn.lock`
  * Updated key contributor docs to use Yarn commands in `README.md` and `.github/copilot-instructions.md`
  * Converted remaining `npx` command examples and operational scripts to Yarn invocations (Supabase CLI, Husky checks, and CI snippets)

* **Brand naming consistency**
  * Updated remaining product name references from "Guild Planner" to "Group Planner" across metadata, Discord webhook text, service worker branding, and project documentation headers

* **Dependency and tooling package bumps**
  * Runtime updates: `next` 16.1.6 → 16.2.6, `react`/`react-dom` 19.2.4 → 19.2.6, `@supabase/supabase-js` 2.94.1 → 2.106.1, `@vercel/analytics` 1.6.1 → 2.0.1, `lucide-react` 0.563.0 → 1.16.0
  * Tooling updates: `typescript` 5.9.3 → 6.0.3, `eslint-config-next` 16.1.6 → 16.2.6, `tsx` 4.21.0 → 4.22.3, `supabase` CLI 2.75.3 → 2.100.1
  * Test and quality tooling updates: `jest` 30.2.0 → 30.4.2, `jest-environment-jsdom` 30.2.0 → 30.4.1, `ts-jest` 29.4.6 → 29.4.10, `cspell` 9.6.4 → 10.0.0, `markdownlint-cli2` 0.20.0 → 0.22.1
  * CI workflow updates: bumped GitHub Actions to latest major versions (`actions/checkout@v6`, `actions/setup-node@v6`, `codecov/codecov-action@v6`, `actions/github-script@v9`, `peter-evans/create-pull-request@v8`) and moved workflow Node runtime to 22

### Fixed

* **Literal-string and image lint issues in filters and header pages**
  * Replaced remaining hardcoded filter option text in `src/components/characters/CharacterFilters.tsx` with translated text
  * Resolved `no-img-element` and literal-string lint findings in `src/app/page.tsx` and `src/app/events/page.tsx` by using localized labels and `next/image`

* **Auth.js session-mode env hardening for Vercel deployments**
  * Updated `src/auth.ts` to normalize `AUTH_SESSION_STRATEGY` values (trim + lowercase), so values like `JWT` or `jwt` with trailing whitespace no longer silently fall back to database mode
  * Removed implicit fallback from `AUTH_DATABASE_URL` to `DATABASE_URL`, preventing unrelated platform-level `DATABASE_URL` values from unexpectedly enabling the Postgres adapter
  * Helps avoid callback failures where runtime attempted DB adapter queries despite intended JWT-only mode

* **Build-time TypeScript guardrails for group events route**
  * Fixed strict typing mismatches that could fail `next build` in:
    * `src/app/api/group/events/route.ts`
    * `src/app/api/group/members/route.ts`
    * `src/app/api/group/settings/route.ts`
    * `src/app/api/group/ships-overview/route.ts`
    * `src/hooks/useGroupData.ts`
  * Added a local Husky pre-push gate (`.husky/pre-push`) to run `yarn build` before push, preventing source-level build regressions from slipping past test/lint-only local checks

* **v2 write-path bridge for events and announcements**
  * Extended `POST /api/group/events` with action-based mutations for events, RSVPs, and announcements
  * Added membership + permission enforcement on server-side event/announcement mutation paths
  * Updated `useEvents` to route all mutation operations through the API under `AUTH_STACK=v2` while preserving existing v1 Supabase flows

* **v2 write-path bridge for ship mutations**
  * Added `POST/DELETE /api/group/ships` for ship add/remove operations with session-based authorization and group ownership checks
  * Updated `FleetView` and `ShipsView` to use the ship mutation API under `AUTH_STACK=v2` while preserving v1 direct Supabase behavior

* **v2 write-path bridge for settings mutations**
  * Added `POST /api/group/settings` for controlled settings writes (`groups` fields + recruitment application review actions)
  * Enforced group membership and relevant permission checks (`recruitment_manage`, `settings_edit`, `settings_edit_roles`) on server-side settings mutations
  * Migrated recruitment and Discord settings save paths to use the settings API under `AUTH_STACK=v2`:
    * `RecruitmentSettings` (group recruitment config + application accept/reject)
    * `GameRecruitmentSettings` (game-scoped recruitment fields)
    * `GroupDiscordSettings` (guild-wide webhook and notification fields)
    * `ClanSettings` (game-scoped Discord webhook/role fields)

* **Restored direct reads for group games and members**
  * Rolled back the v2 API read bridge for `group_games` and `members` to restore the live game shell after 404s in `/api/group/games` and `/api/group/members`
  * Keeps the new v2 write bridges intact while returning these core reads to the known-working direct Supabase path

* **Disabled service worker caching in development**
  * Updated root layout to unregister existing service workers and clear caches when not running in production
  * Prevents stale client bundles from keeping old API calls alive after container restarts in local development

* **Restored v2 member read bridge with fallback**
  * Re-enabled `useGroupData` to load members through `GET /api/group/members` under `AUTH_STACK=v2`
  * Falls back to the direct Supabase query if the API path fails, so character data can recover instead of staying blank

* **Archive status no longer throws on missing game rows**
  * Switched `isGameArchived()` to `maybeSingle()` so groups without an explicit `group_games` row no longer emit 0-row errors during layout load

* **PR-02 Auth.js runtime compatibility with `next-auth` v4**
  * Replaced v5-style `handlers/auth` export usage with v4-compatible `authOptions` + `getServerSession` in `src/auth.ts`
  * Updated App Router auth route wiring in `src/app/api/auth/[...nextauth]/route.ts` to use `NextAuth(authOptions)` handler exports
  * Fixes local/Docker runtime `500` errors on `GET /api/auth/session` caused by incompatible Auth.js API shape

* **Discord auth loop in database-session mode**
  * Fixed a null-safety bug in `src/auth.ts` where the NextAuth `session` callback accessed `token.discordId` even when `token` is undefined for database sessions
  * Resolves recurring `[next-auth][error][SESSION_ERROR] Cannot read properties of undefined (reading 'discordId')` and subsequent re-auth loops after Discord login

* **Auth.js to legacy user reconciliation for role/membership checks**
  * Added Discord account resolution from Auth.js `accounts` table and legacy `users.id` lookup by `discord_id` in `src/auth.ts`
  * Session now exposes the reconciled legacy user id so existing group membership/admin authorization logic continues to recognize existing accounts
  * Configured NextAuth sign-in page override to use `/login` instead of the default provider page
  * Added auto-provisioning of legacy `users` rows for first-time Discord logins without an existing legacy user id (keyed by `discord_id`)

* **Group game visibility fallback for unconfigured groups**
  * Updated group and game layouts to show all available games when a group has no `group_games` rows yet
  * Prevents empty game lists in local/dev environments before explicit game configuration is added

* **v2 auth bridge for group game management**
  * Added `GET/POST/DELETE /api/group/games` backed by NextAuth session + service-role Supabase access for group membership authorization
  * Updated `src/lib/group-games.ts` to use the new API under `AUTH_STACK=v2`, avoiding client-side Supabase RLS failures during game add/remove/list operations

* **v2 auth bridge for character visibility**
  * Added `GET /api/group/members` backed by NextAuth session + service-role Supabase access with group membership checks
  * Updated `src/hooks/useGroupData.ts` to load characters via the API when `AUTH_STACK=v2`, resolving empty character lists caused by client-side Supabase RLS

* **v2 auth bridge expansion for ships, events, and permissions settings**
  * Updated `GET /api/group/ships-overview` and `GET/POST /api/group/permissions` to accept NextAuth session cookies (with bearer-token fallback for v1 compatibility)
  * Added `GET /api/group/events` for v2-safe event/announcement reads
  * Updated `usePermissions`, `PermissionsSettings`, `ShipsView`, and `useEvents` to use cookie-auth API paths under `AUTH_STACK=v2`

* **Ships overview now loads group-wide data in v2 bridge**
  * Updated `GET /api/group/ships-overview` to fetch members by `group_id` without restricting by current `game_slug`
  * Prevents empty ship views when the active game tab has no character rows but the group does have ships in other game-scoped member records

* **Hangar view now uses v2-safe ships bridge**
  * Updated `FleetView` (`/[group]/[game]/hangar`) to load ship data from `GET /api/group/ships-overview` under `AUTH_STACK=v2`
  * Preserves v1 bearer-token and direct-query fallback paths
  * Fixes empty hangar state caused by client-side Supabase reads under v2 auth

* **Hangar ownership matching hardened for v2 identity reconciliation**
  * Updated `FleetView` player-character filtering to support both legacy `members.user_id` matching and Discord ID fallback (`members.discord_id` vs session `discordId`)
  * Uses API-returned character list as fallback when layout-provided character context is empty/stale

* **Hangar ship mapping now uses API character source first**
  * Updated `FleetView` to prefer `characters` returned by `GET /api/group/ships-overview` when building per-character ship maps
  * Prevents false "No ships added yet" states when route/context character lists are narrower than ship overview scope

* **Hangar ownership now uses server-resolved character IDs**
  * Updated `GET /api/group/ships-overview` to include `discord_id` in character payload and return `ownCharacterIds`
  * Updated `FleetView` to prioritize `ownCharacterIds` when deciding which characters belong to the current user
  * Fixes cases where client-side ownership matching failed under v2 identity reconciliation

* **Hangar ownership reconciliation across linked legacy user IDs**
  * Enhanced `GET /api/group/ships-overview` to resolve all `users.id` values linked to the active session Discord account (`users.discord_id`)
  * `ownCharacterIds` now matches by both character `user_id` in the resolved linked-ID set and `members.discord_id` fallback
  * Addresses restored/legacy UUID mismatch scenarios where membership exists but character ownership used a sibling linked user ID

* **Hangar non-blank fallback for unresolved ownership sessions**
  * Updated `FleetView` to render ship-owning characters when personal ownership matching resolves no characters but ship data is present

* **Game settings writes now persist with linked v2 identities**
  * Updated `POST /api/group/settings` membership resolution to authorize against all legacy `users.id` records linked by `discord_id`, not only a single resolved user id
  * Prevents false `403 Forbidden` saves when Auth.js v2 sessions reconcile to a sibling legacy user id in restored/migrated environments

* **Game rank dropdown updates now persist under v2 auth**
  * Added `POST /api/group/members` action `update_rank` with server-side authorization and linked-identity membership resolution
  * Updated `useGroupMembership.updateRank` to use `/api/group/members` under `AUTH_STACK=v2` (cookie auth), keeping direct Supabase writes for v1
  * Fixed `RankManagement` self-edit guard to compare against `member.user_id` (not membership row id)

* **Admins can now edit their own game rank**
  * Updated `RankManagement` to allow self-rank changes when the current user role is `admin`
  * Updated `POST /api/group/members` rank mutation guard to permit self-rank updates for admins while continuing to block self-edits for non-admin roles
  * Updated `src/app/[group]/[game]/tabs/ManageTab.tsx` so rank editing follows the same admin self-edit rule and no longer depends on role-edit visibility

* **Game member lists now sort by rank hierarchy then name**
  * Updated game rank management and game manage-tab member sorting to use game rank hierarchy descending, with display name as the tie-breaker
  * Rank order now follows configured game ranks (for Star Citizen: Admiral > Vice Admiral > Captain > Enforcer > Pirate > Lowlife > No Rank)

* **Rank dropdown option order now matches rank weighting**
  * Updated character and rank-management dropdowns to render rank options highest-to-lowest by hierarchy (instead of lowest-to-highest)

* **v2 character edit/delete no longer fail with false login guard**
  * Updated `useGroupData` to resolve current user id from `GET /api/auth/session` when Supabase client auth is unavailable under Auth.js v2 cookie sessions
  * Fixes "You must be logged in to update a character" / delete guard errors in v2 mode while preserving v1 Supabase auth behavior

* **Character edit modal rank changes now persist across rank-management views**
  * Added members API action `update_user_rank` to update `group_members.guild_rank` by target user id with the same server-side permission enforcement
  * Updated `useGroupData.updateCharacter` to sync rank changes from character edit modal into `group_members.guild_rank` for admin/officer edits, keeping modal rank edits and rank-management ordering in sync
  * Fixed `update_user_rank` API update filter to use resolved target membership id instead of `payload.membership_id` (which is not present for that action), preventing `invalid input syntax for type uuid: "undefined"`
  * Added members API action `update_character_rank` and switched v2 character modal rank updates to this server path so rank changes persist even when client-side Supabase updates are restricted by RLS
  * Updated character card rank display to resolve rank labels from group-configured custom ranks (instead of static game config), preventing raw rank IDs from showing in the UI
  * Fixed game-rank fallback behavior for RoR so it no longer inherits AoC default ranks when no custom RoR ranks are configured
  * Hardened rank label fallback so unknown token-like rank values (e.g. legacy ids) render as empty (`—`) instead of raw values, while preserving readable legacy labels
  * Adds a visible warning banner so ownership reconciliation issues are explicit instead of showing a misleading empty state

* **Hangar data-load effect stabilized**
  * Updated `FleetView` to trigger ship loading from a stable character-ID dependency key instead of a zero-timeout effect tied to unstable array references
  * Prevents canceled/deferred loads that could leave hangar stuck on "No ships added yet" despite available ship data

* **Group page add-game CTA UX refinement**
  * Hid the top header Add Game button when no games are enabled to avoid duplicate CTAs with the empty-state button
  * Increased spacing between available-games copy and header-level Add Game action for clearer visual separation

* **CI lint blockers in filters and landing headers**
  * Replaced remaining hardcoded filter/header literals with i18n keys in `CharacterFilters`, home, and public events surfaces
  * Replaced flagged `<img>` usages with `next/image` in `src/app/page.tsx` and `src/app/events/page.tsx`
  * Added matching locale keys in `public/locales/en-GB.json`, `public/locales/es.json`, and `public/locales/nl.json`

* **Hook test-suite warning cleanup (no suppression)**
  * Stabilized async fetch behaviour in hooks by removing deferred timer-based initial fetches in `useBuilds`, `useGroupData`, and hardening session/cleanup flow in `usePermissions`
  * Fixed multiple hook test mock-chain mismatches that produced runtime warnings like `...is not a function` (Supabase fluent query mocks now match actual query shape in targeted tests)
  * Updated async hook tests to properly await lifecycle updates or wrap hook-mutating calls in `act(...)`, eliminating `not wrapped in act(...)` warnings in affected suites

* **Character lookup profession typing**
  * Fixed `member_professions` transformation in `character-lookup` by narrowing unknown rows to valid `MemberProfession` objects before assigning to `CharacterWithProfessions.professions`
  * Resolves `Type 'unknown[]' is not assignable to type 'MemberProfession[]'` at the character transformation step

* **Build-blocking game tracking relation typing**
  * Fixed `getUserGroupsForGame` mapping in `gameTracking` to handle Supabase relation shape safely when `clans` is returned as an array/object/null
  * Resolves TypeScript incompatibility during production build for group membership relation mapping

* **Subscriber ships auto-sync reliability**
  * Fixed Star Citizen subscriber tier change handling to compare against the pre-update tier value, ensuring add/remove sync logic runs correctly
  * Added a scheduled background sync endpoint (`/api/sync/subscriber-ships`) to apply current-month subscriber ships for all subscriber characters automatically
  * Added Star Citizen loaner reconciliation to the same sync cycle to check pledged-to-loaner mappings and repair missing/stale auto-managed loaner entries
  * Added Vercel cron schedule to run subscriber ship sync daily and update each character's `subscriber_ships_month`
  * Corrected May 2026 subscriber ship data from RSI post `21023-May-2026-Subscriber-Promotions` (Centurion: Dragonfly Black, Imperator: Cutlass Black + Dragonfly Black)
  * Improved subscriber fetch parser to support current RSI "Centurion Subscribers / Imperator Subscribers" text blocks and map ships to canonical app ship IDs
  * Updated sync skip logic to re-validate existing `subscriber` ownership rows before skipping, so stale May ship rows are repaired even when `subscriber_ships_month` is already current
  * Fixed loaner matrix refresh script to run in Node/tsx environments (removed `Bun.write` dependency), parse current RSI markdown table rows, and normalize ship names to canonical IDs
  * Changed loaner matrix updates to a direct data sync workflow (`npm run update-loaners`) that refreshes `sc_loaner_matrix` from RSI without creating new schema migrations
  * Added preview mode (`npm run update-loaners:preview`) and SQL snapshot output (`scripts/generated/refresh_sc_loaner_matrix.sql`) for auditing/manual fallback
  * Removed accidental generation of `supabase/migrations/070_populate_sc_loaner_matrix.sql`; historical 070 remains in `supabase/migrations_archive/` and baseline source comments only

* **Build type-check regressions after dependency update**
  * Fixed `group_members` insert payload typing in `applyToGroup()` by normalizing payload shape and using `approved_at: null` for pending memberships
  * Fixed `SubscriberTier` type import in `/api/sync/subscriber-ships` to import from `src/lib/subscriberShips.ts` (source of the exported type)
  * Resolved CI lint runtime crash (`react/display-name` / `contextOrFilename.getFilename`) by pinning `eslint` to a Next-compatible v9 release
  * Verified with full local install + production build (`npm install` and `npm run build`)
  * Fixed CI lint error in group landing page by changing `loadGroupGames` to a hoisted function declaration before first use (`react-hooks/immutability`)
  * Fixed additional declaration-order lint blockers in public and fleet views (`FleetView`, `PublicClanEventsView`, `PublicEventsView`) and removed their `Cannot access variable before it is declared` errors
  * Fixed a batch of `react-hooks/set-state-in-effect` lint blockers across settings and fleet components by deferring effect-triggered state hydration/fetch calls (`SettingsPage`, `BankTransactionForm`, `GuildIconUploader`, `ClanSettings`, `GameManagement`, `PermissionsSettings`, `RecruitmentSettings`, `ShipsView`)
  * Fixed remaining `react-hooks/set-state-in-effect` lint blockers across hooks by deferring effect-triggered resets and initial fetches (`useAchievements`, `useActivity`, `useAlliances`, `useBuilds`, `useCaravans`, `useEvents`, `useFreeholds`, `useGroupData`, `useGroupMembership`, `useGuildBank`, `useLootSystem`, `useNodeCitizenships`, `useSiegeEvents`)
  * Reduced warning noise with a low-risk cleanup pass: removed unused imports/variables, removed stale eslint-disable comments, tightened event typing in forms, and excluded generated `coverage/**` assets from linting
  * Reduced additional warning noise by scoping intentional static-copy exceptions to a handful of text-heavy UI pages/components (`GroupSettingsPage`, game settings, public events page, footer, game selector, migration banner)
  * Reduced type-warning noise by replacing several local `any` usages with concrete types in character filters, game switching, error handling, game tracking, and character lookup helpers
  * Rolled back the blanket literal-string suppressions and kept those warnings visible while fixing the TypeScript 6/Jest deprecation failure in CI

* Resolved 11 ESLint/TypeScript warnings across 4 files
  * **permissions/route.ts**: Replaced `(upsertError as any)` casting with proper `PostgrestErrorWithDetails` interface
  * **achievements/sync/route.ts**: Prefixed unused `gatheringSkills` variable with underscore
  * **ManageTab.tsx**: Replaced 2x `<img>` tags with Next.js `<Image>` component for improved LCP
  * **CharactersTab.tsx**: Replaced 4x `any` type annotations with proper types (`CharacterData`, `RankLevel`, `CharacterFilters`)
  * **CharactersTab.tsx**: Wrapped 2x hardcoded strings with i18n `t()` function, added translations for `characters.noCharactersFound` across all locales

* **Subscriber ships workflow** - Fixed PR creation and enhanced PR information
  * Organization-level policy updated to allow GitHub Actions to create and approve pull requests
  * Workflow now captures and displays subscriber post URL in PR for easy cross-referencing
  * Automated PR body now includes actual ship names (Centurion and Imperator tier lists)
  * Improved PR details with direct link to RSI source post

* Fixed route configuration and caching issues
  * Corrected Star Citizen route from `/sc/settings` to `/starcitizen/settings`
  * Added documentation that subscriber-ships.ts requires rebuild/redeploy to take effect (config cached at build time)
  * Added warning comment in config file explaining cache invalidation

## \[0.2.0] - 2026-03-09

### Added

* **Automated subscriber ship updates** - GitHub Action that runs monthly to auto-fetch Star Citizen subscriber promotions and create PRs
  * Scheduled workflow runs 1st of each month at 10 AM UTC
  * Scrapes RSI comm-link for current month's subscriber ships
  * Auto-creates PR if successful, or creates reminder issue if fetch fails
  * Significantly reduces manual effort for monthly updates
  * See `docs/STAR_CITIZEN_SUBSCRIBER_UPDATES.md` for details

## \[0.1.3] - 2026-02-13

### Fixed

* Fleet management now allows adding the same ship with different ownership types (e.g., both loaner and pledged MOLE)

## \[0.1.2] - 2026-02-13

### Added

* Version number and build date/time displayed in footer (auto-injected from package.json at build time)
* Version bump enforcement for PRs to main branch (CI check prevents merging without version bump)

### Changed

* Standardized footer across all pages using InlineFooter component (group settings, public group page)
* Ship scraper now filters out paint/skin variants (removed 12 duplicate entries like "Argo Mole Carbon Edition")
* Ships now sorted alphabetically by name instead of by manufacturer

### Fixed

* Markdown linting error (MD024) in CHANGELOG.md by configuring siblings\_only mode for duplicate headings

## \[0.1.1] - 2026-02-12

### Added

* Public groups list on the home page for groups marked public.
* Admin setting to require approval for new members.
* Configurable starting role (trial or member) for new group members.
* Separate Group Settings page accessible from group root (`/[group]/settings`).
* Settings button in group header for admins to access group-wide settings.
* **Automated version management system with changelog validation**
  * `check-changelog.js` script validates CHANGELOG.md is updated with significant code changes
  * `version-bump.js` script automates semver version bumping and CHANGELOG updates with `--commit` flag for one-command releases
  * Pre-commit hook enforces changelog updates for significant changes
  * CI pipeline validates changelog is maintained
  * npm scripts: `version:patch`, `version:minor`, `version:major` for releases
  * Comprehensive [.github/copilot-instructions.md](.github/copilot-instructions.md) for AI assistant workflow automation
* **Automated translation sync validation**
  * `check-translations.js` script ensures all language files (en-GB, es, nl) have matching keys
  * Pre-commit hook prevents commits with out-of-sync translations
  * CI pipeline validates translation consistency
  * npm script: `check:translations` for manual verification
* **Testing infrastructure with Jest and React Testing Library**
* **Phase 1 authentication and permission system test suite: 133 passing tests**
  * Permission system tests (30 tests, 100% coverage)
  * Utility function tests (9 tests, 100% coverage)
  * Game validation tests (8 tests)
  * Authentication system tests (42 tests) - OAuth flows, user profiles, group membership, role management
  * usePermissions hook tests (40 tests) - permission checking, role management, custom overrides, security
* Test patterns for mocking Supabase, React hooks, and async operations
* Testing documentation: TESTING.md, TESTING\_QUICK\_REFERENCE.md, TESTING\_ROADMAP.md
* npm test scripts (test, test:watch, test:coverage) with 50% coverage thresholds
* Missing `guild_bank_manage` permission definition

### Changed

* New joins auto-approve with group-configured role when approval is disabled.
* Manual approval now assigns the group-configured starting role.
* Split settings into Group Settings (recruitment, permissions, games, icon, membership) and Game Settings (game-specific rank management, webhooks).
* Moved member management (accepting/rejecting, role updates, removal) to Group Settings.
* Game-specific settings pages now only show rank management for that game's members.
* Game-specific settings pages now link to Group Settings for group-wide configuration.
* Added `approval_required` and `default_role` flags on groups.

### Fixed

* Restored role colors and creator-first member sorting in member management lists.
* Bug where `guild_bank_manage` permission was referenced but not defined in PERMISSIONS constant
