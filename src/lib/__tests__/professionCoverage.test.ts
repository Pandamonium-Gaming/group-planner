import { getProfessionCoverage } from '../professionCoverage';
import type { CharacterWithProfessions } from '../types';
import { GAMES } from '../games';
import { GAME_TAB_ALLOWLIST, GAME_TAB_EXCLUSIONS } from '@/components/common/tabs';

function character(overrides: Partial<CharacterWithProfessions> = {}): CharacterWithProfessions {
  return {
    id: 'main', group_id: 'group', user_id: 'user', name: 'Main Crafter',
    race: null, primary_archetype: null, secondary_archetype: null,
    level: 1, is_main: true, created_at: '', professions: [],
    ...overrides,
  };
}

describe('profession coverage', () => {
  it('shows all nine WoW professions, deduplicating both slots per character', () => {
    const main = character({ game_slug: 'wowforever', wow_profession_1: 'Alchemy', wow_profession_2: 'Alchemy' });
    const alt = character({ id: 'alt', name: 'Alt Crafter', is_main: false, game_slug: 'wowforever',
      wow_profession_1: 'Alchemy', wow_profession_2: 'Tailoring' });
    const otherGame = character({ id: 'other', game_slug: 'aoc', wow_profession_1: 'Alchemy' });
    const cards = getProfessionCoverage('wowforever', [alt, main, otherGame]);
    expect(cards).toHaveLength(9);
    expect(cards.find(card => card.id === 'Alchemy')?.characters.map(entry => entry.character.id)).toEqual(['main', 'alt']);
    expect(cards.find(card => card.id === 'Tailoring')?.characters).toHaveLength(1);
    expect(cards.find(card => card.id === 'Mining')?.characters).toEqual([]);
    expect(getProfessionCoverage('wowforever', [main, alt], 'main').find(card => card.id === 'Alchemy')?.characters).toHaveLength(1);
    expect(getProfessionCoverage('wowforever', [main, alt], 'alt').find(card => card.id === 'Tailoring')?.characters).toHaveLength(1);
  });

  it('uses all 22 Ashes professions and preserves existing ranks', () => {
    const miner = character({ professions: [{ id: 'profession', member_id: 'main', profession: 'mining',
      rank: 4, artisan_level: 50, quality_score: 0 }] });
    const cards = getProfessionCoverage('aoc', [miner]);
    expect(cards).toHaveLength(22);
    expect(cards.find(card => card.id === 'mining')?.characters[0].rank).toBe(4);
    expect(getProfessionCoverage('aoc', [], 'alt').every(card => card.characters.length === 0)).toBe(true);
  });

  it('only exposes the tab on games with tracked professions', () => {
    for (const game of Object.values(GAMES)) {
      expect(GAME_TAB_ALLOWLIST[game.id].includes('professions')).toBe(!!game.features.professions);
      expect((GAME_TAB_EXCLUSIONS[game.id] || []).includes('professions')).toBe(!game.features.professions);
    }
    expect(getProfessionCoverage('ror', [])).toEqual([]);
    expect(getProfessionCoverage('starcitizen', [])).toEqual([]);
  });
});
