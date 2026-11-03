import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import type { Client } from 'pg';

// Shared by the game-deletion migration tests: production-shaped stub tables plus the game migrations, in order.
const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
const COLUMN_PREFIXES = ['aoc', 'sc', 'ror', 'wowforever'];

/** Migrations applied on top of the stubs, in production order. */
export const GAME_SCHEMA_MIGRATIONS = [
  '011_add_character_transfer.sql', '013_add_discord_webhook_logs.sql', '015_admin_discord_notifications.sql', '016_admin_notification_role_mentions.sql',
  '017_admin_notification_categories.sql', '019_admin_notification_game_deleted.sql', '020_suppress_alert_flag.sql',
  '021_delete_group_game.sql', '022_fix_loaner_trigger.sql', '023_validate_game_writes.sql',
];

/** Per-game column definitions added to public.groups across all migrations. */
async function groupsPerGameColumns() {
  const columns = new Map<string, string>();
  const names = (await readdir(migrationsDir)).filter(name => /^\d{3}_.*\.sql$/.test(name)).sort();
  for (const name of names) {
    const sql = (await readFile(new URL(name, migrationsDir), 'utf8')).replace(/--[^\n]*/g, '');
    for (const statement of sql.split(';')) {
      if (!/\bALTER TABLE\s+(?:IF EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?groups\b/i.test(statement)) continue;
      for (const match of statement.matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)\s+([^,]*?)\s*(?=,|$)/gi)) {
        const column = match[1].toLowerCase();
        if (COLUMN_PREFIXES.some(prefix => column.startsWith(`${prefix}_`))) columns.set(column, `${column} ${match[2]}`);
      }
    }
  }
  return columns;
}

/**
 * Creates `schema` with the stub tables and applies GAME_SCHEMA_MIGRATIONS (public. rewritten to the schema).
 * Must run inside a transaction: it uses SET LOCAL search_path.
 */
