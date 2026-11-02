'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Event, EventWithRsvps, EventRsvp, RsvpStatus, EventRole, Announcement, isEventTypeAllowedForGame } from '@/lib/events';
import { postEventNotification, postAnnouncementNotification } from '@/lib/webhookClient';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { roleHasPermission } from '@/lib/permissions';
import { getClientAuthStack } from '@/lib/authStack';

interface UseEventsReturn {
  events: EventWithRsvps[];
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
  // Event actions
  createEvent: (event: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'is_cancelled'>, sendDiscordNotification: boolean) => Promise<Event | null>;
  updateEvent: (id: string, updates: Partial<Event>) => Promise<void>;
  cancelEvent: (id: string) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  // RSVP actions  
  setRsvp: (eventId: string, status: RsvpStatus, role?: EventRole | null, characterId?: string, note?: string) => Promise<void>;
  removeRsvp: (eventId: string) => Promise<void>;
  // Announcement actions
  createAnnouncement: (announcement: Omit<Announcement, 'id' | 'created_at' | 'updated_at'>, sendDiscordNotification: boolean) => Promise<void>;
  updateAnnouncement: (id: string, updates: Partial<Announcement>) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  // Utils
  refresh: () => Promise<void>;
}

export function useEvents(groupId: string | null, userId: string | null, gameSlug?: string, _clanSlug?: string): UseEventsReturn {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [events, setEvents] = useState<EventWithRsvps[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset state when groupId or gameSlug changes (prevent stale data on route transition)
  useEffect(() => {
    const timerId = setTimeout(() => {
      setEvents([]);
      setAnnouncements([]);
      setLoading(true);
    }, 0);

    return () => clearTimeout(timerId);
  }, [groupId, gameSlug]);

  const fetchEventsViaApi = useCallback(async () => {
    if (!groupId) {
      throw new Error('Group is required to load events');
    }

    const response = await fetch(
      `/api/group/events?group_id=${encodeURIComponent(groupId)}&game_slug=${encodeURIComponent(gameSlug || 'aoc')}`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      throw new Error(payload.details || payload.error || `Failed to load events (${response.status})`);
    }

    const payload = (await response.json()) as {
      events?: Array<Event & { event_rsvps?: EventRsvp[]; guest_event_rsvps?: any[] }>;
      announcements?: Announcement[];
    };

    const eventsWithRsvps: EventWithRsvps[] = (payload.events || []).map((event) => {
      const rsvps = event.event_rsvps || [];
      const guestRsvps = event.guest_event_rsvps || [];
      return {
        ...event,
        rsvps,
        guest_rsvps: guestRsvps,
        rsvp_counts: {
          attending: rsvps.filter((r: EventRsvp) => r.status === 'attending').length + guestRsvps.length,
          maybe: rsvps.filter((r: EventRsvp) => r.status === 'maybe').length,
          declined: rsvps.filter((r: EventRsvp) => r.status === 'declined').length,
        },
        role_counts: {
          tank: {
            attending: rsvps.filter((r: EventRsvp) => r.role === 'tank' && r.status === 'attending').length +
                       guestRsvps.filter((g: any) => g.role === 'tank').length,
            maybe: rsvps.filter((r: EventRsvp) => r.role === 'tank' && r.status === 'maybe').length,
          },
          cleric: {
            attending: rsvps.filter((r: EventRsvp) => r.role === 'cleric' && r.status === 'attending').length +
                       guestRsvps.filter((g: any) => g.role === 'cleric').length,
            maybe: rsvps.filter((r: EventRsvp) => r.role === 'cleric' && r.status === 'maybe').length,
          },
          bard: {
            attending: rsvps.filter((r: EventRsvp) => r.role === 'bard' && r.status === 'attending').length +
                       guestRsvps.filter((g: any) => g.role === 'bard').length,
            maybe: rsvps.filter((r: EventRsvp) => r.role === 'bard' && r.status === 'maybe').length,
          },
          ranged_dps: {
            attending: rsvps.filter((r: EventRsvp) => r.role === 'ranged_dps' && r.status === 'attending').length +
                       guestRsvps.filter((g: any) => g.role === 'ranged_dps').length,
            maybe: rsvps.filter((r: EventRsvp) => r.role === 'ranged_dps' && r.status === 'maybe').length,
          },
          melee_dps: {
            attending: rsvps.filter((r: EventRsvp) => r.role === 'melee_dps' && r.status === 'attending').length +
                       guestRsvps.filter((g: any) => g.role === 'melee_dps').length,
            maybe: rsvps.filter((r: EventRsvp) => r.role === 'melee_dps' && r.status === 'maybe').length,
          },
        },
        user_rsvp: userId ? rsvps.find((r: EventRsvp) => r.user_id === userId) || null : null,
      };
    });

    return {
      events: eventsWithRsvps,
      announcements: payload.announcements || [],
    };
  }, [gameSlug, groupId, userId]);

  // Fetch all events with RSVPs
  const fetchEvents = useCallback(async () => {
    if (!groupId) return;

    if (getClientAuthStack() === 'v2') {
      const { events: eventsWithRsvps } = await fetchEventsViaApi();
      setEvents(eventsWithRsvps);
      return;
    }

    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_rsvps (
            *,
            character:members(id, name),
            user:users(id, display_name)
          ),
          guest_event_rsvps (*)
        `)
        .eq('group_id', groupId)
        .eq('game_slug', gameSlug || 'aoc')
        .gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h + future
        .order('starts_at', { ascending: true });

      if (eventsError) throw eventsError;

      // Transform to EventWithRsvps
      const eventsWithRsvps: EventWithRsvps[] = (eventsData || []).map((event) => {
        const rsvps = event.event_rsvps || [];
        const guestRsvps = event.guest_event_rsvps || [];
        return {
          ...event,
          rsvps,
          guest_rsvps: guestRsvps,
          rsvp_counts: {
            attending: rsvps.filter((r: EventRsvp) => r.status === 'attending').length + guestRsvps.length,
            maybe: rsvps.filter((r: EventRsvp) => r.status === 'maybe').length,
            declined: rsvps.filter((r: EventRsvp) => r.status === 'declined').length,
          },
          role_counts: {
            tank: {
              attending: rsvps.filter((r: EventRsvp) => r.role === 'tank' && r.status === 'attending').length + 
                         guestRsvps.filter((g: any) => g.role === 'tank').length,
              maybe: rsvps.filter((r: EventRsvp) => r.role === 'tank' && r.status === 'maybe').length,
            },
            cleric: {
              attending: rsvps.filter((r: EventRsvp) => r.role === 'cleric' && r.status === 'attending').length +
                         guestRsvps.filter((g: any) => g.role === 'cleric').length,
              maybe: rsvps.filter((r: EventRsvp) => r.role === 'cleric' && r.status === 'maybe').length,
            },
            bard: {
              attending: rsvps.filter((r: EventRsvp) => r.role === 'bard' && r.status === 'attending').length +
                         guestRsvps.filter((g: any) => g.role === 'bard').length,
              maybe: rsvps.filter((r: EventRsvp) => r.role === 'bard' && r.status === 'maybe').length,
            },
            ranged_dps: {
              attending: rsvps.filter((r: EventRsvp) => r.role === 'ranged_dps' && r.status === 'attending').length +
                         guestRsvps.filter((g: any) => g.role === 'ranged_dps').length,
              maybe: rsvps.filter((r: EventRsvp) => r.role === 'ranged_dps' && r.status === 'maybe').length,
            },
            melee_dps: {
              attending: rsvps.filter((r: EventRsvp) => r.role === 'melee_dps' && r.status === 'attending').length +
                         guestRsvps.filter((g: any) => g.role === 'melee_dps').length,
              maybe: rsvps.filter((r: EventRsvp) => r.role === 'melee_dps' && r.status === 'maybe').length,
            },
          },
          user_rsvp: userId ? rsvps.find((r: EventRsvp) => r.user_id === userId) || null : null,
        };
      });

      setEvents(eventsWithRsvps);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    }
  }, [groupId, userId]);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    if (!groupId) return;

    if (getClientAuthStack() === 'v2') {
      const { announcements: apiAnnouncements } = await fetchEventsViaApi();
      setAnnouncements(apiAnnouncements);
      return;
    }

    try {
      const { data, error: annError } = await supabase
        .from('announcements')
        .select('*')
        .eq('group_id', groupId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (annError) throw annError;
      setAnnouncements(data || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
  }, [fetchEventsViaApi, groupId]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (groupId && getClientAuthStack() === 'v2') {
      try {
        const payload = await fetchEventsViaApi();
        setEvents(payload.events);
        setAnnouncements(payload.announcements);
      } catch (err) {
        console.error('Error fetching events via API:', err);
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
      return;
    }

    await Promise.all([fetchEvents(), fetchAnnouncements()]);
    setLoading(false);
  }, [fetchEvents, fetchAnnouncements, groupId, gameSlug, userId]);

  // Initial fetch
  useEffect(() => {
    if (groupId) {
      const timerId = setTimeout(() => {
        void fetchData();
      }, 0);

      return () => clearTimeout(timerId);
    }
  }, [groupId, fetchData]);

  // Create event
  const createEvent = async (
    event: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'is_cancelled'>,
    sendDiscordNotification: boolean
  ): Promise<Event | null> => {
    if (!isEventTypeAllowedForGame(event.event_type, gameSlug || 'aoc')) {
      const message = 'Invalid event type for this game';
      setError(message);
      throw new Error(message);
    }
    // Ensure game_slug is set
    const eventWithGame = {
      ...event,
      game_slug: gameSlug || 'aoc'
    };

    if (getClientAuthStack() === 'v2') {
      const response = await fetch('/api/group/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_event',
          group_id: event.group_id,
          event: eventWithGame,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const message = payload.details || payload.error || `Failed to create event (${response.status})`;
        setError(message);
        throw new Error(message);
      }

      const payload = (await response.json()) as { event?: Event };
      if (sendDiscordNotification && payload.event) await notifySaved(payload.event.id);
      await fetchData();
      return payload.event || null;
    }

    const { data, error: createError } = await supabase
      .from('events')
      .insert(eventWithGame)
      .select()
      .single();

    if (createError) {
      setError(createError.message);
      throw createError;
    }

    if (sendDiscordNotification) await notifySaved(data.id);

    await fetchEvents();
    return data;
  };

  const notifySaved = async (id: string, announcement = false) => {
    try {
      const result = await (announcement ? postAnnouncementNotification(id, gameSlug || 'aoc') : postEventNotification(id));
      if (result.skipped) showToast('info', t('webhooks.skippedNotice'));
    } catch (error) {
      console.error('Discord notification failed after saving:', error);
      showToast('warning', t('webhooks.savedWarning'), 10000);
    }
  };

  // Update event
  const updateEvent = async (id: string, updates: Partial<Event>) => {
    const currentEvent = events.find(event => event.id === id);
    if (updates.event_type !== undefined &&
      !isEventTypeAllowedForGame(updates.event_type, gameSlug || currentEvent?.game_slug || 'aoc', currentEvent?.event_type)) {
      const message = 'Invalid event type for this game';
      setError(message);
      throw new Error(message);
    }
    if (getClientAuthStack() === 'v2') {
      if (!groupId) {
        throw new Error('Missing group id');
      }

      const response = await fetch('/api/group/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_event',
          group_id: groupId,
          id,
          updates,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const message = payload.details || payload.error || `Failed to update event (${response.status})`;
        setError(message);
        throw new Error(message);
      }

      await fetchData();
      return;
    }

    const { error: updateError } = await supabase
      .from('events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (updateError) {
      setError(updateError.message);
      throw updateError;
    }

    await fetchEvents();
  };

  // Cancel event
  const cancelEvent = async (id: string) => {
    if (getClientAuthStack() === 'v2') {
      if (!groupId) {
        throw new Error('Missing group id');
      }

      const response = await fetch('/api/group/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel_event',
          group_id: groupId,
          id,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const message = payload.details || payload.error || `Failed to cancel event (${response.status})`;
        setError(message);
        throw new Error(message);
      }

      await fetchData();
      return;
    }

    await updateEvent(id, { is_cancelled: true });
  };

  // Delete event
  const deleteEvent = async (id: string) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (getClientAuthStack() === 'v2') {
      if (!groupId) {
        throw new Error('Missing group id');
      }

      const response = await fetch('/api/group/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete_event',
          group_id: groupId,
          id,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const message = payload.details || payload.error || `Failed to delete event (${response.status})`;
        setError(message);
        throw new Error(message);
      }

      await fetchData();
      return;
    }

    try {
      // Fetch the event to check ownership and get group_id
      const { data: event, error: fetchError } = await supabase
        .from('events')
        .select('created_by, group_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching event:', fetchError);
        setError('Event not found');
        throw new Error('Event not found');
      }

      if (!event) {
        throw new Error('Event not found');
      }

      // Get user's role in this group
      const { data: membership, error: membershipError } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', event.group_id)
        .eq('user_id', userId)
        .single();

      if (membershipError) {
        console.error('Error fetching user membership:', membershipError);
        setError('Failed to check permissions');
        throw new Error('Failed to check permissions');
      }

      if (!membership) {
        throw new Error('User is not a member of this group');
      }

      const userRole = membership.role;
      const isOwner = event.created_by === userId;

      // Check permissions based on user's role
      const canDeleteAny = roleHasPermission(userRole, 'events_delete_any');
      const canDeleteOwn = roleHasPermission(userRole, 'events_delete_own');

      if (!canDeleteAny && (!canDeleteOwn || !isOwner)) {
        const errorMsg = 'You do not have permission to delete this event';
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      // Proceed with deletion
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
        .select();

      if (deleteError) {
        console.error('Error deleting event:', deleteError);
        setError(deleteError.message);
        throw deleteError;
      }

      await fetchEvents();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete event';
      console.error('Error in deleteEvent:', errorMsg);
      throw err;
    }
  };

  // Set RSVP
  const setRsvp = async (
    eventId: string,
    status: RsvpStatus,
    role?: EventRole | null,
    characterId?: string,
    targetUserId?: string,
    note?: string
  ) => {
    if (!userId) return;

    if (getClientAuthStack() === 'v2') {
      if (!groupId) {
        throw new Error('Missing group id');
      }

      const response = await fetch('/api/group/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set_rsvp',
          group_id: groupId,
          event_id: eventId,
          status,
          role: role || null,
          character_id: characterId || null,
          target_user_id: targetUserId || null,
          note: note || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const message = payload.details || payload.error || `Failed to set RSVP (${response.status})`;
        setError(message);
        throw new Error(message);
      }

      await fetchData();
      return;
    }

    // Use targetUserId if provided (admin responding on behalf), otherwise use current user
    const rsvpUserId = targetUserId || userId;

    const { error: rsvpError } = await supabase
      .from('event_rsvps')
      .upsert({
        event_id: eventId,
        user_id: rsvpUserId,
        status,
        role: role || null,
        character_id: characterId || null,
        note: note || null,
        responded_at: new Date().toISOString(),
      }, {
        onConflict: 'event_id,user_id'
      })
      .select();

    if (rsvpError) {
      setError(rsvpError.message);
      throw rsvpError;
    }

    // Refresh to get accurate counts
    await fetchEvents();
  };

  // Remove RSVP
  const removeRsvp = async (eventId: string) => {
    if (!userId) return;

    if (getClientAuthStack() === 'v2') {
      if (!groupId) {
        throw new Error('Missing group id');
      }

      const response = await fetch('/api/group/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'remove_rsvp',
          group_id: groupId,
          event_id: eventId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const message = payload.details || payload.error || `Failed to remove RSVP (${response.status})`;
        setError(message);
        throw new Error(message);
      }

      await fetchData();
      return;
    }

    const { error: deleteError } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .select();

    if (deleteError) {
      setError(deleteError.message);
      throw deleteError;
    }

    await fetchEvents();
  };

  // Create announcement
  const createAnnouncement = async (
    announcement: Omit<Announcement, 'id' | 'created_at' | 'updated_at'>,
    sendDiscordNotification: boolean
  ) => {
    if (getClientAuthStack() === 'v2') {
      const response = await fetch('/api/group/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_announcement',
          group_id: announcement.group_id,
          announcement,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const message = payload.details || payload.error || `Failed to create announcement (${response.status})`;
        setError(message);
        throw new Error(message);
      }

      const payload = await response.json() as { announcement: Announcement };
      if (sendDiscordNotification) await notifySaved(payload.announcement.id, true);
      await fetchData();
      return;
    }

    const { data, error: createError } = await supabase
      .from('announcements')
      .insert(announcement)
      .select()
      .single();

    if (createError) {
      setError(createError.message);
      throw createError;
    }

    if (sendDiscordNotification) await notifySaved(data.id, true);

    await fetchAnnouncements();
  };

  // Update announcement
  const updateAnnouncement = async (id: string, updates: Partial<Announcement>) => {
    if (getClientAuthStack() === 'v2') {
      if (!groupId) {
        throw new Error('Missing group id');
      }

      const response = await fetch('/api/group/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_announcement',
          group_id: groupId,
          id,
          updates,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const message = payload.details || payload.error || `Failed to update announcement (${response.status})`;
        setError(message);
        throw new Error(message);
      }

      await fetchData();
      return;
    }

    const { error: updateError } = await supabase
      .from('announcements')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (updateError) {
      setError(updateError.message);
      throw updateError;
    }

    await fetchAnnouncements();
  };

  // Delete announcement
  const deleteAnnouncement = async (id: string) => {
    if (getClientAuthStack() === 'v2') {
      if (!groupId) {
        throw new Error('Missing group id');
      }

      const response = await fetch('/api/group/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete_announcement',
          group_id: groupId,
          id,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        const message = payload.details || payload.error || `Failed to delete announcement (${response.status})`;
        setError(message);
        throw new Error(message);
      }

      await fetchData();
      return;
    }

    const { error: deleteError } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)
      .select();

    if (deleteError) {
      setError(deleteError.message);
      throw deleteError;
    }

    await fetchAnnouncements();
  };

  return {
    events,
    announcements,
    loading,
    error,
    createEvent,
    updateEvent,
    cancelEvent,
    deleteEvent,
    setRsvp,
    removeRsvp,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    refresh: fetchData,
  };
}
