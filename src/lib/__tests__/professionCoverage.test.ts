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
  it('preserves independent WoW trained ranks and leaves unknown ranks unrecorded', () => {
    const crafter = character({ game_slug: 'wowforever', wow_profession_1: 'Alchemy',
      wow_profession_1_rank: 'expert', wow_profession_2: 'Tailoring', wow_profession_2_rank: 'artisan' });
    const cards = getProfessionCoverage('wowforever', [crafter]);
    expect(cards.find(card => card.id === 'Alchemy')?.characters[0].wowRank).toBe('expert');
    expect(cards.find(card => card.id === 'Tailoring')?.characters[0].wowRank).toBe('artisan');
    expect(getProfessionCoverage('wowforever', [{ ...crafter, wow_profession_1_rank: null }])
      .find(card => card.id === 'Alchemy')?.characters[0].wowRank).toBeNull();
  });
  it('shows primary and secondary WoW professions, deduplicating both primary slots per character', () => {
    const main = character({ game_slug: 'wowforever', wow_profession_1: 'Alchemy', wow_profession_2: 'Alchemy' });
    const alt = character({ id: 'alt', name: 'Alt Crafter', is_main: false, game_slug: 'wowforever',
      wow_profession_1: 'Alchemy', wow_profession_2: 'Tailoring' });
    const otherGame = character({ id: 'other', game_slug: 'aoc', wow_profession_1: 'Alchemy' });
    const cards = getProfessionCoverage('wowforever', [alt, main, otherGame]);
    expect(cards).toHaveLength(12);
    expect(cards.find(card => card.id === 'Alchemy')?.characters.map(entry => entry.character.id)).toEqual(['main', 'alt']);
    expect(cards.find(card => card.id === 'Tailoring')?.characters).toHaveLength(1);
    expect(cards.find(card => card.id === 'Mining')?.characters).toEqual([]);
    expect(getProfessionCoverage('wowforever', [main, alt], 'main').find(card => card.id === 'Alchemy')?.characters).toHaveLength(1);
    expect(getProfessionCoverage('wowforever', [main, alt], 'alt').find(card => card.id === 'Tailoring')?.characters).toHaveLength(1);
  });

  it('includes secondary skills without consuming primary slots or inferring their rank from points', () => {
    const main = character({ wow_profession_1: 'Alchemy', wow_profession_2: 'Mining', wow_skills: [
      { name: 'Fishing', category: 'secondary', rank: null, current: 300, max: 300 },
      { name: 'Cooking', category: 'secondary', rank: 'expert', current: 175, max: 225 },
      { name: 'Swords', category: 'weapon', rank: null, current: 300, max: 300 },
    ] });
    const alt = character({ id: 'alt', is_main: false, wow_skills: [
      { name: 'Fishing', category: 'secondary', rank: 'artisan', current: 225, max: 300 },
    ] });
    const coverage = getProfessionCoverage('wowforever', [main, alt]);
    const fishing = coverage.find(card => card.id === 'Fishing')!;
    expect(fishing.characters.map(entry => entry.character.id)).toEqual(['alt', 'main']);
    expect(fishing.characters[1].wowRank).toBeNull();
    expect(fishing.characters[1].wowSkill).toEqual(main.wow_skills![0]);
    expect(coverage.find(card => card.id === 'Alchemy')?.characters).toHaveLength(1);
    expect(coverage.find(card => card.id === 'Mining')?.characters).toHaveLength(1);
    expect(coverage.some(card => card.id === 'Swords')).toBe(false);
    expect(getProfessionCoverage('wowforever', [main, alt], 'alt').find(card => card.id === 'Fishing')?.characters).toHaveLength(1);
    expect(getProfessionCoverage('aoc', [main]).some(card => card.id === 'Fishing')).toBe(false);
  });

  it('uses all 22 Ashes professions and preserves existing ranks', () => {
    const miner = character({ professions: [{ id: 'profession', member_id: 'main', profession: 'mining',
      rank: 4, artisan_level: 50, quality_score: 0 }] });
    const cards = getProfessionCoverage('aoc', [miner]);
    expect(cards).toHaveLength(22);
    expect(cards.find(card => card.id === 'mining')?.characters[0].rank).toBe(4);
    expect(getProfessionCoverage('aoc', [], 'alt').every(card => card.characters.length === 0)).toBe(true);
  });

  it('orders WoW crafters by this profession rank, then main status and name, with unrecorded ranks last', () => {
    const crafter = (id: string, is_main: boolean, wow_profession_1_rank?: CharacterWithProfessions['wow_profession_1_rank']) =>
      character({ id, name: id, is_main, game_slug: 'wowforever', wow_profession_1: 'Alchemy', wow_profession_1_rank });
    const cards = getProfessionCoverage('wowforever', [
      crafter('unrecorded-main', true),
      crafter('journeyman-main', true, 'journeyman'),
      crafter('expert-zeta', true, 'expert'),
      crafter('artisan-alt', false, 'artisan'),
      crafter('unrecorded-alt', false, null),
      crafter('apprentice-main', true, 'apprentice'),
      crafter('expert-alt', false, 'expert'),
      { ...crafter('expert-alpha', true, 'artisan'), wow_profession_1: 'Tailoring',
        wow_profession_2: 'Alchemy', wow_profession_2_rank: 'expert' },
    ]);
    expect(cards.find(card => card.id === 'Alchemy')?.characters.map(entry => entry.character.id)).toEqual([
      'artisan-alt', 'expert-alpha', 'expert-zeta', 'expert-alt', 'journeyman-main',
      'apprentice-main', 'unrecorded-main', 'unrecorded-alt',
    ]);
  });

  it('also lists the highest Ashes profession ranks before lower-ranked mains', () => {
    const novice = character({ id: 'novice', professions: [{
      id: 'novice-profession', member_id: 'novice', profession: 'mining', rank: 1, artisan_level: 1, quality_score: 0,
    }] });
    const grandmaster = character({ id: 'grandmaster', is_main: false, professions: [{
      id: 'grandmaster-profession', member_id: 'grandmaster', profession: 'mining', rank: 4, artisan_level: 50, quality_score: 0,
    }] });
    expect(getProfessionCoverage('aoc', [novice, grandmaster]).find(card => card.id === 'mining')
      ?.characters.map(entry => entry.character.id)).toEqual(['grandmaster', 'novice']);
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
