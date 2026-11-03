import { ARCHETYPES } from '@/lib/characters';
import { ROR_CLASSES } from '@/games/returnofreckooning/config';
import { WOW_FOREVER_CLASSES } from '@/games/wowforever/config';
import type { CharacterWithProfessions } from '@/lib/types';

export type ClassCharacterFilter = 'all' | 'main' | 'alt';

export interface ClassCoverage {
  id: string;
  name: string;
  labelKey?: string;
  icon?: string;
  characters: CharacterWithProfessions[];
}

export function getClassCoverage(
  gameSlug: string,
  characters: CharacterWithProfessions[],
  filter: ClassCharacterFilter = 'all'
): ClassCoverage[] {
  const definitions = gameSlug === 'aoc'
    ? Object.entries(ARCHETYPES).map(([id, info]) => ({ id, name: info.name, icon: info.icon, labelKey: `archetypes.${id}` }))
    : gameSlug === 'wowforever' ? WOW_FOREVER_CLASSES
      : gameSlug === 'ror' ? ROR_CLASSES : [];
  if (definitions.length === 0) return [];

  const coverage: ClassCoverage[] = definitions.map(definition => ({ ...definition, characters: [] }));
  const unknown: ClassCoverage = {
    id: 'unknown', name: '', labelKey: 'eventRoster.unknownClass', characters: [],
  };
  const byId = new Map(coverage.map(entry => [entry.id, entry]));

  for (const character of characters) {
    if (character.game_slug && character.game_slug !== gameSlug) continue;
    if (filter !== 'all' && (filter === 'main' ? !character.is_main : character.is_main)) continue;
    const classId = gameSlug === 'wowforever' ? character.wow_class
      : gameSlug === 'ror' ? character.ror_class : character.primary_archetype;
    (byId.get(classId || '') || unknown).characters.push(character);
  }
  if (unknown.characters.length > 0) coverage.push(unknown);
  for (const entry of coverage) {
    entry.characters.sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.name.localeCompare(b.name));
  }
  return coverage;
}
