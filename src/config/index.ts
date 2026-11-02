/**
 * Game Configuration Index
 * 
 * This file exports all game data from JSON configuration files.
 * These configs are designed to be easily modifiable by external contributors
 * via Pull Requests without touching application code.
 * 
 * Game-specific configs are now organized under config/games/ directory.
 */

import aocGameData from './games/aoc.json';
import starCitizenGameData from './games/star-citizen.json';
import itemRaritiesData from './itemRarities.json';
import { WOW_FOREVER_CONFIG } from '@/games/wowforever/config/game';

// Re-export game configs
export const aocConfig = aocGameData;
export const starCitizenConfig = starCitizenGameData;
export const wowForeverConfig = WOW_FOREVER_CONFIG;

// Legacy exports for backward compatibility (map to AoC game config)
export const professionsConfig = aocGameData.professions;
export const archetypesConfig = aocGameData.archetypes;
export const racesConfig = aocGameData.races;

// Shared configs (not game-specific)
export const itemRaritiesConfig = itemRaritiesData;
export const supplyChainConfig = aocGameData.supplyChain;

// Helper to get game config by slug
export function getGameConfig(gameSlug: string) {
  switch (gameSlug) {
    case 'aoc':
      return aocConfig;
    case 'starcitizen':
    case 'star-citizen':
      return starCitizenConfig;
    case 'wowforever':
      return wowForeverConfig;
    default:
      return aocConfig; // fallback to AoC
  }
}

// Type definitions derived from config
export type ProfessionId = 
  | typeof aocGameData.professions.gathering[number]['id']
  | typeof aocGameData.professions.processing[number]['id']
  | typeof aocGameData.professions.crafting[number]['id'];

export type ArchetypeId = typeof aocGameData.archetypes.list[number]['id'];
export type RaceId = typeof aocGameData.races.list[number]['id'];
export type RarityId = typeof itemRaritiesData.list[number]['id'];

// Helper functions
export function getProfessionById(id: string) {
  const allProfessions = [
    ...aocGameData.professions.gathering,
    ...aocGameData.professions.processing,
    ...aocGameData.professions.crafting,
  ];
  return allProfessions.find(p => p.id === id);
}

export function getArchetypeById(id: string) {
  return aocGameData.archetypes.list.find(a => a.id === id);
}

export function getRaceById(id: string) {
  return aocGameData.races.list.find(r => r.id === id);
}

export function getClassName(primary: string, secondary: string): string | undefined {
  const classes = aocGameData.archetypes.classes as Record<string, Record<string, string>>;
  return classes[primary]?.[secondary];
}

export function getSupplyChainForProfession(professionId: string) {
  return aocGameData.supplyChain.chains.filter(chain => 
    chain.flow.includes(professionId)
  );
}
