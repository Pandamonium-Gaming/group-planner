import React from 'react';
import { render, screen } from '@testing-library/react';
import { CharacterCard } from '../MemberCard';
import type { CharacterWithProfessions } from '@/lib/types';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
const character: CharacterWithProfessions = {
  id: 'main', group_id: 'group', user_id: 'owner', name: 'Aster', race: null,
  primary_archetype: null, secondary_archetype: null, level: 1, is_main: true, created_at: '',
  professions: [], owner: { display_name: 'Custom name', discord_username: 'Discord name' },
};
const actions = { onUpdate: jest.fn(), onDelete: jest.fn(), onSetProfessionRank: jest.fn() };

it('uses the profile override and provides a localized hover/accessible main label', () => {
  render(<CharacterCard character={character} {...actions} gameSlug="wowforever" />);
  expect(screen.getByText('Custom name')).toBeInTheDocument();
  expect(screen.queryByText('Discord name')).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'character.mainCharacter' })).toHaveAttribute('title', 'character.mainCharacter');
});

it('falls back to Discord username and identifies unclaimed characters', () => {
  const { rerender } = render(<CharacterCard character={{ ...character,
    owner: { display_name: null, discord_username: 'Discord name' } }} {...actions} gameSlug="wowforever" />);
  expect(screen.getByText('Discord name')).toBeInTheDocument();
  rerender(<CharacterCard character={{ ...character, user_id: null, owner: null }} {...actions} gameSlug="wowforever" />);
  expect(screen.getByText('character.unclaimed')).toBeInTheDocument();
});
