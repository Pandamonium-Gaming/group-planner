# Multi-Game Architecture

This document describes the architecture for supporting multiple games in the Group Planner application.

## Overview

The application supports Ashes of Creation, Star Citizen, Return of Reckoning, and WoW Forever while maintaining shared authentication, group management, and organizational structure.

## Directory Structure

```txt
src/
├── games/
│   ├── aoc/
│   │   ├── config/
│   │   │   ├── index.ts          # AoC game config
│   │   │   ├── professions.json
│   │   │   ├── races.json
│   │   │   └── itemRarities.json
│   │   └── hooks/
│   │       └── (game-specific hooks)
│   │
│   └── starcitizen/
│       ├── config/
│       │   ├── index.ts          # Star Citizen config
│       │   ├── ships.json
│       │   └── roles.json
│       └── hooks/
│           └── (game-specific hooks)
│
│   └── wowforever/
│       └── config/
│           ├── index.ts          # Races, class/spec combinations, and professions
│           └── game.ts          # Game registry entry
│
├── lib/
│   ├── games.ts                   # Game registry and utilities
│   ├── gameConfig.ts              # Dynamic config loader
│   └── gameTracking.ts            # Game-user relationship tracking
│
├── contexts/
│   └── GameContext.tsx            # Game selection state
│
└── components/
    ├── GameSelector.tsx           # Game selection UI
    └── GameSwitcher.tsx           # Game switching dropdown
```

## Core Concepts

### Game Configuration

Each game has a configuration file (`src/games/[game]/config/index.ts`) that exports:

```typescript
export const GAME_CONFIG = {
  id: 'game-id',
  name: 'Game Name',
  description: 'Description',
  icon: '🎮',
  features: {
    professions: true,
    characters: true,
    // ... feature flags
  },
  data: {
    // Game-specific data (professions, ships, etc.)
  },
} as const;
```

### Game Registry

The `lib/games.ts` file provides:

* `GAMES` - Object containing all available games
* `getGame(id)` - Get a specific game's config
* `getAllGames()` - Get all games
* `hasFeature(gameId, feature)` - Check feature availability

### Game Selection State

The `GameContext.tsx` manages:

* `selectedGame` - Currently selected game ID
* `setSelectedGame(gameId)` - Change selected game
* `clearSelectedGame()` - Clear selection

### Database Support

A new migration (`034_add_game_support.sql`) adds:

* `game` column to `clans` table (tracks which game each clan belongs to)
* `game_types` table (reference table for game definitions)
* `user_games` table (tracks which games a user participates in)

WoW Forever characters store race, class, main/secondary specialization, and two professions in game-specific member fields. Current race/class options follow the Wowhead WoW: Forever guide; the class specialization and profession lists are maintained from the supplied game data.

## User Flow

1. **User logs in** → Sees Game Selector
2. **User selects game** → Game is tracked in `user_games` table
3. **User creates/joins clans** → Clan is tagged with selected game
4. **Game switcher** → Header dropdown allows switching between games user is in

## Adding a New Game

To add a new game (e.g., "World of Warcraft"):

1. **Create config directory**:

   ```bash
   mkdir -p src/games/worldofwarcraft/config
   ```

2. **Create game config** (`src/games/worldofwarcraft/config/index.ts`):

   ```typescript
   import classes from './classes.json';
   import professions from './professions.json';

   export const WOW_CONFIG = {
     id: 'worldofwarcraft',
     name: 'World of Warcraft',
     description: 'Group coordination and management',
     icon: '⚔️',
     features: {
       classes: true,
       professions: true,
       raids: true,
       // ...
     },
     data: {
       classes,
       professions,
     },
   } as const;
   ```

3. **Create JSON data files** (classes.json, professions.json, etc.)

4. **Update game registry** (`src/lib/games.ts`):

   ```typescript
   import { WOW_CONFIG } from '@/games/worldofwarcraft/config';

   export const GAMES: Record<GameId, GameConfig> = {
     aoc: AOC_CONFIG,
     starcitizen: STARCITIZEN_CONFIG,
     worldofwarcraft: WOW_CONFIG,  // Add new game
   };
   ```

5. **Update GameId type** (`src/lib/games.ts`):

   ```typescript
   export type GameId = 'aoc' | 'starcitizen' | 'worldofwarcraft';
   ```

