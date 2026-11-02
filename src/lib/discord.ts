/**
 * Discord Webhook Integration
 * 
 * Send notifications to Discord channels via webhooks.
 * No bot required - just paste the webhook URL from Discord.
 */

import { Event, Announcement, getEventTypeForGame } from './events';
import { Clan } from './types';
import {
  getGameEventsWebhookUrl,
  getGameWebhookUrl,
  getGameEventsRoleId,
  getGameAnnouncementRoleId,
  GameId,
} from './discordConfig';

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

export interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

export interface WebhookContext {
  groupId: string;
  gameSlug?: string;
  kind: 'event' | 'repost' | 'announcement' | 'reminder' | 'test' | 'welcome';
  subjectId?: string;
}

// Color palette for Discord embeds (decimal format)
const COLORS = {
  orange: 0xf97316, // Primary app color
  green: 0x22c55e,
  red: 0xef4444,
  yellow: 0xeab308,
  cyan: 0x06b6d4,
  purple: 0xa855f7,
  rose: 0xf43f5e,
} as const;

// Event type colors
const EVENT_TYPE_COLORS: Record<string, number> = {
  raid: COLORS.red,
  siege: COLORS.orange,
  gathering: COLORS.yellow,
  social: COLORS.green,
  farming_glint: COLORS.cyan,
  farming_materials: COLORS.green,
  farming_gear: COLORS.purple,
  farming_other: 0x84cc16,
  other: COLORS.cyan,
  dungeon: COLORS.orange,
  leveling: COLORS.green,
  world_pvp: COLORS.red,
  battleground_pvp: 0x3b82f6,
  arena_pvp: COLORS.purple,
};

/**
 * Send a message to a Discord webhook via our API proxy
 */
