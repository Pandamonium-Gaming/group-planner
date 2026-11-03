# Adding a New Game to the Group Profession Planner

This guide walks through the process of adding a new game to the multi-game architecture. We'll use generic placeholders that you can customise for your game.

## Pre-Planning Questions

Before you start implementing, answer these questions about your game:

### Basic Identity

1. **What is the game name?** (e.g., "Ashes of Creation", "Star Citizen", "Return of Reckoning")
2. **What is the game slug/ID?** (e.g., "aoc", "starcitizen", "ror" - used in URLs and code)
3. **What is a short description?** (e.g., "View members, events, and manage group operations")

### Structural Organisation

1. **What are the main organisational units for characters?**
   * Examples: Professions (AoC), nothing special (Star Citizen), Factions + Classes (RoR)
   * This determines your config structure

2. **What roles/specializations exist?**
   * Examples: Tank, DPS, Healer (RoR), Ship Role (Star Citizen)
   * Helps define character filtering and party composition

3. **Does the game have faction systems?**
   * If yes, list them and their color schemes (e.g., Order=#blue, Destruction=#red)
   * This affects character creation and filtering

### Feature Management

1. **Which tabs should be available for this game?**
   * Available tabs: economy, matrix, achievements, builds, siege, fleet, ships, characters, events, settings
   * Exclude tabs that don't make sense for your game

2. **Are there any game-specific tab names?**
   * Example: Star Citizen shows "My Hangar" instead of "Fleet"
   * Use GAME\_TAB\_CUSTOMIZATION for this

3. **What's the default party composition?**
   * Examples: AoC uses 1-2-2 (1 Tank, 2 Melee DPS, 2 Ranged DPS)
   * RoR uses 2-2-2 (2 Tank, 2 Melee DPS, 2 Ranged DPS + Healer as support)

4. **Are there game-specific character filters needed?**
   * Examples: Filter by class, faction, archetype, profession
   * Affects the CharacterFilters component

### Discord Integration

1. **Will this game have Discord notifications?**

* If yes, each game gets separate webhook URLs and role IDs in the database
* Groups can configure per-game Discord channels
* Each game can have separate channels for announcements vs. events

1. **Does the game need role requirements for events?**
   * Examples: AoC uses 5-role system (Tank, Cleric, Bard, Ranged DPS, Melee DPS)
   * RoR uses 3-role system (Tank, Healer, DPS) with 2/2/2 default composition
   * This affects the EventForm component and database schema

## Step-by-Step Implementation

### Step 1: Create Game Configuration Files

Create the directory structure for your game:

```text
src/games/{GAME_SLUG}/config/
├── index.ts          # Core config (enums, constants, utilities)
└── game.ts           # Game registry entry
```

**File: `src/games/{GAME_SLUG}/config/index.ts`**

This file should export:

* **Enums/Types**: Faction, Class, Role types (if applicable)
* **Constants**: Arrays of factions/classes/roles with metadata
* **Color Schemes**: Colors for factions, roles, or specializations
* **Utility Functions**: Getters and filters for your domain model

Example structure (from Return of Reckoning):

```typescript
// Types
export type RORFaction = 'order' | 'destruction';
export type RORRole = 'tank' | 'melee-dps' | 'skirmish-dps' | 'ranged-dps' | 'healer';

// Constants
export const ROR_FACTIONS: Record<RORFaction, { name: string; color: string }> = {
  order: { name: 'Order', color: '#3B82F6' },
  destruction: { name: 'Destruction', color: '#EF4444' }
};

export const ROR_CLASSES = [
  { id: 'ironbreaker', name: 'Ironbreaker', faction: 'order', role: 'tank' },
  // ... more classes
];

// Utilities
export function getClassById(id: string) {
  return ROR_CLASSES.find(c => c.id === id);
}

export function getClassesByFaction(faction: RORFaction) {
  return ROR_CLASSES.filter(c => c.faction === faction);
}
```

**File: `src/games/{GAME_SLUG}/config/game.ts`**

This file exports the game configuration for registration:

```typescript
import { GameConfig } from '@/lib/games';
import { ROR_FACTIONS, ROR_CLASSES, ROR_ROLE_CONFIG } from './index';

export const {GAME_SLUG_UPPERCASE}_CONFIG: GameConfig = {
  id: '{GAME_SLUG}',
  name: '{GAME_NAME}',
  icon: '🎮', // Use an appropriate emoji or icon
  description: '{GAME_DESCRIPTION}',
  color: '#hexcolor', // Primary brand color
  hasShips: false, // Set to true if ships/vehicles are a game feature
  hasMatrix: true, // Set to true if matrix/grid view is relevant
  features: {
    // Define game-specific features if needed
    factions: ROR_FACTIONS,
    roles: ROR_ROLE_CONFIG
  }
};
```

***

### Step 2: Register the Game

**File: `src/lib/games.ts`**

1. Add the game slug to the `GameId` type:

   ```typescript
   export type GameId = 'aoc' | 'starcitizen' | 'ror' | '{GAME_SLUG}';
   ```

2. Import your game config:

   ```typescript
   import { {GAME_SLUG_UPPERCASE}_CONFIG } from '@/games/{GAME_SLUG}/config/game';
   ```

3. Add it to the `GAMES` object:

```typescript
export const GAMES: Record<GameId, GameConfig> = {
  aoc: AOC_CONFIG,
  starcitizen: STARCITIZEN_CONFIG,
  ror: ROR_CONFIG,
  {GAME_SLUG}: {GAME_SLUG_UPPERCASE}_CONFIG
};
```

***

### Step 3: Configure Tab Visibility

**File: `src/config/tabs.ts`**

Add your game to `GAME_TAB_EXCLUSIONS` to specify which tabs should NOT appear:

```typescript
export const GAME_TAB_EXCLUSIONS: Record<GameId, Tab[]> = {
  aoc: [],
  starcitizen: ['economy', 'matrix', 'achievements', 'builds', 'siege'],
  ror: ['economy', 'matrix', 'achievements', 'builds', 'siege', 'fleet', 'ships'],
  {GAME_SLUG}: ['{EXCLUDED_TABS}']
};
```

**Available Tabs**: `economy`, `matrix`, `achievements`, `builds`, `siege`, `fleet`, `ships`, `characters`, `events`, `settings`

If you want custom tab names, add to `GAME_TAB_CUSTOMIZATION`:

```typescript
export const GAME_TAB_CUSTOMIZATION: Record<GameId, Partial<Record<Tab, string>>> = {
  starcitizen: {
    fleet: 'My Hangar',
    ships: 'Group Ships'
  },
  {GAME_SLUG}: {
    // Custom names here
  }
};
```

***

### Step 4: Add Translations

**Files: `public/locales/en.json` and `public/locales/es.json`**

Add a section for your game with all UI strings:

```json
{
  "{GAME_SLUG}": {
    "factions": {
      "faction1": "Faction One Name",
      "faction2": "Faction Two Name"
    },
    "classes": {
      "class1": "Class One Name",
      "class2": "Class Two Name"
    },
    "roles": {
      "tank": "Tank",
      "dps": "Damage Dealer",
      "healer": "Healer"
    }
  }
}
```

**Required Translation Keys**:

* Game name and description (in game list)
* Role/class names (for filtering and display)
* Tab names (if customised)
* Feature-specific labels

***

### Step 5: Create Game-Specific Components (Optional)

If your game needs custom UI for character creation, party management, or other features:

1. Create components in `src/components/` prefixed with your game slug
   * Example: `RORCharacterForm.tsx`, `RORPartyBuilder.tsx`

2. Create game-specific hooks if needed
   * Example: `useRORFactions()`, `useRORClasses()`

3. Update character creation and management pages to use game-specific variants

***

### Step 6: Update Navigation (If Needed)

**File: `src/components/GameSelector.tsx`**

The GameSelector automatically picks up games from the `GAMES` registry, so if your game has proper metadata, it should appear automatically.

**File: `src/components/BottomNav.tsx`**

If your game has custom routes (like Star Citizen's `/hangar` instead of `/fleet`), add conditional routing:

```typescript
const getGameRoute = (gameSlug: string) => {
  switch(gameSlug) {
    case 'starcitizen':
      return '/hangar';
    case '{GAME_SLUG}':
      return '/{CUSTOM_ROUTE}';
    default:
      return '/fleet';
  }
};
```

***

## Deleting a Game: Register Its Data for Cleanup

Group admins can permanently delete an archived game's data for their group through the `public.delete_group_game` database function (migration 021). It erases rows by game and resets the game's per-game `groups` columns (for example the `aoc_`, `sc_`, `ror_` and `wowforever_` prefixed columns) to their defaults.

When you add a game:

* Add its per-game `groups` columns to a reset branch in `delete_group_game`. Do this in a **new migration** that replaces the function; do not edit migration 021 in place.
* If you add a new table tagged with a game (a `game_slug` column), add its deletion to the function in the same migration.
* `scripts/__tests__/delete-group-game-migration.test.mts` has a guard that collects game slugs from `src/config/games/*.json`, the `GameId` union in `src/lib/games.ts` and the migrations, and fails if a registered game has no reset branch in the function. Update the migration and the test's migration reference together.
* In that test, add the new game's slug to the `COLUMN_PREFIX` map (its `groups` column prefix) and to `DISPLAY_NAME` (used by the database tests), and add the new migration to the migration list the database tests apply (next to `MIGRATION`); the guard and the database tests fail otherwise.
* A group's last remaining game cannot be deleted (`delete_group_game` raises `LAST_GAME`), so tests that delete a game need the group to have a second one.

***

## Checklist for Adding a New Game

* \[ ] Game slug and name decided
* \[ ] Game config files created (`index.ts` and `game.ts`)
* \[ ] Game registered in `src/lib/games.ts`
* \[ ] Tab exclusions configured in `src/config/tabs.ts`
* \[ ] Translations added to `en.json` and `es.json`
* \[ ] Game appears in GameSelector
* \[ ] Test game navigation and tab visibility
* \[ ] Create game-specific components if needed
* \[ ] Update character creation form if needed
* \[ ] Add game icon/emoji
* \[ ] Documentation updated in README.md
* \[ ] Per-game `groups` columns registered in `delete_group_game` (new migration)

***

## Example: Adding "New World" (MMO)

Here's a quick example of adding a hypothetical MMO called "New World":

### Pre-Planning Answers

1. Name: "New World"
2. Slug: "newworld"
3. Description: "Manage your settlement and trading company"
4. Organisational units: Faction + Tradeskill specialisation
5. Roles: Combat roles (Tank, DPS, Healer) + Trade roles
6. Factions: Marauders, Syndicate, Covenant
7. Available tabs: All except ships and fleet
8. No custom tab names
9. Default party: 3 tanks, 3 DPS, 4 healers
10. Filters: By faction, by primary tradeskill

### Implementation (Abbreviated)

**`src/games/newworld/config/index.ts`**:

```typescript
export const NW_FACTIONS = {
  marauders: { name: 'Marauders', color: '#DC2626' },
  syndicate: { name: 'Syndicate', color: '#7C3AED' },
  covenant: { name: 'Covenant', color: '#0891B2' }
};

export const NW_CLASSES = [
  { id: 'warrior', name: 'Warrior', faction: null, role: 'tank' },
  // ... more classes
];
```

**`src/games/newworld/config/game.ts`**:

```typescript
export const NEWWORLD_CONFIG: GameConfig = {
  id: 'newworld',
  name: 'New World',
  icon: '🗡️',
  description: 'Manage your settlement and trading company',
  // ... rest of config
};
```

**`src/lib/games.ts`**: Add to GameId type and GAMES object

**`src/config/tabs.ts`**: Add newworld exclusions

**`en.json` & `es.json`**: Add newworld translation section

Done! New World is now available in your group planner.

***

## Discord Configuration

### Overview

Each game can have independent Discord webhook URLs and role IDs for:

* **General notifications** - Announcements, welcome messages, etc.
* **Event notifications** - New events, reminders, updates (optional - can use general webhook)
* **Announcement role** - Optional role mention for announcements (e.g., `@announcements`)
* **Events role** - Optional role mention for events (e.g., `@events`)

This allows groups to:

* Send AoC announcements to one channel and RoR announcements to another
* Mention different roles per game (important when managing multiple communities)
* Have separate event channels and reminders per game

### Adding Discord Support for a New Game

#### 1. Add Database Columns (in a migration)

If your game doesn't already have Discord columns in the `groups` table:

```sql
ALTER TABLE groups ADD COLUMN IF NOT EXISTS {game_slug}_webhook_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS {game_slug}_events_webhook_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS {game_slug}_announcement_role_id TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS {game_slug}_events_role_id TEXT;
```

Example for a hypothetical "Wow" game:

```sql
ALTER TABLE groups ADD COLUMN IF NOT EXISTS wow_webhook_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS wow_events_webhook_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS wow_announcement_role_id TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS wow_events_role_id TEXT;
```

#### 2. Update Discord Configuration Helper

In `src/lib/discordConfig.ts`, update the `GAME_DISCORD_COLUMNS` mapping:

```typescript
export const GAME_DISCORD_COLUMNS: Record<GameId, {
  webhookUrl: string;
  eventsWebhookUrl: string;
  announcementRoleId: string;
  eventsRoleId: string;
}> = {
  // ... existing games
  wow: {
    webhookUrl: 'wow_webhook_url',
    eventsWebhookUrl: 'wow_events_webhook_url',
    announcementRoleId: 'wow_announcement_role_id',
    eventsRoleId: 'wow_events_role_id',
  },
};
```

The helper functions automatically support your new game once you add this mapping:

* `getGameWebhookUrl(gameId, groupData)` - Returns the general webhook
* `getGameEventsWebhookUrl(gameId, groupData)` - Returns events webhook (falls back to general)
* `getGameAnnouncementRoleId(gameId, groupData)` - Returns announcement role ID
* `getGameEventsRoleId(gameId, groupData)` - Returns events role ID

#### 3. Use in Event/Announcement Handlers

When sending Discord notifications, use the game-specific wrapper functions:

```typescript
// Old way (still works):
await notifyNewEvent(webhookUrl, event, clanName, clanSlug, roleId);

// New way (automatic per-game lookup):
await notifyNewEventForGame('wow', groupData, event, clanName, clanSlug);
await notifyAnnouncementForGame('wow', groupData, announcement, clanName, clanSlug);
await notifyEventReminderForGame('wow', groupData, event, clanName, minutesUntil);
```

#### 4. Settings Page Updates (Automatic)

The `ClanSettings.tsx` component automatically displays webhook and role configuration sections for all games in your registry. Once you add your new game to `GAMES`, group admins will see a configuration card for it with fields for:

* General webhook URL
* Events webhook URL
* Announcement role ID
* Events role ID
* Test button for each game

No additional component changes needed!

***

## Tips & Best Practices

1. **Keep configs DRY**: Put shared utilities in the game config, not in components
2. **Use translation keys everywhere**: Never hardcode UI strings
3. **Test tab visibility**: Verify excluded tabs don't appear in the UI
4. **Consider performance**: Large class/faction arrays should use memoization
5. **Document game-specific features**: Add comments in config about unique mechanics
6. **Use consistent naming**: Keep slug names lowercase and simple (good: "newworld", bad: "NewWorld\_Game")
7. **Plan for growth**: Structure configs to support future features (items, dungeons, etc.)

***

## Questions

If you need to add game-specific features beyond the scope of this guide:

* Check existing game configs for patterns
* Look at component imports to understand the dependency structure
* Review the GameConfig type definition in `src/lib/games.ts`
