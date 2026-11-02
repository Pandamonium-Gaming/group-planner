// Centralized Tab type and tab list for type safety and consistency

export const TAB_LIST = [
  'characters',
  'professions',
  'events',
  'parties',
  'matrix',
  'fleet',
  'ships',
  'manage',
  'siege',
  'economy',
  'more',
  'achievements',
  'alliances',
  'builds',
] as const;

export type Tab = typeof TAB_LIST[number];

// Allowlist of tabs available for each game (fail-safe approach)
// Any tab not in the allowlist will be hidden for that game
export const GAME_TAB_ALLOWLIST: Record<string, Tab[]> = {
  'aoc': ['characters', 'professions', 'events', 'matrix', 'manage', 'parties', 'siege', 'economy', 'achievements', 'alliances', 'builds'],
  'starcitizen': ['characters', 'events', 'matrix', 'manage', 'ships'],
  'ror': ['characters', 'events', 'manage', 'parties', 'alliances'],
  'wowforever': ['characters', 'professions', 'events', 'manage', 'parties', 'alliances'],
};

// Tab icons and purposes for different games
export const GAME_TAB_CUSTOMIZATION: Record<string, Partial<Record<Tab, string>>> = {
  'starcitizen': {
    matrix: 'Ships', // Matrix shows ships for SC
  },
};

// Legacy: map old exclusion key to new allowlist
export const GAME_TAB_EXCLUSIONS: Record<string, Tab[]> = {
  'starcitizen': ['professions', 'economy', 'achievements', 'alliances', 'builds', 'parties', 'siege'],
  'ror': ['professions', 'economy', 'matrix', 'achievements', 'builds', 'siege', 'fleet', 'ships'],
  'wowforever': ['economy', 'matrix', 'achievements', 'builds', 'siege', 'fleet', 'ships'],
};
