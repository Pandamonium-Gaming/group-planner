import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CharacterTransferControls } from '../CharacterTransferControls';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/authStack', () => ({ getClientAuthStack: () => 'v2' }));

const file = () => {
  const input = new File(['{}'], 'characters.json', { type: 'application/json' });
  Object.defineProperty(input, 'text', { value: async () => '{}' });
  return input;
};
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

it('shows unresolved owners and requires explicit confirmation after preview', async () => {
  const imported = jest.fn().mockResolvedValue(undefined);
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      token: 'preview-token', create_count: 1, update_count: 2,
      warnings: [{ name: 'Aster', owner: 'Missing owner' }],
    }) })
    .mockResolvedValueOnce({ ok: true });
  global.fetch = fetchMock;
  render(<CharacterTransferControls groupId="group" gameSlug="wowforever" archived={false} onImported={imported} />);
  fireEvent.change(screen.getByLabelText('characterTransfer.import'), { target: { files: [file()] } });
  await waitFor(() => expect(screen.getByText(/Missing owner/)).toBeInTheDocument());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ document: {} });
  expect(screen.getByText('characterTransfer.confirm')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('characterTransfer.confirmation'), { target: { value: 'IMPORT' } });
  fireEvent.click(screen.getByText('characterTransfer.confirm'));
  await waitFor(() => expect(imported).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    document: {}, token: 'preview-token', apply: true, confirmation: 'IMPORT',
  });
  expect(screen.getByRole('status')).toHaveTextContent('characterTransfer.success');
});

it('blocks import for archived games', () => {
  render(<CharacterTransferControls groupId="group" gameSlug="aoc" archived onImported={jest.fn()} />);
  expect(screen.getByLabelText('characterTransfer.import')).toBeDisabled();
  expect(screen.getByText('characterTransfer.export')).not.toBeDisabled();
});
