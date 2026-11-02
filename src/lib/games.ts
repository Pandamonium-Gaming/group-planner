import { AOC_CONFIG } from '@/games/aoc/config';
import { STARCITIZEN_CONFIG } from '@/games/starcitizen/config';
import { ROR_CONFIG } from '@/games/returnofreckooning/config/game';
import { WOW_FOREVER_CONFIG } from '@/games/wowforever/config/game';

export type GameId = 'aoc' | 'starcitizen' | 'ror' | 'wowforever';

export interface GameConfig {
  id: GameId;
  name: string;
  description: string;
  icon: string;
  iconUrl?: string; // Optional image URL for proper game icons
  features: Record<string, boolean>;
}

export const GAMES: Record<GameId, GameConfig> = {
  aoc: AOC_CONFIG,
  starcitizen: STARCITIZEN_CONFIG,
  ror: ROR_CONFIG,
  wowforever: WOW_FOREVER_CONFIG,
};

export function getGame(id: GameId): GameConfig {
  const game = GAMES[id];
  if (!game) {
    throw new Error(`Game not found: ${id}`);
  }
  return game;
}

export function getAllGames(): GameConfig[] {
  return Object.values(GAMES);
}

export function hasFeature(gameId: GameId, feature: string): boolean {
  const game = getGame(gameId);
  return game.features[feature] ?? false;
}
