// =====================================================
// Event Types and Helpers
// =====================================================

export type EventType = 'raid' | 'siege' | 'gathering' | 'social' | 'farming_glint' | 'farming_materials' | 'farming_gear' | 'farming_other' | 'other' | 'missions' | 'salvaging' | 'pirating' | 'bounty_hunting' | 'dungeon' | 'leveling' | 'world_pvp' | 'battleground_pvp' | 'arena_pvp';
export type RsvpStatus = 'attending' | 'maybe' | 'declined';

// Event type display config
export const EVENT_TYPES: Record<EventType, { 
  name: string; 
  icon: string; 
  color: string;
  description: string;
}> = {
  dungeon: { name: 'Dungeon', icon: '🏰', color: '#f97316', description: 'Group dungeon run' },
  leveling: { name: 'Leveling', icon: '📈', color: '#22c55e', description: 'Questing and character leveling' },
  world_pvp: { name: 'World PvP', icon: '⚔️', color: '#ef4444', description: 'Open-world player versus player combat' },
  battleground_pvp: { name: 'Battleground PvP', icon: '🚩', color: '#3b82f6', description: 'Organized battleground matches' },
  arena_pvp: { name: 'Arena PvP', icon: '🛡️', color: '#a855f7', description: 'Arena team matches' },
  raid: { 
    name: 'Raid', 
    icon: '⚔️', 
    color: '#ef4444',
    description: 'PvE dungeon or boss content'
  },
  siege: { 
    name: 'Siege', 
    icon: '🏰', 
    color: '#f97316',
    description: 'Node siege or castle battle'
  },
  gathering: { 
    name: 'Gathering', 
    icon: '⛏️', 
    color: '#22c55e',
    description: 'Resource gathering expedition'
  },
  social: { 
    name: 'Social', 
    icon: '🎉', 
    color: '#8b5cf6',
    description: 'Social meetup or celebration'
  },
  farming_glint: { 
    name: 'Farming (Glint)', 
    icon: '💎', 
    color: '#06b6d4',
    description: 'Glint farming expedition'
  },
  farming_materials: { 
    name: 'Farming (Materials)', 
    icon: '📦', 
    color: '#10b981',
    description: 'Material farming run'
  },
  farming_gear: { 
    name: 'Farming (Gear)', 
    icon: '🎯', 
    color: '#8b5cf6',
    description: 'Gear farming expedition'
  },
  farming_other: { 
    name: 'Farming (Other)', 
    icon: '🌾', 
    color: '#84cc16',
    description: 'Other farming activity'
  },
  missions: { 
    name: 'Missions', 
    icon: '📋', 
    color: '#3b82f6',
    description: 'Contract and mission ops'
  },
  salvaging: { 
    name: 'Salvaging', 
    icon: '♻️', 
    color: '#10b981',
    description: 'Salvage operations'
  },
  pirating: { 
    name: 'Pirating', 
    icon: '🏴‍☠️', 
    color: '#ef4444',
    description: 'Piracy and raiding'
  },
  bounty_hunting: { 
    name: 'Bounty Hunting', 
    icon: '🎯', 
    color: '#f97316',
    description: 'Bounty hunting operations'
  },
  other: { 
    name: 'Other', 
    icon: '📅', 
    color: '#6b7280',
    description: 'Other clan activity'
  },
};

// RSVP status display config
export const RSVP_STATUSES: Record<RsvpStatus, {
  name: string;
  icon: string;
  color: string;
}> = {
  attending: { name: 'Attending', icon: '✅', color: '#22c55e' },
  maybe: { name: 'Maybe', icon: '❓', color: '#eab308' },
  declined: { name: 'Declined', icon: '❌', color: '#ef4444' },
};

// Role type for events and parties
export type EventRole = 'tank' | 'cleric' | 'bard' | 'ranged_dps' | 'melee_dps';

// Role display config
export const EVENT_ROLES: Record<EventRole, {
  name: string;
  icon: string;
  color: string;
}> = {
  tank: { name: 'Tank', icon: '🛡️', color: '#3b82f6' },
  cleric: { name: 'Cleric', icon: '✨', color: '#22c55e' },
  bard: { name: 'Bard', icon: '🎵', color: '#a855f7' },
  ranged_dps: { name: 'Ranged DPS', icon: '🏹', color: '#ef4444' },
  melee_dps: { name: 'Melee DPS', icon: '⚔️', color: '#f97316' },
};

// Database types
export interface Event {
  id: string;
  game_slug?: string;
  group_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  event_type: EventType;
  starts_at: string; // ISO timestamp
  ends_at: string | null;
  location: string | null;
  max_attendees: number | null;
  tanks_min: number; // Minimum required (not a cap)
  clerics_min: number; // Minimum required (not a cap)
  bards_min: number; // Minimum required (not a cap)
  ranged_dps_min: number; // Minimum required (not a cap)
  melee_dps_min: number; // Minimum required (not a cap)
  tanks_max: number | null; // Maximum allowed (null = unlimited)
  clerics_max: number | null; // Maximum allowed (null = unlimited)
  bards_max: number | null; // Maximum allowed (null = unlimited)
  ranged_dps_max: number | null; // Maximum allowed (null = unlimited)
  melee_dps_max: number | null; // Maximum allowed (null = unlimited)
  allow_combined_dps: boolean; // If true, ignore individual ranged/melee maxes
  combined_dps_max: number | null; // Combined max for ranged + melee DPS
  // RoR-specific role requirements
  ror_tanks_min: number;
  ror_tanks_max: number | null;
  ror_healers_min: number;
  ror_healers_max: number | null;
  ror_dps_min: number;
  ror_dps_max: number | null;
  is_public: boolean; // If true, public guests can RSVP
  allow_allied_signups: boolean; // If true, allied members can sign up
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventCharacter {
  id: string;
  name: string;
  primary_archetype?: import('./types').Archetype | null;
  secondary_archetype?: import('./types').Archetype | null;
  ror_class?: string | null;
  wow_class?: string | null;
  wow_main_spec?: string | null;
}

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  character_id: string | null;
  status: RsvpStatus;
  role: EventRole | null;
  note: string | null;
  responded_at: string;
  character?: EventCharacter | null;
  user?: {
    id: string;
    display_name: string | null;
  };
}

