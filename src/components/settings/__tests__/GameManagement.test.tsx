import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GameManagement } from '../GameManagement';
import en from '../../../../public/locales/en-GB.json';
import * as groupGames from '@/lib/group-games';

// Jest uses the classic JSX transform; shared components (Modal) rely on a global React.
(globalThis as { React?: typeof React }).React = React;

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string, params?: Record<string, string>) => {
    let value: unknown = en;
    for (const part of key.split('.')) {
      value = value && typeof value === 'object' && part in value ? Reflect.get(value, part) : undefined;
    }
    if (typeof value !== 'string') return key;
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => params?.[k] ?? '');
  } }),
}));
jest.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true, loading: false }),
}));
jest.mock('@/lib/group-games', () => ({
  getGroupGames: jest.fn(),
  archiveGameForGroup: jest.fn(),
  unarchiveGameForGroup: jest.fn(),
  deleteGameForGroup: jest.fn(),
}));

const mocked = groupGames as jest.Mocked<typeof groupGames>;
const ARCHIVED_NAME = 'Ashes of Creation';

beforeEach(() => {
  jest.clearAllMocks();
  // active: only wowforever; all: aoc (archived) + wowforever
  mocked.getGroupGames.mockImplementation(async (_g: string, includeArchived?: boolean) =>
    includeArchived ? ['aoc', 'wowforever'] : ['wowforever']);
});

async function openDialog() {
  render(<GameManagement groupId="group-1" />);
  fireEvent.click(await screen.findByRole('button', { name: /Delete permanently/ }));
  return screen.findByRole('dialog');
}
const confirmButton = () => screen.getAllByRole('button', { name: /Delete permanently/ }).slice(-1)[0];

it('shows Delete permanently only on archived games', async () => {
  render(<GameManagement groupId="group-1" />);
  await screen.findByText(ARCHIVED_NAME);
  expect(screen.getAllByRole('button', { name: /Delete permanently/ })).toHaveLength(1);
});

it('opens an accessible dialog that keeps confirm disabled until the exact name is typed', async () => {
  const dialog = await openDialog();
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAccessibleName();
  const input = screen.getByRole('textbox');
  await waitFor(() => expect(input).toHaveFocus());
  expect(confirmButton()).toBeDisabled();
  for (const wrong of ['ashes of creation', ARCHIVED_NAME + ' ', ' ' + ARCHIVED_NAME, 'Ashes']) {
    fireEvent.change(input, { target: { value: wrong } });
    expect(confirmButton()).toBeDisabled();
  }
  fireEvent.change(input, { target: { value: ARCHIVED_NAME } });
  expect(confirmButton()).toBeEnabled();
});

it('Escape and Cancel close the dialog without deleting', async () => {
  await openDialog();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getAllByRole('button', { name: /Delete permanently/ })[0]);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mocked.deleteGameForGroup).not.toHaveBeenCalled();
});

it('deletes with the typed text, closes, removes the game and shows success', async () => {
  mocked.deleteGameForGroup.mockResolvedValue({ ok: true });
  await openDialog();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ARCHIVED_NAME } });
  mocked.getGroupGames.mockImplementation(async (_g: string, includeArchived?: boolean) =>
    includeArchived ? ['wowforever'] : ['wowforever']);
  fireEvent.click(confirmButton());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(mocked.deleteGameForGroup).toHaveBeenCalledWith('group-1', 'aoc', ARCHIVED_NAME);
  await waitFor(() => expect(screen.queryByText(ARCHIVED_NAME)).not.toBeInTheDocument());
  expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();
});

it('keeps the dialog open with the localised message for a known error code', async () => {
  mocked.deleteGameForGroup.mockResolvedValue({ ok: false, code: 'game_not_archived' });
  await openDialog();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ARCHIVED_NAME } });
  fireEvent.click(confirmButton());
  const dialog = await screen.findByRole('dialog');
  expect(await screen.findByText(en.gameManagement.errors.game_not_archived)).toBeInTheDocument();
  expect(dialog).toBeInTheDocument();
});

it.each(['bad_request', null])('falls back to the generic message for code %s', async (code) => {
  mocked.deleteGameForGroup.mockResolvedValue({ ok: false, code });
  await openDialog();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ARCHIVED_NAME } });
  fireEvent.click(confirmButton());
  expect(await screen.findByText(en.gameManagement.deleteFailed)).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
