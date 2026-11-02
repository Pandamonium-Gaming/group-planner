import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { CharacterFiltersBar, DEFAULT_FILTERS, filterCharacters } from '../CharacterFilters';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

const characters = [
  { id: 'mage', name: 'Aster', professions: [], wow_class: 'mage', wow_profession_1: 'Alchemy', user_id: 'owner', is_main: true },
  { id: 'warrior', name: 'Briar', professions: [], wow_class: 'warrior', wow_profession_2: 'Mining', user_id: 'owner', is_main: false },
  { id: 'hunter', name: 'Cedar', professions: [], wow_class: 'hunter', wow_profession_1: 'Mining', user_id: 'other', is_main: true },
];

it('combines OR within each multi-select and AND between categories and main/alt', () => {
  expect(filterCharacters(characters, { ...DEFAULT_FILTERS, wowClasses: ['mage', 'warrior'] })
    .map(character => character.id)).toEqual(['mage', 'warrior']);
  expect(filterCharacters(characters, { ...DEFAULT_FILTERS, wowProfessions: ['Alchemy', 'Mining'] })).toHaveLength(3);
  expect(filterCharacters(characters, { ...DEFAULT_FILTERS, wowClasses: ['mage', 'warrior'], wowProfessions: ['Mining'] })
    .map(character => character.id)).toEqual(['warrior']);
  expect(filterCharacters(characters, { ...DEFAULT_FILTERS, search: 'Aster', wowProfessions: ['Mining'], characterType: 'alt' })
    .map(character => character.id)).toEqual(['warrior']);
  expect(filterCharacters(characters, DEFAULT_FILTERS)).toHaveLength(3);
});

it('allows selecting multiple class and profession checkboxes and clearing them', () => {
  const changed = jest.fn();
  const { rerender } = render(<CharacterFiltersBar filters={DEFAULT_FILTERS} onChange={changed}
    characterCount={3} filteredCount={3} gameSlug="wowforever" />);
  fireEvent.click(screen.getByText('filters.title'));
  fireEvent.click(screen.getByLabelText('Mage'));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ wowClasses: ['mage'] }));
  rerender(<CharacterFiltersBar filters={{ ...DEFAULT_FILTERS, wowClasses: ['mage'] }} onChange={changed}
    characterCount={3} filteredCount={1} gameSlug="wowforever" />);
  fireEvent.click(screen.getByLabelText('Warrior'));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ wowClasses: ['mage', 'warrior'] }));
});
