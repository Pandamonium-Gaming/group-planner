import React from 'react';
import { render, screen } from '@testing-library/react';
import { ClanTabNav } from '../ClanTabNav';
import { GAME_TAB_ALLOWLIST, GAME_TAB_EXCLUSIONS } from '@/components/common/tabs';
import { WOW_FOREVER_CONFIG } from '@/games/wowforever/config/game';

jest.mock('next/navigation', () => ({
  usePathname: () => '/guild/wowforever/classes',
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const previousScrollTo = HTMLElement.prototype.scrollTo;
beforeEach(() => { HTMLElement.prototype.scrollTo = jest.fn(); });
afterEach(() => { HTMLElement.prototype.scrollTo = previousScrollTo; });

it.each(['aoc', 'ror', 'wowforever'])('links to and highlights the classes tab for %s', gameSlug => {
  render(<ClanTabNav groupSlug="guild" gameSlug={gameSlug} canManage={false} />);
  const link = screen.getByRole('link', { name: 'classOverview.title' });
  expect(link).toHaveAttribute('href', `/guild/${gameSlug}/classes`);
  expect(link).toHaveClass('text-indigo-300');
});

it('hides the class overview from Star Citizen navigation', () => {
  render(<ClanTabNav groupSlug="guild" gameSlug="starcitizen" canManage={false} />);
  expect(screen.queryByRole('link', { name: 'classOverview.title' })).not.toBeInTheDocument();
});

it('exposes the WoW economy route as Group Bank', () => {
  render(<ClanTabNav groupSlug="guild" gameSlug="wowforever" canManage={false} />);
  expect(screen.getByRole('link', { name: 'bank.title' })).toHaveAttribute('href', '/guild/wowforever/economy');
  expect(screen.queryByRole('link', { name: 'nav.economy' })).not.toBeInTheDocument();
  expect(GAME_TAB_ALLOWLIST.wowforever).toContain('economy');
  expect(GAME_TAB_EXCLUSIONS.wowforever).not.toContain('economy');
  expect(WOW_FOREVER_CONFIG.features.economy).toBe(true);
});

it('preserves the full Economy label for Ashes', () => {
  render(<ClanTabNav groupSlug="guild" gameSlug="aoc" canManage={false} />);
  expect(screen.getByRole('link', { name: 'nav.economy' })).toHaveAttribute('href', '/guild/aoc/economy');
});
