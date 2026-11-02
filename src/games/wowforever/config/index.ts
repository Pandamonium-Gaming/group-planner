export const WOW_FOREVER_RACES = [
  'Human',
  'Dwarf',
  'Night Elf',
  'Gnome',
  'Orc',
  'Undead',
  'Tauren',
  'Troll',
  'Skyborne',
] as const;

// Current race/class options follow the Wowhead WoW: Forever guide.
export const WOW_FOREVER_CLASSES = [
  {
    id: 'druid',
    name: 'Druid',
    races: ['Night Elf', 'Tauren', 'Skyborne'],
    specs: ['Balance', 'Feral', 'Restoration'],
  },
  {
    id: 'hunter',
    name: 'Hunter',
    races: ['Human', 'Dwarf', 'Night Elf', 'Orc', 'Tauren', 'Troll', 'Skyborne'],
    specs: ['Beast Mastery', 'Marksmanship', 'Survival'],
  },
  {
    id: 'mage',
    name: 'Mage',
    races: ['Human', 'Gnome', 'Orc', 'Undead', 'Troll', 'Skyborne'],
    raceFactions: { Skyborne: 'Alliance' },
    specs: ['Arcane', 'Fire', 'Frost'],
  },
  {
    id: 'paladin',
    name: 'Paladin',
    races: ['Human', 'Dwarf', 'Undead'],
    specs: ['Holy', 'Protection', 'Retribution'],
  },
  {
    id: 'priest',
    name: 'Priest',
    races: ['Human', 'Dwarf', 'Night Elf', 'Gnome', 'Undead', 'Troll'],
    specs: ['Discipline', 'Holy', 'Shadow'],
  },
  {
    id: 'rogue',
    name: 'Rogue',
    races: ['Human', 'Dwarf', 'Night Elf', 'Gnome', 'Orc', 'Undead', 'Troll', 'Skyborne'],
    specs: ['Assassination', 'Combat', 'Subtlety'],
  },
  {
    id: 'shaman',
    name: 'Shaman',
    races: ['Dwarf', 'Orc', 'Tauren', 'Troll', 'Skyborne'],
    raceFactions: { Skyborne: 'Horde' },
    specs: ['Elemental', 'Enhancement', 'Restoration'],
  },
  {
    id: 'warlock',
    name: 'Warlock',
    races: ['Human', 'Gnome', 'Orc', 'Undead', 'Troll'],
    specs: ['Affliction', 'Demonology', 'Destruction'],
  },
  {
    id: 'warrior',
    name: 'Warrior',
    races: [...WOW_FOREVER_RACES],
    specs: ['Arms', 'Fury', 'Protection'],
  },
] as const;

export const WOW_FOREVER_PROFESSIONS = [
  'Alchemy',
  'Blacksmithing',
  'Enchanting',
  'Engineering',
  'Herbalism',
  'Leatherworking',
  'Mining',
  'Skinning',
  'Tailoring',
] as const;

export type WowForeverRace = (typeof WOW_FOREVER_RACES)[number];
export type WowForeverClass = (typeof WOW_FOREVER_CLASSES)[number]['id'];
export type WowForeverFaction = 'Alliance' | 'Horde';

export function getWowForeverClass(classId: string) {
  return WOW_FOREVER_CLASSES.find((wowClass) => wowClass.id === classId);
}

export function getWowForeverClassesForRace(race: string) {
  return WOW_FOREVER_CLASSES.filter((wowClass) =>
    (wowClass.races as readonly string[]).includes(race)
  );
}

export function getWowForeverRaceFaction(race: string, classId: string): 'Alliance' | 'Horde' | null {
  const wowClass = getWowForeverClass(classId);
  if (!wowClass || !(wowClass.races as readonly string[]).includes(race)) {
    return null;
  }

  if ('raceFactions' in wowClass && race === 'Skyborne') {
    return wowClass.raceFactions.Skyborne;
  }

  return null;
}

export function getWowForeverFaction(race: string, classId: string, selectedFaction?: string | null): WowForeverFaction | null {
  const wowClass = getWowForeverClass(classId);
  if (!wowClass || !(wowClass.races as readonly string[]).includes(race)) return null;
  const restriction = getWowForeverRaceFaction(race, classId);
  if (restriction) return restriction;
  if (['Human', 'Dwarf', 'Night Elf', 'Gnome'].includes(race)) return 'Alliance';
  if (['Orc', 'Undead', 'Tauren', 'Troll'].includes(race)) return 'Horde';
  return selectedFaction === 'Alliance' || selectedFaction === 'Horde' ? selectedFaction : null;
}

export function isValidWowForeverSelection(selection: {
  race?: string | null;
  classId?: string | null;
  mainSpec?: string | null;
  secondarySpec?: string | null;
  profession1?: string | null;
  profession2?: string | null;
  faction?: string | null;
}): boolean {
  const wowClass = getWowForeverClass(selection.classId || '');
  if (
    !selection.race ||
    !wowClass ||
    !selection.mainSpec ||
    !(wowClass.races as readonly string[]).includes(selection.race) ||
    !(wowClass.specs as readonly string[]).includes(selection.mainSpec)
  ) {
    return false;
  }

  const specs = wowClass.specs as readonly string[];
  if (selection.faction != null && (
    !['Alliance', 'Horde'].includes(selection.faction) ||
    getWowForeverFaction(selection.race, wowClass.id, selection.faction) !== selection.faction
  )) return false;
  if (
    (selection.secondarySpec &&
      (!specs.includes(selection.secondarySpec) || selection.secondarySpec === selection.mainSpec)) ||
    (selection.profession1 &&
      !(WOW_FOREVER_PROFESSIONS as readonly string[]).includes(selection.profession1)) ||
    (selection.profession2 &&
      (!(WOW_FOREVER_PROFESSIONS as readonly string[]).includes(selection.profession2) ||
        selection.profession2 === selection.profession1))
  ) {
    return false;
  }

  return true;
}

export const WOW_FOREVER_DATA = {
  races: WOW_FOREVER_RACES,
  classes: WOW_FOREVER_CLASSES,
  professions: WOW_FOREVER_PROFESSIONS,
} as const;