export interface GuestEventRsvp {
  id: string;
  event_id: string;
  allied_group_id: string | null;
  guest_name: string;
  guest_email?: string | null;
  class_id: string | null;
  role: EventRole;
  status: 'attending' | 'maybe' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface EventWithRsvps extends Event {
  rsvps: EventRsvp[];
  guest_rsvps?: GuestEventRsvp[];
  rsvp_counts: {
    attending: number;
    maybe: number;
    declined: number;
  };
  role_counts: {
    tank: { attending: number; maybe: number };
    cleric: { attending: number; maybe: number };
    bard: { attending: number; maybe: number };
    ranged_dps: { attending: number; maybe: number };
    melee_dps: { attending: number; maybe: number };
  };
  user_rsvp?: EventRsvp | null;
}

export interface Announcement {
  id: string;
  group_id: string;
  created_by: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

// Common timezones for selection
export const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Spain (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Germany (CET/CEST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Seoul', label: 'Korea (KST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST/NZDT)' },
] as const;

/**
 * Format date/time for display in user's timezone
 */
export function formatEventTime(
  isoDate: string,
  timezone: string = 'UTC',
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(isoDate);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
    ...options,
  };
  return date.toLocaleString('en-GB', defaultOptions);
}

/**
 * Format date only (no time)
 */
export function formatEventDate(isoDate: string, timezone: string = 'UTC'): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });
}

/**
 * Format time only
 */
export function formatTime(isoDate: string, timezone: string = 'UTC'): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
}

/**
 * Check if event is in the past
 */
export function isEventPast(startsAt: string): boolean {
  return new Date(startsAt) < new Date();
}

/**
 * Check if event is happening now (between start and end)
 */
export function isEventNow(startsAt: string, endsAt: string | null): boolean {
  const now = new Date();
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000); // Default 2h
  return now >= start && now <= end;
}

/**
 * Get relative time string (e.g., "in 2 hours", "3 days ago")
 */
export function getRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (Math.abs(diffMins) < 60) {
    return diffMins > 0 ? `in ${diffMins} min` : `${Math.abs(diffMins)} min ago`;
  }
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
  }
  return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
}

/**
 * Convert local datetime-local input value to ISO with timezone
 */
export function localToUTC(localDatetime: string, timezone: string): string {
  // Parse the local datetime
  const date = new Date(localDatetime);
  return date.toISOString();
}

/**
 * Convert ISO date to datetime-local input value
 */
export function utcToLocal(isoDate: string): string {
  const date = new Date(isoDate);
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  return date.toISOString().slice(0, 16);
}
/**
 * Get event types for a specific game
 */
export function getEventTypesForGame(gameSlug: string): Record<string, { name: string; icon: string; color: string; description: string }> {
  if (gameSlug === 'wowforever') {
    return {
      raid: EVENT_TYPES.raid,
      dungeon: EVENT_TYPES.dungeon,
      gathering: EVENT_TYPES.gathering,
      social: EVENT_TYPES.social,
      leveling: EVENT_TYPES.leveling,
      world_pvp: EVENT_TYPES.world_pvp,
      battleground_pvp: EVENT_TYPES.battleground_pvp,
      arena_pvp: EVENT_TYPES.arena_pvp,
      other: EVENT_TYPES.other,
    };
  }
  if (gameSlug === 'starcitizen') {
    return {
      missions: EVENT_TYPES.missions,
      salvaging: EVENT_TYPES.salvaging,
      pirating: EVENT_TYPES.pirating,
      bounty_hunting: EVENT_TYPES.bounty_hunting,
      other: EVENT_TYPES.other,
    };
  }

  // Default AoC event types
  return {
    raid: EVENT_TYPES.raid,
    siege: EVENT_TYPES.siege,
    gathering: EVENT_TYPES.gathering,
    social: EVENT_TYPES.social,
    farming_glint: EVENT_TYPES.farming_glint,
    farming_materials: EVENT_TYPES.farming_materials,
    farming_gear: EVENT_TYPES.farming_gear,
    farming_other: EVENT_TYPES.farming_other,
    other: EVENT_TYPES.other,
  };
}

export function getCanonicalEventType(eventType: EventType, gameSlug: string): EventType {
  return gameSlug === 'wowforever' && eventType === 'siege' ? 'dungeon' : eventType;
}

export function getEventTypeForGame(eventType: EventType, gameSlug: string) {
  return EVENT_TYPES[getCanonicalEventType(eventType, gameSlug)];
}

export function isEventTypeAllowedForGame(value: unknown, gameSlug: string, previous?: string): value is EventType {
  return typeof value === 'string' && (
    Object.prototype.hasOwnProperty.call(getEventTypesForGame(gameSlug), value) ||
    (value === previous && Object.prototype.hasOwnProperty.call(EVENT_TYPES, value))
  );
}
