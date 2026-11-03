import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EventCard } from '../EventCard';
import type { EventWithRsvps } from '@/lib/events';
import { postEventNotification } from '@/lib/webhookClient';

jest.mock('@/lib/webhookClient', () => ({ postEventNotification: jest.fn() }));
jest.mock('@/components/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
jest.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ loading: false, hasPermission: (key: string) => mockPermissions.includes(key) }) }));
const mockShowToast = jest.fn();
let mockPermissions: string[];
const event: EventWithRsvps = {
  id: 'event-1', group_id: 'group-1', game_slug: 'wowforever', created_by: 'user-1',
  title: 'Guild raid', description: null, event_type: 'raid', starts_at: '2027-01-01T20:00:00Z',
  ends_at: null, location: null, max_attendees: null, tanks_min: 0, clerics_min: 0, bards_min: 0,
  ranged_dps_min: 0, melee_dps_min: 0, tanks_max: null, clerics_max: null, bards_max: null,
  ranged_dps_max: null, melee_dps_max: null, allow_combined_dps: false, combined_dps_max: null,
  ror_tanks_min: 0, ror_tanks_max: null, ror_healers_min: 0, ror_healers_max: null, ror_dps_min: 0,
  ror_dps_max: null, is_public: false, allow_allied_signups: false, is_cancelled: false,
  created_at: '2026-11-03T20:00:00Z', updated_at: '2026-11-03T20:00:00Z', rsvps: [],
  rsvp_counts: { attending: 0, maybe: 0, declined: 0 },
  role_counts: { tank: { attending: 0, maybe: 0 }, cleric: { attending: 0, maybe: 0 },
    bard: { attending: 0, maybe: 0 }, ranged_dps: { attending: 0, maybe: 0 }, melee_dps: { attending: 0, maybe: 0 } },
};
const props = { event, timezone: 'UTC', groupId: 'group-1', userId: 'user-1', characters: [], onRsvp: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions = ['events_create'];
  jest.mocked(postEventNotification).mockResolvedValue({ success: true });
});

it('reposts the persisted event and prevents duplicate clicks while in flight', async () => {
  let resolve!: (value: { success: boolean }) => void;
  jest.mocked(postEventNotification).mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<EventCard {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'webhooks.repost' }));
  expect(screen.getByRole('button', { name: 'webhooks.sending' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'webhooks.sending' }));
  expect(postEventNotification).toHaveBeenCalledTimes(1);
  expect(postEventNotification).toHaveBeenCalledWith(event.id, true);
  await act(async () => resolve({ success: true }));
  expect(mockShowToast).toHaveBeenCalledWith('success', 'webhooks.reposted');
});

it.each([false, true])('shows expanded class composition only for member views (public=%s)', isPublicView => {
  render(<EventCard {...props} isPublicView={isPublicView} />);
  expect(screen.queryByRole('region', { name: 'eventRoster.title' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Guild raid'));
  if (isPublicView) expect(screen.queryByRole('region', { name: 'eventRoster.title' })).not.toBeInTheDocument();
  else expect(screen.getByRole('region', { name: 'eventRoster.title' })).toBeInTheDocument();
});
it.each(['public', 'cancelled', 'other-owner', 'no-permission'])('hides repost for %s events or viewers', mode => {
  if (mode === 'no-permission') mockPermissions = [];
  render(<EventCard {...props} isPublicView={mode === 'public'}
    event={{ ...event, is_cancelled: mode === 'cancelled', created_by: mode === 'other-owner' ? 'other-user' : 'user-1' }} />);
  expect(screen.queryByRole('button', { name: 'webhooks.repost' })).not.toBeInTheDocument();
});

it("allows edit-any users to repost another owner's event", () => {
  mockPermissions = ['events_create', 'events_edit_any'];
  render(<EventCard {...props} userId="officer" />);
  expect(screen.getByRole('button', { name: 'webhooks.repost' })).toBeEnabled();
});

it.each(['failure', 'disabled'])('reports %s without modifying the saved event', async outcome => {
  if (outcome === 'failure') jest.mocked(postEventNotification).mockRejectedValue(new Error('Delivery failed'));
  else jest.mocked(postEventNotification).mockResolvedValue({ skipped: true });
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<EventCard {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'webhooks.repost' }));
  await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(
    ...(outcome === 'failure' ? ['error', 'webhooks.repostFailed', 10000] : ['info', 'webhooks.skippedNotice'])
  ));
  expect(props.onRsvp).not.toHaveBeenCalled();
  errorLog.mockRestore();
});
