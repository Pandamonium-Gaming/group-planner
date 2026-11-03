import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecruitmentForm } from '../RecruitmentForm';

const insert = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({ insert: (...a: unknown[]) => ({ select: () => insert(...a) }) })),
  },
}));

const rows = (...r: Array<[string, boolean?]>) => r.map(([game_slug, archived]) => ({ game_slug, archived: !!archived }));

function setup(groupGames: Array<{ game_slug: string; archived: boolean }>) {
  insert.mockResolvedValue({ error: null });
  const onSuccess = jest.fn();
  render(<RecruitmentForm groupId="g1" groupName="Guild" groupGames={groupGames} onClose={jest.fn()} onSuccess={onSuccess} />);
  fireEvent.change(screen.getByPlaceholderText(/username/), { target: { value: 'bob' } });
  return { onSuccess };
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: /submit/i }));

beforeEach(() => insert.mockReset());

it('preselects the only game and saves game_slug', async () => {
  setup(rows(['wowforever']));
  expect(screen.queryByLabelText('Game *')).not.toBeInTheDocument();
  expect(screen.getByText('WoW Forever')).toBeInTheDocument();
  submit();
  await waitFor(() => expect(insert).toHaveBeenCalled());
  expect(insert.mock.calls[0][0]).toMatchObject({ group_id: 'g1', game_slug: 'wowforever' });
});

it('requires a choice when several games are available', async () => {
  setup(rows(['aoc'], ['wowforever']));
  const picker = screen.getByLabelText('Game *') as HTMLSelectElement;
  expect(picker.value).toBe('');
  submit();
  expect(insert).not.toHaveBeenCalled();
  fireEvent.change(picker, { target: { value: 'aoc' } });
  submit();
  await waitFor(() => expect(insert).toHaveBeenCalled());
  expect(insert.mock.calls[0][0].game_slug).toBe('aoc');
});

it('never offers archived games', () => {
  setup(rows(['aoc'], ['wowforever', true], ['ror']));
  const values = Array.from((screen.getByLabelText('Game *') as HTMLSelectElement).options).map(o => o.value);
  expect(values).toEqual(['', 'aoc', 'ror']);
});

it('offers every registry game for a legacy group with no rows', () => {
  setup([]);
  const values = Array.from((screen.getByLabelText('Game *') as HTMLSelectElement).options).map(o => o.value);
  expect(values).toEqual(['', 'aoc', 'starcitizen', 'ror', 'wowforever']);
});

it('does not fall back to all games when every configured game is archived', () => {
  setup(rows(['aoc', true]));
  expect(screen.queryByLabelText('Game *')).not.toBeInTheDocument();
  expect(screen.getByText(/not currently accepting/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
});

it('follows the chosen game for classes and resets on change', async () => {
  setup(rows(['aoc'], ['wowforever'], ['starcitizen']));
  const game = screen.getByLabelText('Game *');
  fireEvent.change(game, { target: { value: 'aoc' } });
  let cls = screen.getByLabelText(/Primary/) as HTMLSelectElement;
  expect(Array.from(cls.options).some(o => o.textContent?.includes('Tank'))).toBe(true);
  fireEvent.change(cls, { target: { value: 'tank' } });
  fireEvent.change(game, { target: { value: 'wowforever' } });
  cls = screen.getByLabelText(/Primary/) as HTMLSelectElement;
  expect(cls.value).toBe('');
  expect(Array.from(cls.options).some(o => o.textContent?.includes('Druid'))).toBe(true);
  expect(Array.from(cls.options).some(o => o.textContent?.includes('Tank'))).toBe(false);
  fireEvent.change(cls, { target: { value: 'druid' } });
  submit();
  await waitFor(() => expect(insert).toHaveBeenCalled());
  expect(insert.mock.calls[0][0]).toMatchObject({ game_slug: 'wowforever', primary_class: 'druid' });
});

it('hides the class field for games with no class list', () => {
  setup(rows(['starcitizen']));
  expect(screen.queryByLabelText(/Primary/)).not.toBeInTheDocument();
});

it('treats the legacy star-citizen row as starcitizen', () => {
  setup(rows(['star-citizen']));
  expect(screen.getByText('Star Citizen')).toBeInTheDocument();
});
