import {
  isValidWowForeverSelection,
  getWowForeverRaceFaction,
  WOW_FOREVER_CLASSES,
  WOW_FOREVER_PROFESSIONS,
  WOW_FOREVER_RACES,
} from '../index';

describe('WoW Forever configuration', () => {
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
});
