import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PublicGroupPage from '../page';

(globalThis as unknown as { React: typeof React }).React = React; // the page relies on the automatic JSX runtime
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/layout/Footer', () => ({ InlineFooter: () => null }));
jest.mock('@/components/forms/RecruitmentForm', () => ({
  RecruitmentForm: ({ groupGames }: { groupGames: unknown[] }) => <div data-testid="form">{JSON.stringify(groupGames)}</div>,
}));

const params = Object.assign(Promise.resolve({ group: 'g' }), { status: 'fulfilled', value: { group: 'g' } }) as Promise<{ group: string }>;

function mockFetch(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body }) as never;
}
const base = {
  group: { id: 'g1', name: 'Guild', slug: 'g', is_public: true, recruitment_open: true },
  memberCount: 1,
  upcomingEvents: 0,
};

it('shows the not-found state instead of the form when groupGames is missing', async () => {
  mockFetch(base);
  render(<PublicGroupPage params={params} />);
  await waitFor(() => expect(screen.getByText('publicPage.clanNotFound')).toBeInTheDocument());
  expect(screen.queryByTestId('form')).not.toBeInTheDocument();
});

it('passes the group games through to the recruitment form', async () => {
  const games = [{ game_slug: 'aoc', archived: false }];
  mockFetch({ ...base, groupGames: games });
  render(<PublicGroupPage params={params} />);
  await waitFor(() => expect(screen.getByText('Guild')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /apply|recruit/i }));
  expect(screen.getByTestId('form').textContent).toBe(JSON.stringify(games));
});
