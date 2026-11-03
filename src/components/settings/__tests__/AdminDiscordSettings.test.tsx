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
  expect(screen.getByText('Member role changed', { selector: 'p' })).toBeInTheDocument();
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
  expect(screen.queryByText('Member role changed', { selector: 'p' })).not.toBeInTheDocument();
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

it('saves per-type role mentions without replacing the private webhook', async () => {
  render(<AdminDiscordSettings groupId="group-1" />);
  await screen.findByText('An admin webhook is configured.');
  const input = screen.getByLabelText('Member role changed — Discord role ID');
  fireEvent.change(input, { target: { value: '123456789012345678' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save notification preferences' }));
  await screen.findByText('Saved!');
  expect(fetchMock).toHaveBeenCalledWith('/api/group/admin-notifications', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ group_id: 'group-1', role_mentions: { role_changed: '123456789012345678' }, categories: {} }),
  }));
  expect(screen.getByLabelText('New or replacement admin webhook URL')).toHaveValue('');
});

it('defaults group categories to enabled and saves disabling separately from the webhook', async () => {
  render(<AdminDiscordSettings groupId="group-1" />);
  await screen.findByText('An admin webhook is configured.');
  expect(screen.getAllByRole('checkbox')).toHaveLength(9);
  for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Member role changed' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save notification preferences' }));
  await screen.findByText('Saved!');
  expect(fetchMock).toHaveBeenCalledWith('/api/group/admin-notifications', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ group_id: 'group-1', role_mentions: {}, categories: { role_changed: false } }),
  }));
  expect(screen.queryByRole('checkbox', { name: 'New account' })).not.toBeInTheDocument();
});

it('shows only site categories and uses the separately protected site endpoint', async () => {
  render(<AdminDiscordSettings siteWide />);
  await screen.findByText('An admin webhook is configured.');
  expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  expect(screen.queryByRole('checkbox', { name: 'Member role changed' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'New account' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save notification preferences' }));
  await screen.findByText('Saved!');
  expect(fetchMock).toHaveBeenCalledWith('/api/admin/notifications/settings', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ role_mentions: {}, categories: { account_registered: false } }),
  }));
});

it('explains denied site access without rendering editable controls or history', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 403 });
  render(<AdminDiscordSettings siteWide />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Site administrator access is required');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

it('loads disabled categories and preserves unsaved changes while paging history', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({
    configured: true, categories: { role_changed: false }, role_mentions: {}, logs: [], hasMore: true,
  }) });
  render(<AdminDiscordSettings groupId="group-1" />);
  await screen.findByText('An admin webhook is configured.');
  const category = screen.getByRole('checkbox', { name: 'Member role changed' });
  expect(category).not.toBeChecked();
  fireEvent.click(category);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(category).toBeEnabled());
  expect(category).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save notification preferences' }));
  await screen.findByText('Saved!');
  expect(fetchMock).toHaveBeenCalledWith('/api/group/admin-notifications', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ group_id: 'group-1', role_mentions: {}, categories: { role_changed: true } }),
  }));
});

it('shows the specific message for a coded server failure and falls back for an uncoded one', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ code: 'site_role_config', error: 'x' }) });
  const { unmount } = render(<AdminDiscordSettings siteWide />);
  expect(await screen.findByRole('alert')).toHaveTextContent(en.adminNotifications.errors.site_role_config);
  unmount();
  fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error('not json'); } });
  render(<AdminDiscordSettings siteWide />);
  expect(await screen.findByRole('alert')).toHaveTextContent(en.adminNotifications.failed);
});
