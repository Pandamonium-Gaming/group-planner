import { createCharacterTransfer, validateCharacterTransfer } from '../characterTransfer';

const row = {
  id: '00000000-0000-4000-8000-000000000001', name: 'Aster', level: 10, is_main: true,
  user_id: 'source-only', group_id: 'source-group', discord_id: '123456789012345678',
  wow_race: 'Human', wow_class: 'mage', wow_main_spec: 'Fire', wow_profession_1: 'Alchemy', wow_profession_1_rank: 'expert',
  owner: { discord_id: '123456789012345678', display_name: 'Custom owner', email: 'not-exported' },
  member_professions: [], character_ships: [],
};

it('exports a versioned complete character without source identity or sensitive profile fields', () => {
  const exported = createCharacterTransfer('wowforever', [row]);
  expect(exported.characters[0].owner).toEqual({ discord_id: '123456789012345678', label: 'Custom owner' });
  expect(exported.characters[0].data.wow_profession_1_rank).toBe('expert');
  expect(JSON.stringify(exported)).not.toMatch(/source-only|source-group|email|not-exported/);
  expect(validateCharacterTransfer(exported, 'wowforever')).toEqual(exported);
});

it('rejects wrong game, duplicate IDs, unsupported fields and invalid ranks', () => {
  const exported = createCharacterTransfer('wowforever', [row]);
  expect(() => validateCharacterTransfer(exported, 'aoc')).toThrow();
  expect(() => validateCharacterTransfer({ ...exported, characters: [exported.characters[0], exported.characters[0]] }, 'wowforever')).toThrow();
  expect(() => validateCharacterTransfer({ ...exported, characters: [{ ...exported.characters[0],
    data: { ...exported.characters[0].data, user_id: 'injected' } }] }, 'wowforever')).toThrow();
  expect(() => createCharacterTransfer('wowforever', [{ ...row, wow_profession_1_rank: 'grandmaster' }])).toThrow();
  expect(() => createCharacterTransfer('wowforever', [{ ...row, name: '\u0000' }])).toThrow();
});

it('round-trips skills, rejects invalid values and preserves omission in older exports', () => {
  const skills = [
    { name: 'First Aid', category: 'secondary', rank: 'expert', current: 180, max: 225 },
    { name: 'Lockpicking', category: 'class', rank: null, current: 150, max: 200 },
  ];
  const exported = createCharacterTransfer('wowforever', [{ ...row, wow_skills: skills }]);
  expect(exported.characters[0].data.wow_skills).toEqual(skills);
  expect(validateCharacterTransfer(exported, 'wowforever')).toEqual(exported);
  delete exported.characters[0].data.wow_skills;
  expect(validateCharacterTransfer(exported, 'wowforever').characters[0].data).not.toHaveProperty('wow_skills');
  expect(() => createCharacterTransfer('wowforever', [{ ...row, wow_skills: [{ ...skills[0], current: 226 }] }])).toThrow('Invalid WoW skill data');
  expect(() => createCharacterTransfer('aoc', [{ ...row, wow_skills: skills }])).toThrow('Invalid WoW skill data');
});

it('round-trips Ashes profession ranks and Star Citizen ship ownership and timestamp fields', () => {
  const ashes = createCharacterTransfer('aoc', [{ ...row, member_professions: [
    { profession: 'mining', rank: 4, artisan_level: 50, quality_score: 1000 },
  ] }]);
  expect(ashes.characters[0].professions[0].quality_score).toBe(1000);
  const ships = [{ ship_id: 'aurora-mr', ownership_type: 'pledged', notes: null }];
  expect(createCharacterTransfer('starcitizen', [{ ...row, subscriber_since: '2026-11-02T12:00:00+00:00',
    character_ships: ships }]).characters[0].ships).toEqual(ships);
});