6. **Create database migration** to set game as valid option (update CHECK constraint in clans table)

## Database Schema

### clans table

* `game VARCHAR(50)` - Game identifier (aoc, starcitizen, etc.)
* Foreign key to `game_types` table

### game\_types table

```sql
CREATE TABLE game_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100),
  description TEXT,
  icon VARCHAR(5),
  created_at TIMESTAMPTZ
)
```

### user\_games table

```sql
CREATE TABLE user_games (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  game VARCHAR(50) REFERENCES game_types(id),
  joined_at TIMESTAMPTZ,
  UNIQUE(user_id, game)
)
```

## Game-Specific Features

### Ashes of Creation

* **Features**: professions, characters, groups, economy, events, alliances
* **Key entities**: Professions, ranks, items, supply chains
* **Tracking**: member professions, builds, achievements

### Star Citizen

* **Features**: ships, pilots, orgs, equipment, missions, logistics
* **Key entities**: Ships by manufacturer, pilot roles, specializations
* **Tracking**: pilot certifications, ship ownership, fleet composition

## Querying by Game

When fetching data for a specific game, filter by the game column:

```typescript
// Get all clans for a specific game
const { data } = await supabase
  .from('clans')
  .select('*')
  .eq('game', 'aoc');

// Get user's clans for a specific game
const userClans = await getUserClansForGame(userId, 'starcitizen');
```

## Discord Integration

Each game has independent Discord webhook and role configuration in the database, allowing groups to send game-specific notifications to separate Discord channels.

### Database Columns

For each game, the following columns are available in the `groups` table:

```sql
-- General webhooks for announcements
aoc_webhook_url TEXT
sc_webhook_url TEXT
ror_webhook_url TEXT

-- Event-specific webhooks (optional, falls back to general webhook)
aoc_events_webhook_url TEXT
sc_events_webhook_url TEXT
ror_events_webhook_url TEXT

-- Role IDs for announcements
aoc_announcement_role_id TEXT
sc_announcement_role_id TEXT
ror_announcement_role_id TEXT

-- Role IDs for events
aoc_events_role_id TEXT
sc_events_role_id TEXT
ror_events_role_id TEXT
```

When adding a new game, add corresponding columns (see [ADDING\_NEW\_GAMES.md](ADDING_NEW_GAMES.md) for migration details).

### Configuration Utilities

The `src/lib/discordConfig.ts` module provides helper functions:

```typescript
import {
  getGameWebhookUrl,
  getGameEventsWebhookUrl,
  getGameAnnouncementRoleId,
  getGameEventsRoleId,
  getGameDiscordConfig,
} from '@/lib/discordConfig';

// Get all Discord config for a game
const config = getGameDiscordConfig('ror', groupData);
// Returns: { webhookUrl, eventsWebhookUrl, announcementRoleId, eventsRoleId }

// Get individual values
const webhook = getGameWebhookUrl('ror', groupData);
const role = getGameEventsRoleId('ror', groupData);
```

### Sending Notifications

Use the game-specific wrapper functions in `src/lib/discord.ts`:

```typescript
// Automatic webhook and role lookup
await notifyNewEventForGame('ror', groupData, event, clanName, clanSlug);
await notifyAnnouncementForGame('ror', groupData, announcement, clanName, clanSlug);
await notifyEventReminderForGame('ror', groupData, event, clanName, minutesUntil);
```

These functions automatically:

1. Look up the correct webhook URL for the game
2. Look up the correct role ID for the game
3. Send the notification with the game-specific configuration
4. Return success/error status

### Settings UI

Group admins configure per-game Discord webhooks and roles in the **Settings** tab. The `ClanSettings.tsx` component:

* **Automatically detects all games** from the registry
* **Dynamically generates** a configuration card for each game
* **Provides test buttons** for each game's webhook independently
* **Handles fallback logic** (uses general webhook if events webhook not set)

No component changes needed when adding a new game - it automatically appears in settings!

## Future Considerations

* **Route structure**: Consider implementing `src/app/[game]/[clan]` dynamic routes
* **Localization**: Game-specific locale files could be nested under game directories
* **Asset management**: Game logos, icons, and banners could be organized per game
* **API separation**: Each game could have its own set of API routes (`src/app/api/[game]/...`)
* **Game-specific hooks**: Create custom hooks per game in `games/[game]/hooks/`
