import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EventCard } from '../EventCard';
import { countEventRoles, type EventWithRsvps } from '@/lib/events';
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

it('shows all four WoW roles without requirements and signs up as a healer', async () => {
  render(<EventCard {...props} />);
  fireEvent.click(screen.getByText('Guild raid'));
  expect(screen.getByText('Role Composition')).toBeInTheDocument();
  expect(screen.queryByText('Cleric')).not.toBeInTheDocument();
  expect(screen.queryByText('Bard')).not.toBeInTheDocument();
  for (const role of ['Tank', 'wowForever.eventRoles.healer', 'Ranged DPS', 'Melee DPS']) {
    expect(screen.getByRole('button', { name: new RegExp(role) })).toBeEnabled();
  }
  fireEvent.click(screen.getByRole('button', { name: /wowForever.eventRoles.healer/ }));
  await waitFor(() => expect(props.onRsvp).toHaveBeenCalledWith('attending', 'cleric', undefined, undefined));
});

it.each([false, true])('shows max-only composition and disables a full healer role (public=%s)', isPublicView => {
  render(<EventCard {...props} isPublicView={isPublicView} event={{
    ...event, clerics_max: 2,
    role_counts: { ...event.role_counts, cleric: { attending: 1, maybe: 1 } },
  }} />);
  fireEvent.click(screen.getByText('Guild raid'));
  expect(screen.getByText('2/2')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /wowForever.eventRoles.healer.*Full/ })).toBeDisabled();
});

it('treats a zero maximum as closed but lets an existing healer keep their place', () => {
  const { rerender } = render(<EventCard {...props} event={{ ...event, clerics_max: 0 }} />);
  fireEvent.click(screen.getByText('Guild raid'));
  expect(screen.getByRole('button', { name: /wowForever.eventRoles.healer.*Full/ })).toBeDisabled();
  rerender(<EventCard {...props} event={{
    ...event, clerics_max: 1, role_counts: { ...event.role_counts, cleric: { attending: 0, maybe: 1 } },
    user_rsvp: { id: 'rsvp', event_id: event.id, user_id: props.userId, character_id: null,
      role: 'cleric', status: 'maybe', note: null, responded_at: event.created_at },
  }} />);
  expect(screen.getByRole('button', { name: /wowForever.eventRoles.healer/ })).toBeEnabled();
});

it('enforces event capacity for role signups and selected-role Attending but allows existing attendees to change roles', async () => {
  const atCapacity = { ...event, max_attendees: 5, rsvp_counts: { attending: 5, maybe: 0, declined: 0 } };
  const { rerender } = render(<EventCard {...props} event={atCapacity} />);
  fireEvent.click(screen.getByText('Guild raid'));
  expect(screen.getByRole('button', { name: '🛡️ Tank' })).toBeDisabled();
  expect(props.onRsvp).not.toHaveBeenCalled();

  rerender(<EventCard {...props} event={{ ...atCapacity, rsvp_counts: { attending: 4, maybe: 0, declined: 0 } }} />);
  fireEvent.click(screen.getByRole('button', { name: '🛡️ Tank' }));
  await waitFor(() => expect(props.onRsvp).toHaveBeenCalledWith('attending', 'tank', undefined, undefined));

  rerender(<EventCard {...props} event={atCapacity} />);
  expect(screen.getByRole('button', { name: '🛡️ Tank' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Attending (Full)' })).toBeDisabled();

  rerender(<EventCard {...props} event={{
    ...atCapacity,
    user_rsvp: { id: 'rsvp', event_id: event.id, user_id: props.userId, character_id: null,
      role: 'tank', status: 'attending', note: null, responded_at: event.created_at },
  }} />);
  expect(screen.getByRole('button', { name: '🛡️ Tank' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Attending' })).toBeEnabled();
});

it('enforces a shared DPS maximum even when no minimum or individual maximum is set', () => {
  const combined = { ...event, allow_combined_dps: true, combined_dps_max: 2,
    role_counts: { ...event.role_counts, ranged_dps: { attending: 1, maybe: 0 }, melee_dps: { attending: 0, maybe: 1 } } };
  const { rerender } = render(<EventCard {...props} event={combined} />);
  fireEvent.click(screen.getByText('Guild raid'));
  expect(screen.getByText('DPS (Combined)')).toBeInTheDocument();
  expect(screen.getByText('2/2')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Ranged DPS.*Full/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Melee DPS.*Full/ })).toBeDisabled();
  rerender(<EventCard {...props} event={{ ...combined,
    user_rsvp: { id: 'rsvp', event_id: event.id, user_id: props.userId, character_id: null,
      role: 'ranged_dps', status: 'attending', note: null, responded_at: event.created_at },
  }} />);
  expect(screen.getByRole('button', { name: /Melee DPS/ })).toBeEnabled();
});

it('lists older WoW Bard guests under Healer and excludes declined guests from the roster', () => {
  const guests: NonNullable<EventWithRsvps['guest_rsvps']> = [
    { id: 'guest-1', event_id: event.id, allied_group_id: null, guest_name: 'Legacy Bard',
      class_id: null, role: 'bard', status: 'maybe', created_at: event.created_at, updated_at: event.updated_at },
    { id: 'guest-2', event_id: event.id, allied_group_id: null, guest_name: 'Declined Healer',
      class_id: null, role: 'cleric', status: 'declined', created_at: event.created_at, updated_at: event.updated_at },
  ];
  render(<EventCard {...props} event={{ ...event, guest_rsvps: guests,
    role_counts: countEventRoles([], guests, 'wowforever') }} />);
  fireEvent.click(screen.getByText('Guild raid'));
  const composition = within(screen.getByText('Role Composition').parentElement!);
  expect(composition.getByText('Legacy Bard')).toBeInTheDocument();
  expect(composition.queryByText('Declined Healer')).not.toBeInTheDocument();
  expect(composition.getByText('wowForever.eventRoles.healer')).toBeInTheDocument();
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
