import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CharactersTab } from '../CharactersTab';
import { DEFAULT_FILTERS, type CharacterFilters } from '@/components/characters/CharacterFilters';
import type { CharacterWithProfessions } from '@/lib/types';

jest.mock('@/components/characters/AddCharacterButton', () => ({ AddCharacterButton: () => null }));
jest.mock('@/components/auth/AuthProvider', () => ({ useAuthContext: () => ({ user: { id: 'viewer' } }) }));
jest.mock('@/contexts/ArchiveStatusContext', () => ({ useArchiveStatus: () => ({ isGameArchived: false }) }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useGroupMembership', () => ({
  useGroupMembership: () => ({ membership: { role: 'member' }, members: [] }),
}));

const characters: CharacterWithProfessions[] = [
  {
    id: 'first', name: 'First Character', group_id: 'group', user_id: 'owner',
    race: null, primary_archetype: null, secondary_archetype: null,
    level: 1, is_main: true, professions: [], created_at: '', wow_class: 'warrior',
  },
  {
    id: 'target', name: 'Target Character', group_id: 'group', user_id: 'other-owner',
    race: null, primary_archetype: null, secondary_archetype: null,
    level: 1, is_main: false, professions: [], created_at: '', wow_class: 'mage',
  },
];
const scrollIntoView = jest.fn();
const previousScroll = Element.prototype.scrollIntoView;
beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  window.history.replaceState({}, '', '/guild/wowforever/characters#character-target');
});
afterEach(() => {
  Element.prototype.scrollIntoView = previousScroll;
  window.history.replaceState({}, '', '/');
});

function Roster({ entries = characters, initialFilters = DEFAULT_FILTERS }: {
  entries?: CharacterWithProfessions[];
  initialFilters?: CharacterFilters;
}) {
  const [filters, setFilters] = useState(initialFilters);
  return <CharactersTab groupId="group" group={{ id: 'group', slug: 'guild', name: 'Guild', created_at: '' }}
    characters={entries} gameSlug="wowforever" addCharacter={jest.fn()} updateMember={jest.fn()}
    deleteMember={jest.fn()} setProfessionRank={jest.fn()} setEditingCharacter={jest.fn()}
    characterFilters={filters} setCharacterFilters={setFilters} />;
}

it('scrolls to the exact linked card once and leaves subsequent manual filtering alone', () => {
  render(<Roster />);
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('character-target'));
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  fireEvent.change(screen.getByRole('textbox', { name: 'character.searchPlaceholder' }), {
    target: { value: 'No matching character' },
  });
  expect(screen.queryByRole('heading', { name: 'Target Character' })).not.toBeInTheDocument();
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
});

it('waits for asynchronous character data before scrolling', () => {
  const { rerender } = render(<Roster entries={[]} />);
  expect(scrollIntoView).not.toHaveBeenCalled();
  rerender(<Roster />);
  expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('character-target'));
});

it('reveals a linked alt hidden by search, class and main-only filters', async () => {
  render(<Roster initialFilters={{ ...DEFAULT_FILTERS, search: 'First', characterType: 'main', wowClasses: ['warrior'] }} />);
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('textbox', { name: 'character.searchPlaceholder' })).toHaveValue('');
  expect(screen.getByRole('heading', { name: 'Target Character' })).toBeInTheDocument();
  expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('character-target'));
});

it('reveals a target above the default level limit', async () => {
  render(<Roster entries={[characters[0], { ...characters[1], level: 60 }]} />);
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('heading', { name: 'Target Character' })).toBeInTheDocument();
});

it('responds to another character fragment and browser history navigation', () => {
  render(<Roster />);
  act(() => {
    window.history.replaceState({}, '', '#character-first');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(scrollIntoView.mock.instances[1]).toBe(document.getElementById('character-first'));
  act(() => {
    window.history.replaceState({}, '', '#character-target');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(scrollIntoView.mock.instances[2]).toBe(document.getElementById('character-target'));
});

it('does not scroll or alter filters for unknown characters or unrelated fragments', () => {
  window.history.replaceState({}, '', '#character-missing');
  render(<Roster initialFilters={{ ...DEFAULT_FILTERS, search: 'First' }} />);
  expect(screen.getByRole('textbox', { name: 'character.searchPlaceholder' })).toHaveValue('First');
  act(() => {
    window.history.replaceState({}, '', '#other-section');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('reveals the same linked character again when returning through browser history', async () => {
  render(<Roster />);
  fireEvent.change(screen.getByRole('textbox', { name: 'character.searchPlaceholder' }), {
    target: { value: 'First' },
  });
  expect(screen.queryByRole('heading', { name: 'Target Character' })).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('heading', { name: 'Target Character' })).toBeInTheDocument();
});
