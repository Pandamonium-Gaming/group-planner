// Centralized Tab type and tab list for type safety and consistency

export const TAB_LIST = [
  'characters',
  'professions',
  'classes',
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
  'aoc': ['characters', 'professions', 'classes', 'events', 'matrix', 'manage', 'parties', 'siege', 'economy', 'achievements', 'alliances', 'builds'],
  'starcitizen': ['characters', 'events', 'matrix', 'manage', 'ships'],
  'ror': ['characters', 'classes', 'events', 'manage', 'parties', 'alliances'],
  'wowforever': ['characters', 'professions', 'classes', 'events', 'manage', 'parties', 'alliances', 'economy'],
};

// Tab icons and purposes for different games
export const GAME_TAB_CUSTOMIZATION: Record<string, Partial<Record<Tab, string>>> = {
  'starcitizen': {
    matrix: 'Ships', // Matrix shows ships for SC
  },
};

// Legacy: map old exclusion key to new allowlist
export const GAME_TAB_EXCLUSIONS: Record<string, Tab[]> = {
  'starcitizen': ['professions', 'classes', 'economy', 'achievements', 'alliances', 'builds', 'parties', 'siege'],
  'ror': ['professions', 'economy', 'matrix', 'achievements', 'builds', 'siege', 'fleet', 'ships'],
  'wowforever': ['matrix', 'achievements', 'builds', 'siege', 'fleet', 'ships'],
};