export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
  context: WebhookContext
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate URL format
    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') && 
        !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
      return { success: false, error: 'Invalid Discord webhook URL format' };
    }

    // Use our API proxy to avoid CORS issues
    const { webhookHeaders } = await import('./webhookClient');
    const response = await fetch('/api/discord', {
      method: 'POST',
      headers: await webhookHeaders(),
      body: JSON.stringify({
        webhookUrl,
        context,
        payload: {
          username: payload.username || '⚔️ Group Planner',
          avatar_url: payload.avatar_url,
          content: payload.content,
          embeds: payload.embeds,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || `API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Test a Discord webhook URL
 */
export async function testDiscordWebhook(
  webhookUrl: string,
  context: WebhookContext
): Promise<{ success: boolean; error?: string }> {
  return sendDiscordWebhook(webhookUrl, {
    embeds: [{
      title: '✅ Webhook Connected!',
      description: 'Your Discord webhook is working correctly. You will receive notifications for events and announcements from your group.',
      color: COLORS.green,
      footer: {
        text: 'Group Planner',
      },
      timestamp: new Date().toISOString(),
    }],
  }, context);
}

/**
 * Send a notification for a new event
 */
export async function notifyNewEvent(
  webhookUrl: string,
  event: Event,
  groupName: string,
  groupSlug: string,
  roleId?: string | null,
  send: typeof sendDiscordWebhook = sendDiscordWebhook
): Promise<{ success: boolean; error?: string }> {
  const eventType = getEventTypeForGame(event.event_type, event.game_slug || 'aoc');
  const startsAt = new Date(event.starts_at);
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;
  
  // Build direct link to event
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const eventUrl = `${baseUrl}/${groupSlug}/${event.game_slug || 'aoc'}/events#event-${event.id}`;
  
  // Build content with role ping if provided
  let content = '🆕 **New Event Created!**';
  if (roleId) {
    content = `<@&${roleId}> ${content}`;
  }
  
  const fields: { name: string; value: string; inline?: boolean }[] = [
    {
      name: '📅 Start Time',
      value: `<t:${Math.floor(startsAt.getTime() / 1000)}:F>\n<t:${Math.floor(startsAt.getTime() / 1000)}:R>`,
      inline: true,
    },
  ];

  // Add end time if specified
  if (endsAt) {
    fields.push({
      name: '🏁 End Time',
      value: `<t:${Math.floor(endsAt.getTime() / 1000)}:t>`,
      inline: true,
    });
  }

  if (event.location) {
    fields.push({
      name: '📍 Location',
      value: event.location,
      inline: true,
    });
  }

  // Build role requirements string if any roles are needed
  const roleRequirements = [];
  
  const formatRoleRequirement = (min: number, max: number | null, icon: string, name: string) => {
    if (min > 0 && max !== null) {
      return `${icon} ${min}-${max} ${name}`;
    } else if (min > 0) {
      return `${icon} ${min}+ ${name}`;
    } else if (max !== null) {
      return `${icon} Max ${max} ${name}`;
    }
    return null;
  };
  
  const tankReq = formatRoleRequirement(event.tanks_min, event.tanks_max, '🛡️', event.tanks_min > 1 || (event.tanks_max && event.tanks_max > 1) ? 'Tanks' : 'Tank');
  const clericReq = formatRoleRequirement(event.clerics_min, event.clerics_max, '✨', event.clerics_min > 1 || (event.clerics_max && event.clerics_max > 1) ? 'Clerics' : 'Cleric');
  const bardReq = formatRoleRequirement(event.bards_min, event.bards_max, '🎵', event.bards_min > 1 || (event.bards_max && event.bards_max > 1) ? 'Bards' : 'Bard');
  const rangedReq = formatRoleRequirement(event.ranged_dps_min, event.ranged_dps_max, '🏹', 'Ranged DPS');
  const meleeReq = formatRoleRequirement(event.melee_dps_min, event.melee_dps_max, '⚔️', 'Melee DPS');
  
  if (tankReq) roleRequirements.push(tankReq);
  if (clericReq) roleRequirements.push(clericReq);
  if (bardReq) roleRequirements.push(bardReq);
  if (rangedReq) roleRequirements.push(rangedReq);
  if (meleeReq) roleRequirements.push(meleeReq);

  if (roleRequirements.length > 0) {
    fields.push({
      name: '⚔️ Role Requirements',
      value: roleRequirements.join('\n'),
      inline: false,
    });
  } else if (event.max_attendees) {
    fields.push({
      name: '👥 Max Attendees',
      value: event.max_attendees.toString(),
      inline: true,
    });
  }

  if (event.description) {
    fields.push({
      name: '📝 Description',
      value: event.description.length > 200 
        ? event.description.slice(0, 200) + '...' 
        : event.description,
      inline: false,
    });
  }

  return send(webhookUrl, {
    content,
    embeds: [{
      title: `${eventType.icon} ${event.title}`,
      description: `**${eventType.name}**\n\n**👆 Click the event title above to view full details and RSVP with your role!**`,
      color: EVENT_TYPE_COLORS[event.event_type] || COLORS.cyan,
      url: eventUrl,
      fields,
      footer: {
        text: groupName,
      },
      timestamp: new Date().toISOString(),
    }],
  }, { groupId: event.group_id, gameSlug: event.game_slug, kind: 'event', subjectId: event.id });
}

/**
 * Send a notification for a new announcement
 */
export async function notifyAnnouncement(
  webhookUrl: string,
  announcement: Announcement & { game_slug?: string },
  groupName: string,
  groupSlug: string,
  roleId?: string | null,
  send: typeof sendDiscordWebhook = sendDiscordWebhook
): Promise<{ success: boolean; error?: string }> {
  // Build content with role ping if provided
  let content = announcement.is_pinned ? '📌 **Pinned Announcement**' : '📢 **New Announcement**';
  if (roleId) {
    content = `<@&${roleId}> ${content}`;
  }

  // Build direct link to announcement
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const announcementUrl = `${baseUrl}/${groupSlug}/${announcement.game_slug || 'aoc'}/events#announcement-${announcement.id}`;

  return send(webhookUrl, {
    content,
    embeds: [{
      title: announcement.title,
      description: announcement.content.length > 1000 
        ? announcement.content.slice(0, 1000) + '...' 
        : announcement.content,
      color: announcement.is_pinned ? COLORS.orange : COLORS.cyan,
      url: announcementUrl,
      footer: {
        text: groupName,
      },
      timestamp: new Date().toISOString(),
    }],
  }, { groupId: announcement.group_id, gameSlug: announcement.game_slug, kind: 'announcement', subjectId: announcement.id });
}

/**
 * Send a notification for an upcoming event (reminder)
 */
export async function notifyEventReminder(
  webhookUrl: string,
  event: Event,
  groupName: string,
  minutesUntil: number
): Promise<{ success: boolean; error?: string }> {
  const eventType = getEventTypeForGame(event.event_type, event.game_slug || 'aoc');
  const startsAt = new Date(event.starts_at);

  let timeText = '';
  if (minutesUntil <= 60) {
    timeText = `${minutesUntil} minutes`;
  } else {
    const hours = Math.floor(minutesUntil / 60);
    timeText = `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  return sendDiscordWebhook(webhookUrl, {
    content: `⏰ **Event Starting in ${timeText}!**`,
    embeds: [{
      title: `${eventType.icon} ${event.title}`,
      description: `Starts <t:${Math.floor(startsAt.getTime() / 1000)}:R>`,
      color: COLORS.yellow,
      fields: event.location ? [{
        name: '📍 Location',
        value: event.location,
        inline: true,
      }] : undefined,
      footer: {
        text: groupName,
      },
    }],
  }, { groupId: event.group_id, gameSlug: event.game_slug, kind: 'reminder', subjectId: event.id });
}

/**
 * Game-Specific Notification Wrappers
 * These functions automatically look up the right webhook and role for a game
 */

/**
 * Send notification for a new event with automatic game-specific webhook/role lookup
 */
export async function notifyNewEventForGame(
  gameSlug: GameId,
  groupData: Clan,
  event: Event,
  groupName: string,
  groupSlug: string
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getGameEventsWebhookUrl(gameSlug, groupData);
  const roleId = getGameEventsRoleId(gameSlug, groupData);

  if (!webhookUrl) {
    return { success: false, error: `No Discord webhook configured for ${gameSlug}` };
  }

  return notifyNewEvent(webhookUrl, event, groupName, groupSlug, roleId);
}

/**
 * Send announcement with automatic game-specific webhook/role lookup
 */
export async function notifyAnnouncementForGame(
  gameSlug: GameId,
  groupData: Clan,
  announcement: Announcement,
  groupName: string,
  groupSlug: string
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getGameWebhookUrl(gameSlug, groupData);
  const roleId = getGameAnnouncementRoleId(gameSlug, groupData);

  if (!webhookUrl) {
    return { success: false, error: `No Discord webhook configured for ${gameSlug}` };
  }

  return notifyAnnouncement(webhookUrl, announcement, groupName, groupSlug, roleId);
}

/**
 * Send event reminder with automatic game-specific webhook lookup
 */
export async function notifyEventReminderForGame(
  gameSlug: GameId,
  groupData: Clan,
  event: Event,
  groupName: string,
  minutesUntil: number
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getGameEventsWebhookUrl(gameSlug, groupData);

  if (!webhookUrl) {
    return { success: false, error: `No Discord webhook configured for ${gameSlug}` };
  }

  return notifyEventReminder(webhookUrl, event, groupName, minutesUntil);
}
