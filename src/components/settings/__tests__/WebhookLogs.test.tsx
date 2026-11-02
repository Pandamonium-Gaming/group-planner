import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WebhookLogsPage from '@/app/[group]/settings/webhook-logs/page';

jest.mock('react', () => ({ ...jest.requireActual('react'), use: () => ({ group: 'guild' }) }));
jest.mock('@/hooks/useGroupData', () => ({ useGroupData: () => ({ group: { id: 'group-1' } }) }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/webhookClient', () => ({ webhookHeaders: async () => ({ Authorization: 'Bearer test-token' }) }));
const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ logs: [{
    id: 'log-1', game_slug: 'wowforever', kind: 'repost', subject_id: 'event-1', status: 'failed',
    http_status: 429, error: 'Discord rejected notification (HTTP 429)', created_at: '2026-11-03T20:00:00Z',
  }], hasMore: true }) });
});

it('shows delivery metadata, subject links, pagination and refresh', async () => {
  render(<WebhookLogsPage params={Promise.resolve({ group: 'guild' })} />);
  expect(await screen.findByText('webhooks.statuses.failed')).toBeInTheDocument();
  expect(screen.getByText('webhooks.kinds.repost')).toBeInTheDocument();
  expect(screen.getByText('HTTP 429')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'webhooks.viewSubject' })).toHaveAttribute('href', '/guild/wowforever/events#event-event-1');
  fireEvent.click(screen.getByRole('button', { name: 'webhooks.next' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('page=1'), expect.anything()));
  await waitFor(() => expect(screen.getByRole('button', { name: 'webhooks.refresh' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'webhooks.refresh' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
});

it('shows an explicit error and no records when admin authorization fails', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 403 });
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<WebhookLogsPage params={Promise.resolve({ group: 'guild' })} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('webhooks.loadFailed');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'webhooks.next' })).toBeDisabled();
  errorLog.mockRestore();
});
