import { isValidWowForeverSelection } from '@/games/wowforever/config';
import { RACES, ARCHETYPES } from '@/lib/characters';
import { PROFESSIONS } from '@/lib/professions';
import { ROR_CLASSES, ROR_FACTIONS } from '@/games/returnofreckooning/config';

export const TRANSFER_MAX_BYTES = 2 * 1024 * 1024;
export const TRANSFER_MAX_CHARACTERS = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GAMES = ['aoc', 'wowforever', 'starcitizen', 'ror'];

export const TRANSFER_FIELDS = [
  'name', 'level', 'is_main', 'rank', 'preferred_role',
  'race', 'primary_archetype', 'secondary_archetype', 'ror_faction', 'ror_class',
  'wow_race', 'wow_faction', 'wow_class', 'wow_main_spec', 'wow_secondary_spec',
  'wow_profession_1', 'wow_profession_2', 'wow_profession_1_rank', 'wow_profession_2_rank',
  'subscriber_tier', 'subscriber_since', 'subscriber_ships_month',
] as const;

export interface TransferCharacter {
  id: string;
  owner: { discord_id: string | null; label: string | null };
  data: Record<string, string | number | boolean | string[] | null>;
  professions: Array<{ profession: string; rank: number; artisan_level: number; quality_score: number }>;
  ships: Array<{ ship_id: string; ownership_type: string; notes: string | null }>;
}

export interface CharacterTransfer {
  format: 'group-planner-characters';
  version: 1;
  game_slug: string;
  exported_at: string;
  characters: TransferCharacter[];
}

export interface TransferPreview {
  token: string;
  create_count: number;
  update_count: number;
  warnings: Array<{ name: string; owner: string | null }>;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
}

function text(value: unknown, maximum: number, nullable = false, multiline = false): string | null {
  if (nullable && (value === null || value === '')) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > maximum ||
    (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/ : /[\u0000-\u001f]/).test(value)) {
    throw new Error('Invalid text field');
  }
  return value;
}

function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error('Invalid numeric field');
  }
  return value;
}

