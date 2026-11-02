import { sendDiscordWebhook } from '../discord';
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
