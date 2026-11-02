# Multi-Game Architecture Implementation Summary

## Overview

The application has been successfully scaffolded to support multiple games (Ashes of Creation, Star Citizen, and more). Users now select a game after login and can manage organizations/groups for that game.

## What Was Created

### 1. **Game Configuration Structure** (`src/games/`)

* **`src/games/aoc/config/`** - Ashes of Creation configuration
  * `index.ts` - Game config export with features and data references
  * Existing professions, races, and item rarity data
* **`src/games/starcitizen/config/`** - Star Citizen configuration
  * `index.ts` - Game config export
  * `ships.json` - Ship manufacturers, categories, and ship details
  * `roles.json` - Pilot roles and specializations

### 2. **Game Registry & Utilities** (`src/lib/`)

* **`games.ts`** - Game registry and lookup functions
  * `GAMES` object mapping game IDs to configs
  * `getGame()` - Get specific game config
  * `getAllGames()` - List all games
  * `hasFeature()` - Check if game has a feature
  * `GameId` type: `'aoc' | 'starcitizen'`

* **`gameConfig.ts`** - Dynamic config loader
  * `loadGameConfig()` - Async config loading (for code-splitting)
  * `getGameData()` - Type-safe access to game data
  * `getGameFeatures()` - Get feature flags

* **`gameTracking.ts`** - User-game relationship management
  * `addUserGame()` - Track user's participation in a game
  * `getUserGames()` - Get all games user is in
  * `getUserClansForGame()` - Get user's groups filtered by game

* **`gameValidation.ts`** - Game context validation
  * `validateClanGame()` - Ensure group belongs to the correct game
  * `getClanGame()` - Get the game a group belongs to
  * `initializeClanWithGame()` - Set up a new group with game

### 3. **React Contexts** (`src/contexts/`)

* **`GameContext.tsx`** - Game selection state management
  * `selectedGame` - Currently selected game ID
  * `setSelectedGame()` - Change selected game
  * `clearSelectedGame()` - Reset selection
  * `GameProvider` wrapper component

### 4. **UI Components** (`src/components/`)

* **`GameSelector.tsx`** - Game selection UI
  * Displays all available games as cards
  * Tracks game selection in `user_games` table
  * Loading states during selection
  * Feature badges for each game

* **`GameSwitcher.tsx`** - Game switching dropdown
  * Appears in header when user has selected a game
  * Quick switcher for users with multiple games
  * "Choose game again" option to return to selector

### 5. **Database Migration** (`supabase/migrations/`)

* **`034_add_game_support.sql`**
  * Adds `game` column to `clans` table
  * Creates `game_types` reference table
  * Creates `user_games` tracking table
  * Adds indexes for performance
  * Seeds initial games (aoc, starcitizen)

### 6. **Updated App Layout** (`src/app/`)

* **`layout.tsx`** - Added `GameProvider` wrapper
* **`page.tsx`** - Updated landing page
  * Shows `GameSelector` for authenticated users
  * Hides group lists and features until game is selected
  * Imports `GameSwitcher` component for header

### 7. **Documentation** (`docs/`)

* **`MULTI_GAME_ARCHITECTURE.md`** - Complete architecture guide
  * Directory structure
  * Core concepts and patterns
  * Database schema
  * How to add new games
  * Game-specific features overview

## User Flow

```text
1. User logs in via Discord
   ↓
2. Landing page shows GameSelector
   ↓
3. User chooses game (AoC or Star Citizen)
   ↓
4. Game is tracked in user_games table
   ↓
5. GameContext.selectedGame is set
   ↓
6. Landing page shows group management for selected game
   ↓
7. GameSwitcher appears in header for quick switching
```

## Key Features Implemented

✅ **Multi-game support architecture**
✅ **Type-safe game registry system**
✅ **Game selection UI with visual feedback**
✅ **Game-specific configurations and data**
✅ **Database tracking of user-game relationships**
✅ **Game switching without logout**
✅ **Group-to-game association**
✅ **Feature flags per game**

## Next Steps (Optional)

1. **Route Structure** - Implement `src/app/[game]/[clan]` dynamic routes for game-specific group pages
2. **Game-Specific Components** - Create component variants per game (e.g., `ProfessionSelector` vs `ShipSelector`)
3. **Localization** - Add game-specific translation files
4. **API Routes** - Create `src/app/api/[game]/...` for game-specific endpoints
5. **Landing Page Variants** - Customize landing hero/features per game
6. **More Games** - Follow the "Adding a New Game" guide to add more games

## Folder Structure Preview

