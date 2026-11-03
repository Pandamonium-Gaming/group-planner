/**
 * Discord Configuration Utilities
 * Provides helper functions to fetch game-specific Discord webhooks and role IDs
 * from group data with proper fallback handling
 */

export type GameId = 'aoc' | 'sc' | 'ror' | 'wowforever' | 'cc';

export function isDiscordWebhookUrl(url: string): boolean {
  return /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[^/?#]+\/[^/?#]+\/?(?:\?[^#]*)?$/.test(url);
}

interface GroupDiscordConfig {
  id: string;
  group_webhook_url?: string;
  group_events_webhook_url?: string;
  group_announcement_role_id?: string;
  
  // Game-specific webhook/role columns
  aoc_webhook_url?: string;
  aoc_events_webhook_url?: string;
  aoc_announcement_role_id?: string;
  aoc_events_role_id?: string;
  
  sc_webhook_url?: string;
  sc_events_webhook_url?: string;
  sc_announcement_role_id?: string;
  sc_events_role_id?: string;
  
  ror_webhook_url?: string;
  ror_events_webhook_url?: string;
  ror_announcement_role_id?: string;
  ror_events_role_id?: string;

  wowforever_webhook_url?: string;
  wowforever_events_webhook_url?: string;
  wowforever_announcement_role_id?: string;
  wowforever_events_role_id?: string;
  
  cc_webhook_url?: string;
  cc_events_webhook_url?: string;
  cc_announcement_role_id?: string;
  cc_events_role_id?: string;
}

/**
 * Mapping of game IDs to their Discord configuration columns
 */
export const GAME_DISCORD_COLUMNS: Record<GameId, {
  webhookUrl: string;
  eventsWebhookUrl: string;
  announcementRoleId: string;
  eventsRoleId: string;
}> = {
  aoc: {
    webhookUrl: 'aoc_webhook_url',
    eventsWebhookUrl: 'aoc_events_webhook_url',
    announcementRoleId: 'aoc_announcement_role_id',
    eventsRoleId: 'aoc_events_role_id',
  },
  sc: {
    webhookUrl: 'sc_webhook_url',
    eventsWebhookUrl: 'sc_events_webhook_url',
    announcementRoleId: 'sc_announcement_role_id',
    eventsRoleId: 'sc_events_role_id',
  },
  ror: {
    webhookUrl: 'ror_webhook_url',
    eventsWebhookUrl: 'ror_events_webhook_url',
    announcementRoleId: 'ror_announcement_role_id',
    eventsRoleId: 'ror_events_role_id',
  },
  wowforever: {
    webhookUrl: 'wowforever_webhook_url',
    eventsWebhookUrl: 'wowforever_events_webhook_url',
    announcementRoleId: 'wowforever_announcement_role_id',
    eventsRoleId: 'wowforever_events_role_id',
  },
  cc: {
    webhookUrl: 'cc_webhook_url',
    eventsWebhookUrl: 'cc_events_webhook_url',
    announcementRoleId: 'cc_announcement_role_id',
    eventsRoleId: 'cc_events_role_id',
  },
};

/**
 * Get the general Discord webhook URL for a specific game.
 * Falls back to group-wide webhook if game-specific not configured.
 */
export function getGameWebhookUrl(gameId: GameId, groupData: GroupDiscordConfig): string | null {
  const gameKey = `${gameId}_webhook_url` as const;
  const gameUrl = groupData[gameKey as keyof GroupDiscordConfig];
  
  if (gameUrl) {
    return gameUrl as string;
  }
  
  return groupData.group_webhook_url || null;
}

/**
 * Get the events-specific Discord webhook URL for a game.
 * Falls back to general webhook, then to group-wide webhook.
 */
export function getGameEventsWebhookUrl(gameId: GameId, groupData: GroupDiscordConfig): string | null {
  const eventKey = `${gameId}_events_webhook_url` as const;
  const eventsUrl = groupData[eventKey as keyof GroupDiscordConfig];
  
  if (eventsUrl) {
    return eventsUrl as string;
  }
  
  // Fall back to general game webhook
  return getGameWebhookUrl(gameId, groupData);
}

/**
 * Get the announcement role ID for a specific game.
 * Falls back to group-wide announcement role if game-specific not configured.
 */
export function getGameAnnouncementRoleId(gameId: GameId, groupData: GroupDiscordConfig): string | null {
  const roleKey = `${gameId}_announcement_role_id` as const;
  const gameRole = groupData[roleKey as keyof GroupDiscordConfig];
  
  if (gameRole) {
    return gameRole as string;
  }
  
  return groupData.group_announcement_role_id || null;
}

/**
 * Get the events role ID for a specific game.
 * Falls back to announcement role, then to group-wide announcement role.
 */
export function getGameEventsRoleId(gameId: GameId, groupData: GroupDiscordConfig): string | null {
  const eventRoleKey = `${gameId}_events_role_id` as const;
  const eventsRole = groupData[eventRoleKey as keyof GroupDiscordConfig];
  
  if (eventsRole) {
    return eventsRole as string;
  }
  
  // Fall back to general announcement role
  return getGameAnnouncementRoleId(gameId, groupData);
}

/**
 * Get all Discord configuration for a specific game
 */
export function getGameDiscordConfig(gameId: GameId, groupData: GroupDiscordConfig) {
  return {
    webhookUrl: getGameWebhookUrl(gameId, groupData),
    eventsWebhookUrl: getGameEventsWebhookUrl(gameId, groupData),
    announcementRoleId: getGameAnnouncementRoleId(gameId, groupData),
    eventsRoleId: getGameEventsRoleId(gameId, groupData),
  };
}

// Export GameId type
export type { GroupDiscordConfig };
