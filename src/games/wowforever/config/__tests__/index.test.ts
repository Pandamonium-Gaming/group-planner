import {
  isValidWowForeverSelection,
  getWowForeverRaceFaction,
  getWowForeverFaction,
  getWowForeverClassesForRace,
  WOW_FOREVER_CLASSES,
  WOW_FOREVER_PROFESSIONS,
  WOW_FOREVER_RACES,
  WOW_FOREVER_PROFESSION_RANKS,
  resetChangedWowProfessionRanks,
} from '../index';
import { isValidWowSkills } from '../skills';

describe('WoW Forever configuration', () => {
  it('tracks secondary and other skills independently with unknown values and explicit trained ranks', () => {
    expect(isValidWowSkills([
      { name: 'Cooking', category: 'secondary', rank: 'apprentice', current: 75, max: 150 },
      { name: 'First Aid', category: 'secondary', rank: null, current: null, max: 300 },
      { name: 'Fishing', category: 'secondary', rank: 'artisan', current: 0, max: null },
      { name: 'Lockpicking', category: 'class', rank: null, current: 125, max: 150 },
      { name: 'Swords', category: 'weapon', rank: null, current: 70, max: 100 },
      { name: 'Defence', category: 'defence', rank: null, current: 80, max: 100 },
      { name: 'Riding', category: 'riding', rank: 'Apprentice Riding', current: null, max: null },
    ])).toBe(true);
    expect(isValidWowSkills([])).toBe(true);
  });

  it('rejects malformed, duplicate, misplaced and impossible skill data', () => {
    const skill = { name: 'Fishing', category: 'secondary', rank: 'expert', current: 200, max: 300 };
    for (const changes of [
      { name: '' }, { name: ' Fishing ' }, { name: '\u0000' }, { name: 'x'.repeat(81) },
      { category: 'weapon' }, { name: 'Mining', category: 'class' },
      { name: 'Unknown secondary' }, { rank: 'grandmaster' }, { rank: 3 },
      { current: 1.5 }, { current: -1 }, { current: '200' }, { current: NaN },
      { current: 301 }, { max: -1 }, { max: Number.MAX_SAFE_INTEGER + 1 }, { extra: true },
    ]) expect(isValidWowSkills([{ ...skill, ...changes }])).toBe(false);
    expect(isValidWowSkills([skill, skill])).toBe(false);
    expect(isValidWowSkills([
      { ...skill, name: 'Swords', category: 'weapon' },
      { ...skill, name: 'swords', category: 'class' },
    ])).toBe(false);
    expect(isValidWowSkills([{ name: 'Swords', category: 'weapon' }])).toBe(false);
    expect(isValidWowSkills(null)).toBe(false);
    expect(isValidWowSkills([[]])).toBe(false);
  });

  it('accepts only recorded trained ranks paired with professions', () => {
    const valid = { race: 'Human', classId: 'mage', mainSpec: 'Fire', profession1: 'Alchemy', profession2: 'Tailoring' };
    for (const rank of WOW_FOREVER_PROFESSION_RANKS) {
      expect(isValidWowForeverSelection({ ...valid, profession1Rank: rank, profession2Rank: rank })).toBe(true);
    }
    for (const rank of ['', 'master', 'grandmaster', 4, {}, false]) {
      expect(isValidWowForeverSelection({ ...valid, profession1Rank: rank })).toBe(false);
      expect(isValidWowForeverSelection({ ...valid, profession2Rank: rank })).toBe(false);
    }
    expect(isValidWowForeverSelection({ ...valid, profession1Rank: null })).toBe(true);
    expect(isValidWowForeverSelection({ ...valid, profession1: null, profession1Rank: 'artisan' })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, profession2: null, profession2Rank: 'expert' })).toBe(false);
  });

  it('clears ranks on partial profession changes without changing unrelated updates', () => {
    const previous = { wow_profession_1: 'Alchemy', wow_profession_2: 'Tailoring' };
    expect(resetChangedWowProfessionRanks({ wow_profession_1: 'Mining' }, previous))
      .toEqual({ wow_profession_1: 'Mining', wow_profession_1_rank: null });
    expect(resetChangedWowProfessionRanks({ wow_profession_2: null }, previous))
      .toEqual({ wow_profession_2: null, wow_profession_2_rank: null });
    expect(resetChangedWowProfessionRanks({ wow_profession_1: 'Alchemy' }, previous))
      .toEqual({ wow_profession_1: 'Alchemy' });
    expect(resetChangedWowProfessionRanks({ name: 'New name' }, previous)).toEqual({ name: 'New name' });
    expect(resetChangedWowProfessionRanks({ wow_profession_1: 'Mining', wow_profession_1_rank: 'expert' }, previous))
      .toEqual({ wow_profession_1: 'Mining', wow_profession_1_rank: 'expert' });
  });
  it('resolves racial factions and respects Skyborne choices and restrictions', () => {
    expect(getWowForeverFaction('Human', 'mage')).toBe('Alliance');
    expect(getWowForeverFaction('Orc', 'warrior')).toBe('Horde');
    expect(getWowForeverFaction('Skyborne', 'warrior', 'Horde')).toBe('Horde');
    expect(getWowForeverFaction('Skyborne', 'warrior', 'Alliance')).toBe('Alliance');
    expect(getWowForeverFaction('Skyborne', 'warrior')).toBeNull();
    expect(getWowForeverFaction('Skyborne', 'mage', 'Horde')).toBe('Alliance');
    expect(getWowForeverFaction('Skyborne', 'shaman', 'Alliance')).toBe('Horde');
    const valid = { race: 'Skyborne', classId: 'mage', mainSpec: 'Fire' };
    expect(isValidWowForeverSelection({ ...valid, faction: 'Horde' })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, faction: 'Alliance' })).toBe(true);
    expect(isValidWowForeverSelection({ ...valid, faction: 'Invalid' })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, faction: '' })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, faction: null })).toBe(true);
    expect(isValidWowForeverSelection(valid)).toBe(true);
  });
  it('defines three specs for each supported class', () => {
    expect(WOW_FOREVER_CLASSES).toHaveLength(9);
    expect(WOW_FOREVER_CLASSES.every((wowClass) => wowClass.specs.length === 3)).toBe(true);
  });

  it('lists the races and professions supplied for WoW Forever', () => {
    expect(WOW_FOREVER_RACES).toContain('Skyborne');
    expect(WOW_FOREVER_PROFESSIONS).toHaveLength(9);
  });

  it('validates compatible races, classes, specs, and distinct professions', () => {
    expect(isValidWowForeverSelection({
      race: 'Undead',
      classId: 'paladin',
      mainSpec: 'Holy',
      secondarySpec: 'Protection',
      profession1: 'Alchemy',
      profession2: 'Engineering',
    })).toBe(true);

    expect(isValidWowForeverSelection({
      race: 'Human',
      classId: 'shaman',
      mainSpec: 'Elemental',
    })).toBe(false);

    expect(isValidWowForeverSelection({
      race: 'Orc',
      classId: 'mage',
      mainSpec: 'Holy',
    })).toBe(false);

    expect(isValidWowForeverSelection({
      race: 'Orc',
      classId: 'mage',
      mainSpec: 'Fire',
      profession1: 'Alchemy',
      profession2: 'Alchemy',
    })).toBe(false);
  });

  it('records Skyborne faction restrictions for Mage and Shaman', () => {
    expect(getWowForeverRaceFaction('Skyborne', 'mage')).toBe('Alliance');
    expect(getWowForeverRaceFaction('Skyborne', 'shaman')).toBe('Horde');
    expect(getWowForeverRaceFaction('Skyborne', 'warrior')).toBeNull();
    expect(getWowForeverRaceFaction('Human', 'mage')).toBeNull();
  });

  it('offers exactly the classes compatible with each race', () => {
    for (const race of WOW_FOREVER_RACES) {
      const available = getWowForeverClassesForRace(race);
      for (const wowClass of WOW_FOREVER_CLASSES) {
        const compatible = (wowClass.races as readonly string[]).includes(race);
        expect(available.some(option => option.id === wowClass.id)).toBe(compatible);
        expect(isValidWowForeverSelection({
          race,
          classId: wowClass.id,
          mainSpec: wowClass.specs[0],
        })).toBe(compatible);
      }
    }
  });

  it('requires race, class and main spec while accepting optional fields', () => {
    const valid = { race: 'Skyborne', classId: 'mage', mainSpec: 'Fire' };
    expect(isValidWowForeverSelection(valid)).toBe(true);
    expect(isValidWowForeverSelection({ ...valid, race: null })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, classId: null })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, mainSpec: null })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, secondarySpec: 'Fire' })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, secondarySpec: 'Holy' })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, profession1: 'Unknown' })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, profession2: 'Unknown' })).toBe(false);
    expect(isValidWowForeverSelection({ ...valid, secondarySpec: 'Frost', profession2: 'Tailoring' })).toBe(true);
  });
});
