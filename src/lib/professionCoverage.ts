import { PROFESSIONS, getProfessionIcon } from '@/lib/professions';
import { WOW_FOREVER_PROFESSIONS, type WowForeverProfessionRank } from '@/games/wowforever/config';
import type { CharacterWithProfessions, RankLevel } from '@/lib/types';

export type ProfessionCharacterFilter = 'all' | 'main' | 'alt';
export interface ProfessionCoverage {
  id: string;
  name: string;
  icon: string;
  labelKey: string;
  characters: Array<{ character: CharacterWithProfessions; rank?: RankLevel; wowRank?: WowForeverProfessionRank | null }>;
}

export function getProfessionCoverage(
  gameSlug: string,
  characters: CharacterWithProfessions[],
  filter: ProfessionCharacterFilter = 'all'
): ProfessionCoverage[] {
  const definitions = gameSlug === 'aoc'
    ? PROFESSIONS.map(profession => ({ ...profession, icon: getProfessionIcon(profession.id) }))
    : gameSlug === 'wowforever'
      ? WOW_FOREVER_PROFESSIONS.map(name => ({ id: name, name, icon: '⚒️' }))
      : [];
  const filtered = characters.filter(character =>
    (!character.game_slug || character.game_slug === gameSlug) &&
    (filter === 'all' || (filter === 'main' ? character.is_main : !character.is_main))
  );
  return definitions.map(profession => ({
    id: profession.id,
    name: profession.name,
    icon: gameSlug === 'wowforever' ? WOW_PROFESSION_ICONS[profession.id] : profession.icon,
    labelKey: getProfessionLabelKey(profession.id),
    characters: filtered.flatMap<ProfessionCoverage['characters'][number]>(character => {
      if (gameSlug === 'wowforever') {
        return [character.wow_profession_1, character.wow_profession_2].includes(profession.id)
          ? [{ character, wowRank: character.wow_profession_1 === profession.id
            ? character.wow_profession_1_rank : character.wow_profession_2_rank }]
          : [];
      }
      const selected = character.professions.find(entry => entry.profession === profession.id);
      return selected ? [{ character, rank: selected.rank }] : [];
    }).sort((a, b) => Number(b.character.is_main) - Number(a.character.is_main) ||
      a.character.name.localeCompare(b.character.name)),
  }));
}

const WOW_PROFESSION_ICONS: Record<string, string> = {
  Alchemy: '⚗️',
  Blacksmithing: '⚒️',
  Enchanting: '✨',
  Engineering: '⚙️',
  Herbalism: '🌿',
  Leatherworking: '👜',
  Mining: '⛏️',
  Skinning: '🦴',
  Tailoring: '🧵',
};

const PROFESSION_LABEL_KEYS: Record<string, string> = {
  lumber_milling: 'professionOverview.lumberMilling',
  animal_husbandry: 'professions.animalHusbandry',
  weapon_smithing: 'professions.weaponsmithing',
  armor_smithing: 'professions.armorsmithing',
  arcane_engineering: 'professions.arcaneEngineering',
  Blacksmithing: 'professionOverview.blacksmithing',
  Enchanting: 'professionOverview.enchanting',
  Engineering: 'professionOverview.engineering',
  Skinning: 'professionOverview.skinning',
};

export function getProfessionLabelKey(id: string): string {
  return PROFESSION_LABEL_KEYS[id] || `professions.${id.toLowerCase()}`;
}