export async function createGameSchema(client: Client, schema: string) {
  const t = (name: string) => `"${schema}"."${name}"`;
  const rewrite = (source: string) => {
    assert.match(source, /^BEGIN;\s/);
    assert.match(source, /COMMIT;\s*$/);
    return source.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '')
      .replaceAll('public.', `"${schema}".`).replaceAll('auth.uid()', `${t('uid')}()`);
  };
  const migration = async (name: string) => client.query(rewrite(await readFile(new URL(name, migrationsDir), 'utf8')));
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`CREATE FUNCTION ${t('uid')}() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$`);
  const perGame = [...(await groupsPerGameColumns()).values()];
  // Stubs mirror 000_baseline.sql column names and ON DELETE actions for every table touched.
  await client.query(`
    CREATE TABLE ${t('migration_history')} (filename text PRIMARY KEY);
    CREATE TABLE ${t('users')} (id uuid PRIMARY KEY, display_name text, discord_id text, discord_username text);
    CREATE TABLE ${t('groups')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug varchar(50) UNIQUE NOT NULL, name varchar(100) NOT NULL,
      created_at timestamptz DEFAULT now(), created_by uuid REFERENCES ${t('users')}(id) ON DELETE SET NULL,
      group_webhook_url text, notify_on_events boolean
    );
    ${perGame.map(definition => `ALTER TABLE ${t('groups')} ADD COLUMN ${definition};`).join('\n')}
    CREATE TABLE ${t('group_members')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES ${t('groups')}(id) ON DELETE CASCADE,
      user_id uuid REFERENCES ${t('users')}(id) ON DELETE CASCADE, role varchar(20) NOT NULL DEFAULT 'pending', guild_rank text
    );
    CREATE TABLE ${t('group_permission_overrides')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES ${t('groups')}(id) ON DELETE CASCADE,
      role text, events_create boolean, updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE ${t('group_games')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES ${t('groups')}(id) ON DELETE CASCADE,
      game_slug text NOT NULL, created_at timestamptz DEFAULT now(), archived boolean DEFAULT false, UNIQUE(group_id, game_slug)
    );
    CREATE TABLE ${t('members')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES ${t('groups')}(id) ON DELETE CASCADE,
      user_id uuid REFERENCES ${t('users')}(id) ON DELETE SET NULL, discord_id text, name varchar(100) NOT NULL,
      game_slug text NOT NULL DEFAULT 'aoc', level integer, is_main boolean, rank text, preferred_role text[],
      race text, primary_archetype text, secondary_archetype text, ror_faction text, ror_class text,
      wow_race text, wow_faction text, wow_class text, wow_main_spec text, wow_secondary_spec text,
      wow_profession_1 text, wow_profession_2 text, wow_profession_1_rank integer, wow_profession_2_rank integer,
      subscriber_tier text, subscriber_since timestamptz, subscriber_ships_month integer
    );
    CREATE TABLE ${t('member_professions')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid REFERENCES ${t('members')}(id) ON DELETE CASCADE,
      profession varchar(50) NOT NULL, rank integer NOT NULL, artisan_level integer, quality_score integer,
      UNIQUE(member_id, profession)
    );
    CREATE TABLE ${t('events')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES ${t('groups')}(id) ON DELETE CASCADE,
      created_by uuid REFERENCES ${t('users')}(id) ON DELETE SET NULL, title varchar(100) NOT NULL,
      starts_at timestamptz NOT NULL DEFAULT now(), game_slug text NOT NULL DEFAULT 'aoc'
    );
    CREATE TABLE ${t('event_rsvps')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES ${t('events')}(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES ${t('users')}(id) ON DELETE CASCADE,
      character_id uuid REFERENCES ${t('members')}(id) ON DELETE SET NULL, UNIQUE(event_id, user_id)
    );
    CREATE TABLE ${t('guest_event_rsvps')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES ${t('events')}(id) ON DELETE CASCADE,
      allied_group_id uuid NOT NULL REFERENCES ${t('groups')}(id) ON DELETE CASCADE, guest_name varchar(255) NOT NULL,
      class_id text, role varchar(20) NOT NULL
    );
    CREATE TABLE ${t('recruitment_applications')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES ${t('groups')}(id) ON DELETE CASCADE,
      discord_username text NOT NULL, game_slug text
    );
    CREATE TABLE ${t('game_ship_permissions')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES ${t('groups')}(id) ON DELETE CASCADE,
      game_slug text NOT NULL, min_role text NOT NULL DEFAULT 'member', UNIQUE(group_id, game_slug)
    );
    CREATE TABLE ${t('parties')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES ${t('groups')}(id) ON DELETE CASCADE, name text NOT NULL
    );
    CREATE TABLE ${t('party_roster')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), party_id uuid NOT NULL REFERENCES ${t('parties')}(id) ON DELETE CASCADE,
      character_id uuid NOT NULL REFERENCES ${t('members')}(id) ON DELETE CASCADE, role text NOT NULL, UNIQUE(party_id, character_id)
    );
    CREATE TABLE ${t('node_citizenships')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      character_id uuid NOT NULL REFERENCES ${t('members')}(id) ON DELETE CASCADE, node_name varchar(100) NOT NULL, UNIQUE(character_id)
    );
    CREATE TABLE ${t('announcements')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES ${t('groups')}(id) ON DELETE CASCADE,
      title varchar(100) NOT NULL, content text NOT NULL
    );
    CREATE TABLE ${t('alliances')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(100) NOT NULL,
      leader_group_id uuid NOT NULL REFERENCES ${t('groups')}(id) ON DELETE CASCADE
    );
    CREATE TABLE ${t('activity_log')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES ${t('groups')}(id) ON DELETE CASCADE,
      character_id uuid REFERENCES ${t('members')}(id) ON DELETE SET NULL
    );
    CREATE TABLE ${t('sc_loaner_matrix')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pledged_ship text NOT NULL, loaner_ship text NOT NULL,
      loaner_type text DEFAULT 'primary', notes text
    );
    CREATE TABLE ${t('character_ships')} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      character_id uuid NOT NULL REFERENCES ${t('members')}(id) ON DELETE CASCADE, ship_id text NOT NULL,
      ownership_type text NOT NULL, notes text, UNIQUE(character_id, ship_id, ownership_type)
    );
  `);
  // The baseline Star Citizen loaner functions and triggers (unqualified names, session search_path). Migration
  // 022 below replaces the removal trigger with its AFTER DELETE form, so the harness ends in the production state.
  const baseline = await readFile(new URL('000_baseline.sql', migrationsDir), 'utf8');
  const start = baseline.indexOf('CREATE OR REPLACE FUNCTION ship_id_to_display_name');
  const endMarker = 'EXECUTE FUNCTION remove_loaner_ships_for_pledge();';
  const end = baseline.indexOf(endMarker, start);
  assert.ok(start > 0 && end > start, 'Loaner trigger section not found in baseline');
  await client.query(`SET LOCAL search_path = "${schema}"`);
  await client.query(baseline.slice(start, end + endMarker.length));
  // Production sessions resolve these unqualified names through search_path.
  await client.query(`SET LOCAL search_path = "${schema}", public`);
  for (const name of GAME_SCHEMA_MIGRATIONS) await migration(name);
}
