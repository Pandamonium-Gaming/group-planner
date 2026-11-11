import { notifyNewEvent, sendDiscordWebhook } from '../discord';
import type { Event } from '../events';
import { postEventNotification, webhookHeaders } from '../webhookClient';

jest.mock('../webhookClient', () => ({
  postEventNotification: jest.fn(),
  webhookHeaders: jest.fn(),
}));

const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
  jest.mocked(postEventNotification).mockResolvedValue({ success: true });
  jest.mocked(webhookHeaders).mockResolvedValue({ 'Content-Type': 'application/json' });
});

it.each(['event', 'repost'] as const)('routes legacy %s helpers through saved-event authorization, not the generic proxy', async kind => {
  const result = await sendDiscordWebhook('ignored-client-destination', { content: 'Ignored client payload' }, {
    groupId: 'group-1', subjectId: 'saved-event', kind,
  });
  expect(result).toEqual({ success: true });
  expect(postEventNotification).toHaveBeenCalledWith('saved-event', kind === 'repost');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('rejects event sends without a saved id and preserves delivery failure results', async () => {
  expect(await sendDiscordWebhook('', {}, { groupId: 'group-1', kind: 'event' }))
    .toEqual({ success: false, error: 'A saved event is required for Discord notifications' });
  expect(postEventNotification).not.toHaveBeenCalled();
  jest.mocked(postEventNotification).mockRejectedValue(new Error('Forbidden'));
  expect(await sendDiscordWebhook('', {}, { groupId: 'group-1', kind: 'repost', subjectId: 'saved-event' }))
    .toEqual({ success: false, error: 'Forbidden' });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('treats a server-authorized skip as a successful no-send result', async () => {
  jest.mocked(postEventNotification).mockResolvedValue({ skipped: true });
  expect(await sendDiscordWebhook('', {}, { groupId: 'group-1', kind: 'event', subjectId: 'saved-event' }))
    .toEqual({ success: true });
});

it('keeps webhook tests on the authenticated proxy with their group context', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  const webhook = 'https://discord.com/api/webhooks/123/test-token';
  const context = { groupId: 'group-1', kind: 'test' } as const;
  expect(await sendDiscordWebhook(webhook, { content: 'Test' }, context)).toEqual({ success: true });
  expect(postEventNotification).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith('/api/discord', expect.objectContaining({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  }));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).context).toEqual(context);
});

it.each(['wowforever', 'aoc'])('formats %s healer and combined DPS requirements in Discord', async game => {
  const send = jest.fn().mockResolvedValue({ success: true });
  await notifyNewEvent('', {
    id: 'event', group_id: 'group', game_slug: game, event_type: 'raid', title: 'Raid',
    starts_at: '2027-01-01T20:00:00Z', tanks_min: 0, tanks_max: null,
    clerics_min: 2, clerics_max: 3, bards_min: 1, bards_max: 1,
    ranged_dps_min: 0, ranged_dps_max: null, melee_dps_min: 0, melee_dps_max: null,
    allow_combined_dps: true, combined_dps_max: 5,
  } as Event, 'Guild', 'guild', null, send);
  const requirements = send.mock.calls[0][1].embeds[0].fields
    .find((field: { name: string }) => field.name.includes('Role Requirements')).value;
  expect(requirements).toContain(game === 'wowforever' ? '2-3 Healers' : '2-3 Clerics');
  expect(requirements).toContain('Max 5 DPS (Ranged + Melee)');
  if (game === 'wowforever') expect(requirements).not.toMatch(/Cleric|Bard/);
  else expect(requirements).toContain('1-1 Bard');
});
