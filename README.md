# Group Planner

[![CI](https://github.com/Pandamonium-Gaming/group-planner/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/Pandamonium-Gaming/group-planner/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Pandamonium-Gaming/group-planner/branch/develop/graph/badge.svg?token=YourCodecovToken)](https://codecov.io/gh/Pandamonium-Gaming/group-planner)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A comprehensive group management and planning tool supporting multiple MMOs.

> **Inspired by** the original [AoC Group Profession Planner](https://github.com/igonzalezespi/aoc-guild-profession-planner) by Iván González Espí

## Supported Games

* **Ashes of Creation** - Track all 22 professions (Gathering → Processing → Crafting)
* **Star Citizen** - Manage squadrons and ship hangars
* **Return of Reckoning** - Coordinate warband activities

## Features

* 🎮 Multi-game support with game-specific features
* 👥 Group/Squadron/Warband management with role-based permissions
* 📊 Group coverage matrix (AoC) and fleet overview (Star Citizen)
* 🛢️ Group bank, caravan, and economy tracking
* 📅 Event scheduling with RSVP system
* 🔐 Customizable role-based permissions per group
* ⚙️ Discord integration for notifications and recruitment
* ☁️ Cloud persistence - data syncs across all devices
* 🔗 URL-based routing - share group pages with easy access

## Quick Start

1. Clone the repository

2. Copy `.env.example` to `.env.local` and add your Supabase credentials

3. Run `yarn install`

4. Apply database migrations:

   ```bash
   # Login to Supabase
   yarn supabase login

   # Link to your Supabase project (migrations are in supabase/migrations/)
   yarn supabase link --project-ref your-project-ref

   # Apply all migrations to remote database
   yarn supabase db push
   ```

   If required at any point you can reset the database with:

   ```bash
   yarn supabase db reset --linked
   ```

5. Run `yarn dev`

6. Open `http://localhost:3000`

## Deployment

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for full instructions.

### Discord delivery and webhook logs

Apply [migration 013](./supabase/migrations/013_add_discord_webhook_logs.sql)
before deploying the webhook logging feature, separately in each environment.
The server requires `SUPABASE_SERVICE_ROLE_KEY` to write delivery records.

Event notifications use the game's events webhook, then its general webhook,
then the group webhook. Both authentication stacks use the same server endpoint.
All event sends load the saved event for ownership and cancellation checks;
the generic webhook proxy does not accept event or repost requests.
Delivery permissions include the group's saved role overrides.
Saving an event or announcement still succeeds if Discord delivery fails;
the warning does not mean another copy should be created.
Event creators and members with permission to edit any event can use
**Repost to Discord**. Reposts respect the group's notification switch.

Group administrators can open **Group settings → Discord webhook logs** for
paginated delivery history across games, including events, reposts,
announcements, tests, reminders and member welcomes. Logging covers future
attempts only; it does not reconstruct past failures or schedule reminders.
Records contain delivery metadata, HTTP status and sanitised diagnostics,
never webhook URLs, tokens or message payloads. A pending record means the
final delivery status is unknown: check the channel before retrying.
If the log cannot be created, delivery is stopped rather than sent untracked.

### Event class composition

Expand a member-view event to see class totals and a roster with separate
Attending and Maybe sections. Supported games are WoW Forever, Ashes of
Creation and Return of Reckoning; Star Citizen has no class composition panel.
WoW characters include their main spec, and Ashes classes use the saved
primary/secondary archetype combination. These are current profile values,
not snapshots taken at signup. Guests count by their recorded class.
Unlinked or deleted characters appear as unknown rather than being replaced
by the owner's main character. Declined signups are excluded.
The detailed class roster is not displayed on public event views.

Vercel runs installation and builds through Corepack, using the Yarn version
declared in `package.json`. Installation is immutable so deployments use the
committed `yarn.lock` rather than resolving newer dependency versions.

Discord OAuth uses `https://discord.com` as its issuer so callbacks containing
the `iss` parameter can be validated. Run the offline issuer and state
validation regression test with:

```powershell
node --import tsx --test scripts\__tests__\discord-issuer.test.mts
```

## Container Deployment

This repo now includes a general container path for running the app outside Vercel:

* [Dockerfile](./Dockerfile)
* [docker-compose.yml](./docker-compose.yml)

### Build and run with Docker

```powershell
docker build -t guild-planner:latest .
docker run --rm -p 3000:3000 --env-file .env.local guild-planner:latest
```

### Run with Docker Compose

```powershell
docker compose up --build -d
docker compose ps
docker compose logs -f app
docker compose down
```

Notes:

* The app container expects runtime environment values from `.env.local` by default in compose.
* A production override is available in `docker-compose.prod.yml` and expects `.env.production`.
* Start from `.env.production.example` when creating `.env.production`.
* The provided compose files run the **app container only**. Database services are expected to be external/managed and configured via `AUTH_DATABASE_URL` / `DATABASE_URL`.

### Containerized app + db stack (PR-06 migration target)

For Supabase-exit migration rehearsal, use the stack profile that runs both app and Postgres together:

* [docker-compose.stack.yml](./docker-compose.stack.yml)
* [.env.stack.example](./.env.stack.example)

```powershell
Copy-Item .env.stack.example .env.stack
docker compose -f docker-compose.stack.yml up --build -d
docker compose -f docker-compose.stack.yml ps
docker compose -f docker-compose.stack.yml logs -f app
```

Stop stack:

```powershell
docker compose -f docker-compose.stack.yml down
```

Remove stack including database volume:

```powershell
docker compose -f docker-compose.stack.yml down -v
```

Use this profile when you are validating migration behavior, data export/import, or endpoint parity.
It keeps the app and Postgres local and is the right choice for PR-06 rehearsal work.

### Production-like Compose profile

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

This profile adds:

* container healthcheck
* production env-file (`.env.production`)
* resource limits/reservations metadata for orchestrated deployments

### Production-like app + db stack

Use this when you want the production app settings plus a local Postgres container:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.prod.stack.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.prod.stack.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.prod.stack.yml logs -f app
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.prod.stack.yml down
```

This profile combines:

* production app settings from `docker-compose.prod.yml`
* local Postgres from `docker-compose.prod.stack.yml`
* the same app + db wiring used for migration rehearsal, but with prod compose metadata applied to the app container

Use this profile when you want to validate the production app settings against a local Postgres container.
If you are actively rehearsing Supabase exit migration steps, prefer the plain stack profile instead.

## PR-02 Auth.js Local Validation

For the in-progress Auth.js migration slice (`AUTH_STACK=v2`), use:

* [docs/PR02\_AUTHJS\_VALIDATION.md](./docs/PR02_AUTHJS_VALIDATION.md)

This includes both:

* Docker-first setup (`docker/archived/pr02/docker-compose.pr02-auth.yml`)
* Local-only setup (host app + local Postgres)

Important:

* PR-02 is an incremental migration stage, not full Supabase removal yet.
* Auth/session in `AUTH_STACK=v2` uses Auth.js + Postgres (adapter sessions).
* The app still reads domain data (groups, characters, settings, etc.) from Supabase until later phases.

## Cron Jobs and Manual Triggering

The app has two Vercel cron jobs configured in [vercel.json](./vercel.json):

| Job | Endpoint | Schedule (UTC) |
| --- | --- | --- |
| Achievements sync | `/api/sync/achievements` | `0 0 * * *` (daily at 00:00) |
| Subscriber + loaner sync | `/api/sync/subscriber-ships` | `10 0 * * *` (daily at 00:10) |

### Manual testing endpoints

Use your deployed site URL or local dev URL:

* `https://<your-domain>/api/sync/achievements`
* `https://<your-domain>/api/sync/subscriber-ships`

> There is currently **no separate loaners endpoint**. Loaner reconciliation runs as part of `/api/sync/subscriber-ships`.

Local development examples:

* `http://localhost:3000/api/sync/achievements`
* `http://localhost:3000/api/sync/subscriber-ships`

### Trigger examples (PowerShell)

```powershell
# GET (both endpoints)
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/sync/achievements"
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/sync/subscriber-ships"

# POST (subscriber sync endpoint also supports POST)
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/sync/subscriber-ships"
```

### Expected responses

* `/api/sync/achievements` returns summary counts like `clans` and `achievementsUpdated`.
* `/api/sync/subscriber-ships` returns separate summaries for `subscribers` and `loaners`.

## Development

### Testing

We use **Jest** and **React Testing Library** for comprehensive test coverage.

```bash
# Run all tests
yarn test

# Run tests in watch mode (auto-rerun on changes)
yarn test:watch

# Generate coverage report
yarn test:coverage
```

**Documentation**:

* [TESTING.md](./docs/TESTING.md) - How to write and run tests
* [TESTING\_ROADMAP.md](./docs/TESTING_ROADMAP.md) - Testing improvement plan
* [TESTING\_QUICK\_REFERENCE.md](./docs/TESTING_QUICK_REFERENCE.md) - Quick checklist for developers

**Current Coverage**: 133 tests passing with 100% coverage on tested modules (permissions 30, utils 9, gameValidation 8, auth 42, usePermissions hook 40)

### For AI Agents & Contributors

* **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** - Quick reference for code patterns, version management, and logging (start here!)
* **[.AI-INSTRUCTIONS.md](./.AI-INSTRUCTIONS.md)** - Comprehensive guide with lessons learned, security considerations, and troubleshooting

These documents cover critical lessons from development, including:

* Permission system specifics (common naming gotchas)
* Database migration best practices
* Role hierarchy and permission checks
* Changelog maintenance
* Common issues and solutions
* **PowerShell commands** (preferred over Unix-style commands)

### Development Environment

> This project uses **PowerShell** for command-line operations. Use PowerShell cmdlets instead of Unix commands (e.g., `Get-ChildItem` instead of `ls`, `Remove-Item` instead of `rm`).

## Tech Stack

* [Next.js 16](https://nextjs.org/) - React framework
* [Tailwind CSS](https://tailwindcss.com/) - Styling
* [Supabase](https://supabase.com/) - Database & real-time sync
* [Lucide React](https://lucide.dev/) - Icons
* [Vercel](https://vercel.com/) - Hosting

## License

MIT
