import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminDiscordSettings } from '../AdminDiscordSettings';
import en from '../../../../public/locales/en-GB.json';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => {
    let value: unknown = en;
    for (const part of key.split('.')) {
      value = value && typeof value === 'object' && part in value ? Reflect.get(value, part) : undefined;
    }
    return typeof value === 'string' ? value : key;
  } }),
}));
jest.mock('@/lib/webhookClient', () => ({ webhookHeaders: async () => ({ 'Content-Type': 'application/json' }) }));
const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({
    configured: true, hasMore: true, logs: [{
      id: 'notice-1', kind: 'role_changed', status: 'uncertain', http_status: null,
      error: 'Delivery failed or timed out; check Discord before retrying', created_at: '2026-11-03T08:00:00Z',
    }],
  }) });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('shows private configuration status and delivery history without exposing a saved URL', async () => {
  render(<AdminDiscordSettings groupId="group-1" />);
  expect(await screen.findByText('An admin webhook is configured.')).toBeInTheDocument();
  expect(screen.getByText('Member role changed')).toBeInTheDocument();
  expect(screen.getByText(/Delivery uncertain/)).toBeInTheDocument();
  const input = screen.getByLabelText('New or replacement admin webhook URL');
  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Disable admin webhook' })).toBeEnabled();
});

it('saves a replacement, clears the secret input and refreshes the history', async () => {
  render(<AdminDiscordSettings groupId="group-1" />);
  await screen.findByText('An admin webhook is configured.');
  const input = screen.getByLabelText('New or replacement admin webhook URL');
  fireEvent.change(input, { target: { value: 'https://discord.com/api/webhooks/123/private-test-token' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Saved!')).toBeInTheDocument();
  expect(input).toHaveValue('');
  expect(fetchMock).toHaveBeenCalledWith('/api/group/admin-notifications', expect.objectContaining({
    method: 'POST', credentials: 'include',
    body: JSON.stringify({ group_id: 'group-1', webhook_url: 'https://discord.com/api/webhooks/123/private-test-token' }),
  }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
});

it('disables explicitly without treating a blank replacement as a disable request', async () => {
  render(<AdminDiscordSettings groupId="group-1" />);
  await screen.findByText('An admin webhook is configured.');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Disable admin webhook' }));
  await screen.findByText('Saved!');
  expect(fetchMock).toHaveBeenCalledWith('/api/group/admin-notifications', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ group_id: 'group-1', webhook_url: '' }),
  }));
});

it('paginates and refreshes the admin-only history', async () => {
  render(<AdminDiscordSettings groupId="group-1" />);
  await screen.findByText('An admin webhook is configured.');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('page=1'), expect.anything()));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
});

it('shows authorization/load errors and never displays stale records', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 403 });
  render(<AdminDiscordSettings groupId="group-1" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load or save');
  expect(screen.queryByText('Member role changed')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

it('shows save failures and retains the unsaved value for correction', async () => {
  render(<AdminDiscordSettings groupId="group-1" />);
  await screen.findByText('An admin webhook is configured.');
  fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });
  const input = screen.getByLabelText('New or replacement admin webhook URL');
  fireEvent.change(input, { target: { value: 'invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load or save');
  expect(input).toHaveValue('invalid');
  expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
});
