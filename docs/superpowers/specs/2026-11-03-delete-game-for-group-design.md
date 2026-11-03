# Permanently delete a game for a group — design

Status: draft for approval. Date: 2026-11-03. Decisions on the existing route and card button recorded below.

## Intent

A group that no longer plays, or intends to play, a game wants that game gone: no data kept, and the game no longer visible for the group. Archiving (existing) hides a game and keeps everything. This feature adds a second, deliberate step that erases it.

## Goals

- A group admin can permanently delete a game for their group, only after archiving it first (archive, then delete).
- Deletion erases all of that group's data for the game, leaving the group as if the game was never added.
- Deletion is all-or-nothing: either everything below is erased, or nothing is.
- A typed confirmation guards the action.
- The deletion is recorded as an admin Discord notification.

## Non-goals

- No built-in download, undo, or waiting period. (Admins can use the existing admin-only character export/import beforehand; no new export or import is built.)
- No deletion of other groups' data for the same game, or of the game itself from the app.
- No deletion of group-wide tables that carry no game tag (see "Left alone").
- No deletion of Discord messages already posted.

## Anti-goals

- Deleting another game's data, or any other group's data.
- A half-deleted game (some tables erased, others not) after an error.
- Leaking webhook URLs, tokens or role IDs into the notification or logs.
- Reachable from an active (non-archived) game, or by non-admins.

## Behaviour

1. In group settings, Game Management ([GameManagement.tsx](../../../src/components/settings/GameManagement.tsx)) keeps its Archive/Restore button. An archived game additionally shows **Delete permanently**.
2. The button opens a confirmation dialog that explains what is erased and that it cannot be undone. The admin must type the game's display name exactly; the confirm button stays disabled until it matches.
3. Confirming calls the API. On success the game disappears from the group's game list and the page refreshes; on failure the dialog stays open and shows a specific error (using the `code` + localised message pattern from [admin-errors.ts](../../../src/server/admin-errors.ts)).
4. The game can be added again later and starts blank.

## What is erased

Everything is scoped to `(group_id, game_slug)`.

| Erased | How |
|---|---|
| `members` (characters) | delete rows; cascades remove `member_professions`, `character_ships`, `party_roster`, `node_citizenships` and other member-owned rows |
| `events` | delete rows; cascades remove `event_rsvps`, `guest_event_rsvps` |
| `recruitment_applications` | delete rows |
| `game_ship_permissions` | delete rows |
| `discord_webhook_logs` | delete rows |
| `group_games` | delete the row (this is what removes the game from the group) |
| Per-game columns on `groups` | reset to column defaults (recruitment open/message/description, ranks enabled/custom ranks, Discord webhook URLs and role IDs, and equivalents) |

The set of per-game `groups` columns is hard-coded per game today (`aoc_*`, `sc_*`, `ror_*`, `wowforever_*`). The deletion function needs an explicit mapping from game slug to those columns. The builder must derive it from the migrations (004, 007, 008 and any later per-game columns) and from the game registry, and add a test that fails if a game's per-game column is missing from the mapping. [docs/ADDING_NEW_GAMES.md](../../ADDING_NEW_GAMES.md) should gain a line saying new games must register their columns here.

## Left alone (accepted by the product owner)

Group-wide tables with no game tag: `parties`, `announcements`, `siege_events`, `loot_systems`/DKP, `guild_banks`, `freeholds`, `caravan_events`, `alliances`, `activity_log`, `group_achievements`, `group_permission_overrides`. Some rows (for example a party whose roster was entirely deleted characters) may remain. This is accepted.

## Rules and constraints

- Only a group `admin` may delete; the game must be archived (`group_games.archived = true`); otherwise reject.
- The server re-checks admin role and archived state inside the database function, not only in the route, and locks the `group_games` row so concurrent archive/restore/delete cannot interleave.
- Implemented as a single Postgres function (SECURITY DEFINER, `search_path = ''`, `EXECUTE` granted to `service_role` only), following the pattern of the character-transfer function in migration 011 and the save functions in 015–017. Migration number 018.
- Confirmation text is validated on the server too: the request carries the typed name and the server compares it with the game's display name.
- **Route (decided):** rework the existing `DELETE /api/group/games` ([route.ts](../../../src/app/api/group/games/route.ts)) to run the new deletion function instead of removing only the `group_games` row. Request body: `{ groupId, gameSlug, confirmName }`. It stays admin-only. It returns 409 if the game is not archived and 400 if `confirmName` does not match the game's display name. No new route.
- **Remove the home-page card button (decided).** The red trash button on non-archived game cards ([page.tsx](../../../src/app/[group]/page.tsx), around line 455) and its `handleRemoveGame`/`removingGame` state are deleted. It removed only the `group_games` row, with no confirmation, and orphaned the game's data. Delete the now-unused `removeGameFromGroup` helper in [group-games.ts](../../../src/lib/group-games.ts) too; the settings dialog calls the API directly or through a new helper that sends the confirmation. Admins who used the card button now archive first, then delete from Game Management; record this behaviour change in the changelog.
- Errors use the stable-code pattern from admin-errors.ts, with localised strings in en-GB, es and nl.

## Notification

Add a new admin notification kind `game_deleted` (group destination: the group's private admin channel; no site-wide alert). It states the group, the game, and the actor, and never includes any URL, token or role ID. Adding a kind touches several places that currently hard-code the list; the builder must update all of them:

- `ADMIN_NOTIFICATION_KINDS` in [adminNotifications.ts](../../../src/lib/adminNotifications.ts) and the kind labels in all locales.
- The `kind` CHECK constraint on `admin_discord_notifications` (migration 015) and the hard-coded kind lists inside `save_admin_discord_preferences` (017) and the role-mention RPC (016); migration 018 must replace these.
- The payload builder in [admin-discord.ts](../../../src/server/admin-discord.ts).
- Category/role settings UI for groups (the new kind appears with the others and is enabled by default).

The deletion function inserts the notification itself, inside the same transaction. Note: resetting the game's webhook/role columns on `groups` fires the existing config-change trigger, which would add an extra `webhook_changed` alert. The builder should suppress that (for example by setting a session flag the trigger respects) so one deletion produces one alert.

## Testing expectations

- Database/migration tests following `scripts/__tests__/*-migration.test.mts`: the function exists, grants are service-role only, rejects non-archived games, wrong confirmation and non-admins, and erases only the target `(group, game)` while another game in the same group and the same game in another group are untouched.
- Route tests for 401/403/400/409/500 paths and specific error codes.
- Component tests: button only on archived games, confirm disabled until the name matches, error display.
- Mapping test for per-game `groups` columns (see above).

## Left to the builder

- Exact route shape and dialog layout, within existing UI patterns.
- How to suppress the duplicate `webhook_changed` alert.
- The complete list of member-owned and event-owned child tables; verify foreign keys cascade and delete explicitly where they do not.
- Whether any table beyond those above gained a `game_slug` column after migration 017 on this branch.

## Open risks

- Missing a per-game column or a newly added game-tagged table leaves residual data; the mapping test reduces but does not eliminate this.
- Irreversible by design. The only protection is archive-first and the typed name.
