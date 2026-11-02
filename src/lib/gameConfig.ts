import { GameId } from './games';
import { AOC_CONFIG } from '@/games/aoc/config';
import { STARCITIZEN_CONFIG } from '@/games/starcitizen/config';
import { WOW_FOREVER_CONFIG } from '@/games/wowforever/config/game';

type GameDataType = typeof AOC_CONFIG | typeof STARCITIZEN_CONFIG | typeof WOW_FOREVER_CONFIG;

/**
 * Dynamically load game-specific configuration and data
 * This allows for code-splitting game assets by route
 */
export async function loadGameConfig(gameId: GameId): Promise<GameDataType> {
  switch (gameId) {
    case 'aoc':
      return AOC_CONFIG;
    case 'starcitizen':
      return STARCITIZEN_CONFIG;
    case 'wowforever':
      return WOW_FOREVER_CONFIG;
    default:
      throw new Error(`Unknown game: ${gameId}`);
  }
}

/**
 * Get game-specific data (professions, ships, etc.)
 * Type-safe access to game configuration
 */
export function getGameData<T extends GameDataType>(gameId: GameId): T['data'] {
  const config = gameId === 'aoc'
    ? AOC_CONFIG
    : gameId === 'wowforever'
      ? WOW_FOREVER_CONFIG
      : STARCITIZEN_CONFIG;
  return (config as T).data;
}

/**
 * Check if a particular feature exists in a game
 */
export function getGameFeatures(gameId: GameId): Record<string, boolean> {
  const config = gameId === 'aoc'
    ? AOC_CONFIG
    : gameId === 'wowforever'
      ? WOW_FOREVER_CONFIG
      : STARCITIZEN_CONFIG;
  return config.features;
}