```text
src/
├── games/
│   ├── aoc/
│   │   ├── config/
│   │   │   ├── index.ts
│   │   │   ├── professions.json
│   │   │   ├── races.json
│   │   │   └── itemRarities.json
│   │   └── hooks/
│   │
│   └── starcitizen/
│       ├── config/
│       │   ├── index.ts
│       │   ├── ships.json
│       │   └── roles.json
│       └── hooks/
│
├── lib/
│   ├── games.ts
│   ├── gameConfig.ts
│   ├── gameTracking.ts
│   ├── gameValidation.ts
│   └── discordConfig.ts         # ← Game-specific Discord configuration
│
├── contexts/
│   └── GameContext.tsx
│
├── components/
│   ├── GameSelector.tsx
│   ├── GameSwitcher.tsx
│   └── ClanSettings.tsx          # ← Now manages per-game Discord webhooks/roles for groups
│
└── app/
    ├── layout.tsx (updated)
    └── page.tsx (updated)
```

## Discord Integration (Multi-Game Support)

Group admins can now configure separate Discord channels and roles for each game:

### Database Setup

Each game has dedicated Discord columns in the `groups` table:

```text
aoc_webhook_url              - General announcements webhook
aoc_events_webhook_url       - Event notifications webhook
aoc_announcement_role_id     - Role to mention for announcements
aoc_events_role_id           - Role to mention for events

starcitizen_webhook_url      - (same pattern for Star Citizen)
starcitizen_events_webhook_url
starcitizen_announcement_role_id
starcitizen_events_role_id

ror_webhook_url              - (same pattern for Return of Reckoning)
ror_events_webhook_url
ror_announcement_role_id
ror_events_role_id
```

### Configuration Files

New utility module for managing per-game Discord configuration:

* **`src/lib/discordConfig.ts`** - Helper functions for webhook/role lookup
  * `getGameWebhookUrl(gameId, groupData)` - Get general webhook
  * `getGameEventsWebhookUrl(gameId, groupData)` - Get events webhook (with fallback)
  * `getGameAnnouncementRoleId(gameId, groupData)` - Get announcement role
  * `getGameEventsRoleId(gameId, groupData)` - Get events role
  * `GAME_DISCORD_COLUMNS` - Mapping of game IDs to database columns

### Updated Discord Functions

The `src/lib/discord.ts` now includes game-specific wrapper functions:

* **`notifyNewEventForGame(gameId, groupData, event, ...)`** - Send event notification to correct channel
* **`notifyAnnouncementForGame(gameId, groupData, announcement, ...)`** - Send announcement to correct channel
* **`notifyEventReminderForGame(gameId, groupData, event, ...)`** - Send reminder to correct channel

Each function automatically looks up the game-specific webhook and role IDs.

### Settings UI

The **ClanSettings.tsx** component now:

* Dynamically generates webhook/role input sections for **all games** in the registry
* Shows test buttons for each game independently
* Handles fallback logic (uses general webhook if events webhook not set)
* Saves per-game configurations to database automatically

No component changes needed when adding a new game!

## Testing the Implementation

1. Run the migration: `yarn supabase db push`
2. Start dev server: `yarn dev`
3. Login with Discord
4. You should see the GameSelector
5. Choose a game and verify:
   * Game is stored in `user_games` table

* Group form appears
* GameSwitcher shows in header
* Switching games works smoothly

## Files Modified

* `src/app/layout.tsx` - Added GameProvider
* `src/app/page.tsx` - Added GameSelector logic and GameSwitcher component
* `src/components/ClanSettings.tsx` - Updated to manage per-game Discord webhooks/roles
* `src/lib/discord.ts` - Added game-specific wrapper functions

## Files Created

* `src/games/aoc/config/index.ts`
* `src/games/starcitizen/config/index.ts`
* `src/games/starcitizen/config/ships.json`
* `src/games/starcitizen/config/roles.json`
* `src/games/ror/config/index.ts` - RoR faction/class configuration
* `src/lib/games.ts`
* `src/lib/gameConfig.ts`
* `src/lib/gameTracking.ts`
* `src/lib/gameValidation.ts`
* `src/lib/discordConfig.ts` - Per-game Discord configuration utilities
* `src/contexts/GameContext.tsx`
* `src/components/GameSelector.tsx`
* `src/components/GameSwitcher.tsx`
* `src/components/DynamicFavicon.tsx` - Group icon as favicon
* `supabase/migrations/034_add_game_support.sql`
* `supabase/migrations/059_ror_game_constraints.sql`
* `supabase/migrations/060_standardize_starcitizen_slug.sql`
* `supabase/migrations/061_ror_event_role_requirements.sql`
* `supabase/migrations/062_ror_discord_webhooks_and_roles.sql`
* `docs/MULTI_GAME_ARCHITECTURE.md`
