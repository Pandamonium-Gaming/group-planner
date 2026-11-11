import { EVENT_TYPES, countEventRoles, getEventTypesForGame, getEventTypeForGame, isEventTypeAllowedForGame } from '../events';

it('offers the requested WoW choices, retaining Other and removing all farming and Siege choices', () => {
  expect(Object.keys(getEventTypesForGame('wowforever'))).toEqual([
    'raid', 'dungeon', 'gathering', 'social', 'leveling', 'world_pvp', 'battleground_pvp', 'arena_pvp', 'other',
  ]);
  for (const type of Object.keys(getEventTypesForGame('wowforever'))) {
    expect(isEventTypeAllowedForGame(type, 'wowforever')).toBe(true);
  }
  for (const type of ['siege', 'farming_glint', 'farming_materials', 'farming_gear', 'farming_other', 'missions']) {
    expect(isEventTypeAllowedForGame(type, 'wowforever')).toBe(false);
  }
});

it('preserves other games and readable legacy events', () => {
  expect(getEventTypesForGame('aoc').siege).toBe(EVENT_TYPES.siege);
  expect(getEventTypesForGame('ror').farming_gear).toBe(EVENT_TYPES.farming_gear);
  expect(Object.keys(getEventTypesForGame('starcitizen'))).toEqual(['missions', 'salvaging', 'pirating', 'bounty_hunting', 'other']);
  expect(getEventTypeForGame('siege', 'wowforever')).toBe(EVENT_TYPES.dungeon);
  expect(getEventTypeForGame('siege', 'aoc')).toBe(EVENT_TYPES.siege);
  expect(isEventTypeAllowedForGame('farming_gear', 'wowforever', 'farming_gear')).toBe(true);
  expect(isEventTypeAllowedForGame('farming_other', 'wowforever', 'farming_gear')).toBe(false);
  expect(isEventTypeAllowedForGame('unknown', 'wowforever', 'unknown')).toBe(false);
  expect(isEventTypeAllowedForGame('arena_pvp', 'aoc')).toBe(false);
});

it('combines legacy WoW Cleric and Bard signups as healers, including guests by status', () => {
  const counts = countEventRoles([
    { role: 'cleric', status: 'attending' },
    { role: 'bard', status: 'maybe' },
    { role: null, status: 'attending' },
  ], [
    { role: 'bard', status: 'attending' },
    { role: 'cleric', status: 'maybe' },
    { role: 'cleric', status: 'declined' },
  ], 'wowforever');
  expect(counts.cleric).toEqual({ attending: 2, maybe: 2 });
  expect(counts.bard).toEqual({ attending: 0, maybe: 0 });
  expect(countEventRoles([], [{ role: 'bard', status: 'attending' }], 'aoc').bard.attending).toBe(1);
});
