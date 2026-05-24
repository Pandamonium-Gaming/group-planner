# Multi-Game Framework - Quick Start

## For End Users

### When you first log in

1. Authenticate with Discord
2. You'll see the **Game Selector** - choose which game you want to manage
3. Your choice is saved - you won't need to select again
4. Use the **Game Switcher** (top-right) to switch between games

### Creating a Group

1. Make sure you've selected your game
2. Use the "Create Group" form
3. The group will automatically be tagged with your selected game
4. Only users in that game can join your group

***

## For Developers

### Adding a New Game

Follow these steps to add a new game (e.g., World of Warcraft):

#### 1. Create Config Directory

```bash
mkdir -p src/games/worldofwarcraft/config
mkdir -p src/games/worldofwarcraft/hooks
```

#### 2. Create Game Configuration File

Create `src/games/worldofwarcraft/config/index.ts`:

```typescript
import classes from './classes.json';
import professions from './professions.json';

export const WOW_CONFIG = {
  id: 'worldofwarcraft',
  name: 'World of Warcraft',
  description: 'Group coordination and raid management',
  icon: '🐉',
  features: {
    classes: true,
    professions: true,
    raids: true,
    dungeons: true,
    guilds: true,
    economy: false,
  },
  data: {
    classes,
    professions,
  },
} as const;

export type WOWConfig = typeof WOW_CONFIG;
```

#### 3. Add JSON Config Files

Create game-specific data files like `classes.json`, `professions.json`, etc.

#### 4. Update Game Registry

Edit `src/lib/games.ts`:

```typescript
import { WOW_CONFIG } from '@/games/worldofwarcraft/config';

export type GameId = 'aoc' | 'starcitizen' | 'worldofwarcraft';

export const GAMES: Record<GameId, GameConfig> = {
  aoc: AOC_CONFIG,
  starcitizen: STARCITIZEN_CONFIG,
  worldofwarcraft: WOW_CONFIG,  // ← Add here
};
```

#### 5. Create Database Migration

Create `supabase/migrations/[number]_add_worldofwarcraft_game.sql`:

```sql
-- Update game types
INSERT INTO game_types (id, name, description, icon) VALUES
  ('worldofwarcraft', 'World of Warcraft', 'Group coordination and raid management', '🐉')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon;

-- Update the CHECK constraint on clans table
ALTER TABLE clans DROP CONSTRAINT valid_game;
ALTER TABLE clans ADD CONSTRAINT valid_game 
  CHECK (game IN ('aoc', 'starcitizen', 'worldofwarcraft'));
```

#### 6. Apply Migration

```bash
yarn supabase db push
```

### Using Game-Specific Data

#### Get all games

```typescript
import { getAllGames } from '@/lib/games';

const games = getAllGames();
```

#### Get specific game

```typescript
import { getGame } from '@/lib/games';

const aocGame = getGame('aoc');
console.log(aocGame.name); // "Ashes of Creation"
console.log(aocGame.data.professions); // AoC professions
```

#### Check feature availability

```typescript
import { hasFeature } from '@/lib/games';

if (hasFeature('starcitizen', 'ships')) {
  // Star Citizen has ship tracking
}
```

#### Get user's games

```typescript
import { getUserGames } from '@/lib/gameTracking';

const userGames = await getUserGames(userId);
// Returns: ['aoc', 'starcitizen']
```

#### Get user's groups for a specific game

```typescript
import { getUserClansForGame } from '@/lib/gameTracking';

const scClans = await getUserClansForGame(userId, 'starcitizen');
// Returns clans tagged with 'starcitizen' game
```

### Creating Game-Specific Components

#### Example: Game-Specific Selector

```typescript
// src/games/worldofwarcraft/components/ClassSelector.tsx
'use client';

import { getGameData } from '@/lib/gameConfig';
import { GameId } from '@/lib/games';

export function ClassSelector() {
  const data = getGameData<any>('worldofwarcraft');
  
  return (
    <select>
      {data.classes.map((cls: any) => (
        <option key={cls.id} value={cls.id}>
          {cls.name}
        </option>
      ))}
    </select>
  );
}
```

#### Example: Game-Specific Hook

```typescript
// src/games/worldofwarcraft/hooks/useClasses.ts
import { useMemo } from 'react';
import { getGameData } from '@/lib/gameConfig';

export function useClasses() {
  return useMemo(() => {
    const data = getGameData<any>('worldofwarcraft');
    return data.classes;
  }, []);
}
```

### Conditional Rendering by Game

```typescript
'use client';

import { useGame } from '@/contexts/GameContext';
import { hasFeature } from '@/lib/games';

export function GameFeatureSection() {
  const { selectedGame } = useGame();

  if (!selectedGame) return null;

  return (
    <div>
      {hasFeature(selectedGame, 'professions') && (
        <ProfessionSection />
      )}
      
      {hasFeature(selectedGame, 'ships') && (
        <ShipInventory />
      )}
    </div>
  );
}
```

### Best Practices

✅ **Do:**

* Use `getGame()` for accessing config
* Use type-safe `GameId` type
* Store game with groups in DB
* Use feature flags instead of hardcoding
* Keep game-specific code in `src/games/[game]/`

❌ **Don't:**

* Import game configs directly (use registry)
* Hardcode game IDs in components
* Assume all games have same features
* Store game selection only in localStorage (store in DB too)

***

## Database Queries

### Get all groups for a game

```sql
SELECT * FROM clans WHERE game = 'aoc';
```

### Query user's games

```sql
SELECT game FROM user_games WHERE user_id = 'user-id';
```

### Create group for specific game

```typescript
const { data } = await supabase
  .from('clans')
  .insert({
    name: 'My Group',
    slug: 'my-group',
    game: 'aoc',  // ← Tag with game
    created_by: userId,
  });
```

### Filter groups by game

```typescript
const { data: clans } = await supabase
  .from('clan_members')
  .select(`
    clan_id,
    role,
    clans (id, name, game)
  `)
  .eq('user_id', userId)
  .eq('clans.game', 'starcitizen');
```

***

## Troubleshooting

### Game selector not showing

* Make sure you're logged in
* Check `GameProvider` is wrapping your components in `layout.tsx`

### Game not appearing in switcher

* Verify game is in `GAMES` registry
* Check game entry in `game_types` table
* Verify `GameId` type includes new game

### Group creation failing

* Ensure game is selected (`useGame().selectedGame` is not null)
* Check database migration was applied
* Verify `clans` table has `game` column

### Can't switch games

* Make sure `user_games` table has entries
* Check GameSwitcher component is rendered
* Verify GameContext provider is active

***

## Architecture Decisions

### Why this structure

1. **Scalability** - Easy to add 10+ games without polluting main codebase
2. **Type Safety** - GameId type ensures only valid games are used
3. **Feature Flags** - Different games can have different features
4. **Data Isolation** - Game data is self-contained in `games/[game]/`
5. **Database Support** - Games are tracked at DB level for filtering

### Why separate from authentication

Authentication is universal (users log in once), but game selection is per-session and per-user preference. This separation allows:

* Users to play multiple games
* Switching without re-authenticating
* Clean separation of concerns

***

## Further Reading

* See [MULTI\_GAME\_ARCHITECTURE.md](./MULTI_GAME_ARCHITECTURE.md) for detailed technical docs
* See [MULTI\_GAME\_SETUP.md](./MULTI_GAME_SETUP.md) for implementation summary
