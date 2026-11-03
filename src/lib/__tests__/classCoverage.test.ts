import { getClassCoverage } from '../classCoverage';
import type { CharacterWithProfessions } from '../types';

const character: CharacterWithProfessions = {
  id: 'main', group_id: 'group', user_id: 'user', name: 'Main', race: null,
  primary_archetype: null, secondary_archetype: null, level: 1, is_main: true,
  created_at: '', professions: [], wow_class: 'mage',
};

it('keeps zero-count classes and unknown characters while excluding other games', () => {
  const coverage = getClassCoverage('wowforever', [
    character,
    { ...character, id: 'missing', wow_class: null },
    { ...character, id: 'invalid', wow_class: 'removed-class' },
    { ...character, id: 'other-game', game_slug: 'aoc' },
  ]);
  expect(coverage.find(entry => entry.id === 'mage')?.characters).toEqual([character]);
  expect(coverage.find(entry => entry.id === 'warrior')?.characters).toEqual([]);
  expect(coverage.find(entry => entry.id === 'unknown')?.characters.map(entry => entry.id)).toEqual(['missing', 'invalid']);
  expect(coverage.reduce((count, entry) => count + entry.characters.length, 0)).toBe(3);
});

it('filters mains and alts and sorts mains first, then names, without mutating input', () => {
  const characters = [
    { ...character, id: 'z', name: 'Zed', is_main: false },
    { ...character, id: 'a', name: 'Aster', is_main: false },
    character,
  ];
  const names = (filter: 'all' | 'main' | 'alt') =>
    getClassCoverage('wowforever', characters, filter).find(entry => entry.id === 'mage')?.characters.map(entry => entry.name);
  expect(names('all')).toEqual(['Main', 'Aster', 'Zed']);
  expect(names('main')).toEqual(['Main']);
  expect(names('alt')).toEqual(['Aster', 'Zed']);
  expect(characters.map(entry => entry.name)).toEqual(['Zed', 'Aster', 'Main']);
});

it.each([
  ['aoc', { primary_archetype: 'mage' as const, secondary_archetype: 'cleric' as const }, 'mage', 8],
  ['ror', { ror_class: 'ironbreaker' }, 'ironbreaker', 24],
] as const)('uses the %s registry and character fields', (game, fields, id, count) => {
  const coverage = getClassCoverage(game, [{ ...character, game_slug: game, ...fields }]);
  expect(coverage).toHaveLength(count);
  expect(coverage.find(entry => entry.id === id)?.characters).toHaveLength(1);
});

it.each(['starcitizen', 'unsupported'])('does not infer classes for %s', game => {
  expect(getClassCoverage(game, [character])).toEqual([]);
});
