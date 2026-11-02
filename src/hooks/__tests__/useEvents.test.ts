/**
 * Phase 2 Tests: Data Fetching Hooks
 * Tests for event and announcement management logic
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useEvents } from '../useEvents';

jest.mock('@/lib/webhookClient', () => ({
  postEventNotification: jest.fn(),
  postAnnouncementNotification: jest.fn(),
}));
jest.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/authStack', () => ({ getClientAuthStack: jest.fn(() => 'v1') }));
const mockShowToast = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '@/lib/supabase';
import { postEventNotification, postAnnouncementNotification } from '@/lib/webhookClient';
import { getClientAuthStack } from '@/lib/authStack';

const buildEventsQuery = (data: any, error: any = null) => ({
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  }),
});

const buildAnnouncementsQuery = (data: any, error: any = null) => ({
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      order: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  }),
});

const mockSupabase = jest.mocked(supabase);

describe('useEvents Hook - Phase 2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReset();
    jest.mocked(getClientAuthStack).mockReturnValue('v1');
    jest.mocked(postEventNotification).mockResolvedValue({ success: true });
    jest.mocked(postAnnouncementNotification).mockResolvedValue({ success: true });
  });

  it('fetches events and announcements with computed counts', async () => {
    const eventsData = [
      {
        id: 'event-1',
        group_id: 'group-123',
        game_slug: 'aoc',
        starts_at: '2024-02-01T00:00:00Z',
        event_rsvps: [
          { id: 'rsvp-1', user_id: 'user-1', status: 'attending', role: 'tank' },
          { id: 'rsvp-2', user_id: 'user-2', status: 'maybe', role: 'cleric' },
        ],
        guest_event_rsvps: [{ id: 'guest-1', role: 'tank' }],
      },
    ];

    const announcementsData = [
      { id: 'ann-1', group_id: 'group-123', title: 'Announcement' },
    ];

    mockSupabase.from
      .mockReturnValueOnce(buildEventsQuery(eventsData))
      .mockReturnValueOnce(buildAnnouncementsQuery(announcementsData));

    const { result } = renderHook(() => useEvents('group-123', 'user-1', 'aoc'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.announcements).toEqual(announcementsData);

    const event = result.current.events[0];
    expect(event.rsvp_counts.attending).toBe(2);
    expect(event.rsvp_counts.maybe).toBe(1);
    expect(event.role_counts.tank.attending).toBe(2);
    expect(event.role_counts.cleric.maybe).toBe(1);
    expect(event.user_rsvp?.user_id).toBe('user-1');
  });

  it.each([
    ['v1', true, false], ['v1', false, false], ['v1', true, true],
    ['v2', true, false], ['v2', false, false], ['v2', true, true],
  ] as const)('creates one event under %s, notify=%s, Discord fails=%s', async (stack, notify, fails) => {
    const createdEvent = {
      id: 'event-1',
      group_id: 'group-123',
      title: 'Raid Night',
      description: 'Test event',
      event_type: 'raid',
      starts_at: '2024-02-01T00:00:00Z',
      ends_at: '2024-02-01T02:00:00Z',
      location: 'Test',
      max_attendees: 10,
      tanks_min: 0,
      clerics_min: 0,
      bards_min: 0,
      ranged_dps_min: 0,
      melee_dps_min: 0,
      tanks_max: null,
      clerics_max: null,
      bards_max: null,
      ranged_dps_max: null,
      melee_dps_max: null,
      allow_combined_dps: false,
      combined_dps_max: null,
      ror_tanks_min: 0,
      ror_tanks_max: null,
      ror_healers_min: 0,
      ror_healers_max: null,
      ror_dps_min: 0,
      ror_dps_max: null,
      is_public: false,
      allow_allied_signups: false,
      is_cancelled: false,
      created_by: 'user-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      game_slug: 'aoc',
    };

    const eventsFetchQuery = buildEventsQuery([]);
    const announcementsQuery = buildAnnouncementsQuery([]);

    const eventsInsertQuery = {
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: createdEvent, error: null }),
        }),
      }),
    };

    mockSupabase.from
      .mockReturnValueOnce(eventsFetchQuery)
      .mockReturnValueOnce(announcementsQuery)
      .mockReturnValueOnce(eventsInsertQuery)
      .mockReturnValueOnce(eventsFetchQuery);

    jest.mocked(getClientAuthStack).mockReturnValue(stack);
    if (fails) jest.mocked(postEventNotification).mockRejectedValueOnce(new Error('Discord unavailable'));
    const fetchMock = jest.fn().mockImplementation((_url, options) => Promise.resolve({
      ok: true, json: async () => options?.method === 'POST' ? { event: createdEvent } : { events: [], announcements: [] },
    }));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useEvents('group-123', 'user-1', 'aoc', 'group-slug'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createEvent(
        {
          group_id: 'group-123',
          created_by: 'user-1',
          title: 'Raid Night',
          description: 'Test event',
          event_type: 'raid',
          starts_at: '2024-02-01T00:00:00Z',
          ends_at: '2024-02-01T02:00:00Z',
          location: 'Test',
          max_attendees: 10,
          tanks_min: 0,
          clerics_min: 0,
          bards_min: 0,
          ranged_dps_min: 0,
          melee_dps_min: 0,
          tanks_max: null,
          clerics_max: null,
          bards_max: null,
          ranged_dps_max: null,
          melee_dps_max: null,
          allow_combined_dps: false,
          combined_dps_max: null,
          ror_tanks_min: 0,
          ror_tanks_max: null,
          ror_healers_min: 0,
          ror_healers_max: null,
          ror_dps_min: 0,
          ror_dps_max: null,
          is_public: false,
          allow_allied_signups: false,
        },
        notify
      );
    });

    if (notify) expect(postEventNotification).toHaveBeenCalledWith(createdEvent.id);
    else expect(postEventNotification).not.toHaveBeenCalled();
    if (fails) expect(mockShowToast).toHaveBeenCalledWith('warning', 'webhooks.savedWarning', 10000);
    if (stack === 'v1') expect(eventsInsertQuery.insert).toHaveBeenCalledTimes(1);
    else expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it.each(['v1', 'v2'] as const)('sends and handles failed announcement notifications under %s', async stack => {
    jest.mocked(getClientAuthStack).mockReturnValue(stack);
    const announcement = { group_id: 'group-123', created_by: 'user-1', title: 'Guild news', content: 'News', is_pinned: false };
    const insert = jest.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { ...announcement, id: 'ann-1' }, error: null }) }) });
    mockSupabase.from
      .mockReturnValueOnce(buildEventsQuery([]))
      .mockReturnValueOnce(buildAnnouncementsQuery([]))
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce(buildAnnouncementsQuery([]));
    global.fetch = jest.fn().mockImplementation((_url, options) => Promise.resolve({
      ok: true, json: async () => options?.method === 'POST'
        ? { announcement: { ...announcement, id: 'ann-1' } } : { events: [], announcements: [] },
    }));
    jest.mocked(postAnnouncementNotification).mockRejectedValueOnce(new Error('Delivery failed'));
    const { result } = renderHook(() => useEvents('group-123', 'user-1', 'wowforever'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.createAnnouncement(announcement, true); });
    expect(postAnnouncementNotification).toHaveBeenCalledWith('ann-1');
    expect(mockShowToast).toHaveBeenCalledWith('warning', 'webhooks.savedWarning', 10000);
  });

  it('upserts RSVP and refreshes events', async () => {
    const eventsFetchQuery = buildEventsQuery([]);
    const announcementsQuery = buildAnnouncementsQuery([]);

    const rsvpQuery = {
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };

    mockSupabase.from
      .mockReturnValueOnce(eventsFetchQuery)
      .mockReturnValueOnce(announcementsQuery)
      .mockReturnValueOnce(rsvpQuery)
      .mockReturnValueOnce(eventsFetchQuery);

    const { result } = renderHook(() => useEvents('group-123', 'user-1', 'aoc'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.setRsvp('event-1', 'attending', 'tank', 'char-1');
    });

    expect(rsvpQuery.upsert).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('event_rsvps');
  });

  it('removes RSVP and refreshes events', async () => {
    const eventsFetchQuery = buildEventsQuery([]);
    const announcementsQuery = buildAnnouncementsQuery([]);

    const deleteQuery = {
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    };

    mockSupabase.from
      .mockReturnValueOnce(eventsFetchQuery)
      .mockReturnValueOnce(announcementsQuery)
      .mockReturnValueOnce(deleteQuery)
      .mockReturnValueOnce(eventsFetchQuery);

    const { result } = renderHook(() => useEvents('group-123', 'user-1', 'aoc'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeRsvp('event-1');
    });

    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('event_rsvps');
  });
});