export function validateCharacterTransfer(input: unknown, gameSlug: string): CharacterTransfer {
  const document = object(input);
  if (document.format !== 'group-planner-characters' || document.version !== 1 ||
    document.game_slug !== gameSlug || !GAMES.includes(gameSlug)) throw new Error('Wrong transfer format, version or game');
  if (!Array.isArray(document.characters) || document.characters.length > TRANSFER_MAX_CHARACTERS) {
    throw new Error('Too many characters or invalid character list');
  }
  const ids = new Set<string>();
  const characters = document.characters.map((inputCharacter): TransferCharacter => {
    const character = object(inputCharacter);
    if (typeof character.id !== 'string' || !UUID.test(character.id) || ids.has(character.id.toLowerCase())) {
      throw new Error('Invalid or duplicate character ID');
    }
    ids.add(character.id.toLowerCase());
    const owner = object(character.owner);
    const discordId = text(owner.discord_id, 25, true);
    if (discordId && !/^\d{5,25}$/.test(discordId)) throw new Error('Invalid owner Discord ID');
    const rawData = object(character.data);
    if (Object.keys(rawData).some(key => !(TRANSFER_FIELDS as readonly string[]).includes(key))) {
      throw new Error('Unsupported character field');
    }
    const data: TransferCharacter['data'] = {};
    for (const field of TRANSFER_FIELDS) {
      const value = rawData[field] ?? null;
      if (field === 'level') data[field] = integer(value, 1, 100);
      else if (field === 'is_main') {
        if (typeof value !== 'boolean') throw new Error('Invalid main/alt value');
        data[field] = value;
      } else if (field === 'preferred_role') {
        if (value !== null && (!Array.isArray(value) || value.length > 20 ||
          value.some(role => typeof role !== 'string' || role.length > 100))) throw new Error('Invalid preferred roles');
        data[field] = value;
      } else data[field] = text(value, field === 'name' ? 100 : 200, field !== 'name');
    }
    if (gameSlug === 'wowforever' && !isValidWowForeverSelection({
      race: typeof data.wow_race === 'string' ? data.wow_race : null,
      classId: typeof data.wow_class === 'string' ? data.wow_class : null,
      faction: typeof data.wow_faction === 'string' ? data.wow_faction : null,
      mainSpec: typeof data.wow_main_spec === 'string' ? data.wow_main_spec : null,
      secondarySpec: typeof data.wow_secondary_spec === 'string' ? data.wow_secondary_spec : null,
      profession1: typeof data.wow_profession_1 === 'string' ? data.wow_profession_1 : null,
      profession2: typeof data.wow_profession_2 === 'string' ? data.wow_profession_2 : null,
      profession1Rank: data.wow_profession_1_rank, profession2Rank: data.wow_profession_2_rank,
    })) throw new Error('Invalid WoW character selection');
    if (gameSlug === 'aoc' && (
      (data.race !== null && !Object.prototype.hasOwnProperty.call(RACES, String(data.race))) ||
      (data.primary_archetype !== null && !Object.prototype.hasOwnProperty.call(ARCHETYPES, String(data.primary_archetype))) ||
      (data.secondary_archetype !== null && !Object.prototype.hasOwnProperty.call(ARCHETYPES, String(data.secondary_archetype)))
    )) throw new Error('Invalid Ashes character selection');
    if (gameSlug === 'ror' && (
      (data.ror_class !== null && !ROR_CLASSES.some(warClass => warClass.id === data.ror_class)) ||
      (data.ror_faction !== null && !Object.prototype.hasOwnProperty.call(ROR_FACTIONS, String(data.ror_faction)))
    )) throw new Error('Invalid Return of Reckoning character selection');
    if (data.subscriber_tier !== null && !['centurion', 'imperator'].includes(String(data.subscriber_tier))) {
      throw new Error('Invalid subscriber tier');
    }
    if (data.subscriber_since !== null && (typeof data.subscriber_since !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}/.test(data.subscriber_since) ||
      !Number.isFinite(Date.parse(data.subscriber_since)))) throw new Error('Invalid subscriber date');
    if (data.subscriber_ships_month !== null && (typeof data.subscriber_ships_month !== 'string' ||
      !/^\d{4}-\d{2}$/.test(data.subscriber_ships_month))) throw new Error('Invalid subscriber month');
    if (!Array.isArray(character.professions) || character.professions.length > 22 ||
      !Array.isArray(character.ships) || character.ships.length > 500) throw new Error('Invalid profession or ship list');
    if (gameSlug !== 'aoc' && character.professions.length) throw new Error('Ashes professions on another game');
    if (gameSlug !== 'starcitizen' && character.ships.length) throw new Error('Ships on another game');
    const professionIds = new Set<string>();
    const professions = character.professions.map(inputProfession => {
      const profession = object(inputProfession);
      const id = text(profession.profession, 50)!;
      if (!PROFESSIONS.some(option => option.id === id) || professionIds.has(id)) throw new Error('Invalid or duplicate profession');
      professionIds.add(id);
      return { profession: id, rank: integer(profession.rank, 1, 4),
        artisan_level: integer(profession.artisan_level, 0, 50),
        quality_score: integer(profession.quality_score, 0, 2147483647) };
    });
    const shipIds = new Set<string>();
    const ships = character.ships.map(inputShip => {
      const ship = object(inputShip);
      const shipId = text(ship.ship_id, 200)!;
      const ownership = text(ship.ownership_type, 20)!;
      const key = `${shipId}:${ownership}`;
      if (!['pledged', 'in-game', 'loaner', 'subscriber'].includes(ownership) || shipIds.has(key)) {
        throw new Error('Invalid or duplicate ship ownership');
      }
      shipIds.add(key);
      return { ship_id: shipId, ownership_type: ownership, notes: text(ship.notes, 2000, true, true) };
    });
    return { id: character.id.toLowerCase(), owner: { discord_id: discordId, label: text(owner.label, 200, true) },
      data, professions, ships };
  });
  return { format: 'group-planner-characters', version: 1, game_slug: gameSlug,
    exported_at: text(document.exported_at, 100)!, characters };
}

export function createCharacterTransfer(gameSlug: string, rows: Array<Record<string, unknown>>): CharacterTransfer {
  return validateCharacterTransfer({
    format: 'group-planner-characters', version: 1, game_slug: gameSlug, exported_at: new Date().toISOString(),
    characters: rows.map(row => {
      const user = Array.isArray(row.owner) ? row.owner[0] : row.owner;
      const owner = user ? object(user) : {};
      return {
        id: row.id,
        owner: { discord_id: owner.discord_id || row.discord_id || null,
          label: owner.display_name || owner.discord_username || null },
        data: Object.fromEntries(TRANSFER_FIELDS.map(field => [field,
          row[field] ?? (field === 'level' ? 1 : field === 'is_main' ? false : null)])),
        professions: row.member_professions || [], ships: row.character_ships || [],
      };
    }),
  }, gameSlug);
}
