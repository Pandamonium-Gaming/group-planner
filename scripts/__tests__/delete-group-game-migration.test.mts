import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from 'pg';

const connectionString = process.env.GP_MIGRATION_TEST_DATABASE_URL;
const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
const repoRoot = new URL('../../', import.meta.url);
const MIGRATION = '020_delete_group_game.sql';

// group_games stores the canonical slug; baseline migration 060 renamed legacy 'star-citizen' rows.
const SLUG_ALIASES: Record<string, string> = { 'star-citizen': 'starcitizen' };
// Per-game column prefix on public.groups for each canonical game slug.
const COLUMN_PREFIX: Record<string, string> = { aoc: 'aoc', starcitizen: 'sc', ror: 'ror', wowforever: 'wowforever' };
const DISPLAY_NAME: Record<string, string> = {
  aoc: 'Ashes of Creation', starcitizen: 'Star Citizen', ror: 'Return of Reckoning', wowforever: 'WoW Forever',
};
const SECRET_URL = 'https://discord.com/api/webhooks/999/private-delete-test-token';

// ---------- static SQL helpers (shared by stubs and guards) ----------

async function migrationFiles(includeTarget = false) {
  const names = (await readdir(migrationsDir)).filter(name => /^\d{3}_.*\.sql$/.test(name)).sort();
  const files: { name: string; sql: string }[] = [];
  for (const name of names) {
    if (!includeTarget && name === MIGRATION) continue;
    files.push({ name, sql: await readFile(new URL(name, migrationsDir), 'utf8') });
  }
  return files;
}

const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '');
const statements = (sql: string) => stripComments(sql).split(';');

/** Per-game columns added to public.groups across all migrations, with their column definitions. */
async function groupsPerGameColumns() {
  const columns = new Map<string, string>();
  for (const { sql } of await migrationFiles()) {
    for (const statement of statements(sql)) {
      if (!/\bALTER TABLE\s+(?:IF EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?groups\b/i.test(statement)) continue;
      for (const match of statement.matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)\s+([^,]*?)\s*(?=,|$)/gi)) {
        const name = match[1].toLowerCase();
        if (Object.values(COLUMN_PREFIX).some(prefix => name.startsWith(`${prefix}_`))) columns.set(name, `${name} ${match[2]}`);
      }
    }
  }
  return columns;
}

type ForeignKey = { table: string; target: string; action: string };
async function foreignKeys() {
  const keys: ForeignKey[] = [];
  for (const { sql } of await migrationFiles()) {
    for (const statement of statements(sql)) {
      const owner = statement.match(/(?:CREATE TABLE(?:\s+IF NOT EXISTS)?|ALTER TABLE(?:\s+IF EXISTS)?(?:\s+ONLY)?)\s+(?:public\.)?"?(\w+)"?/i);
      if (!owner) continue;
      for (const ref of statement.matchAll(/REFERENCES\s+(?:public\.)?"?(\w+)"?\s*(?:\(\s*\w+\s*\))?([^,]*)/gi)) {
        const action = ref[2].match(/ON DELETE\s+(CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION)/i)?.[1].toUpperCase() ?? 'NO ACTION';
        keys.push({ table: owner[1].toLowerCase(), target: ref[1].toLowerCase(), action });
      }
    }
  }
  return keys;
}

/** Slug -> columns reset by the static CASE branches of migration 020. */
function resetBranches(sql: string) {
  const branches = new Map<string, string[]>();
  for (const match of sql.matchAll(/WHEN\s+'([a-z0-9-]+)'\s+THEN\s+UPDATE\s+public\.groups\s+SET\s+([\s\S]*?)\s+WHERE\s+id\s*=\s*p_group_id/gi)) {
    const assignments = match[2].split(',').map(part => part.trim()).filter(Boolean);
    for (const assignment of assignments) assert.match(assignment, /^\w+\s*=\s*DEFAULT$/i, `Branch ${match[1]} must only reset to DEFAULT: ${assignment}`);
    branches.set(match[1], assignments.map(assignment => assignment.split('=')[0].trim().toLowerCase()));
  }
  return branches;
}

// ---------- static tests (no database needed) ----------

test('every member/event child foreign key cascades or nulls, and the relied-on children cascade', async () => {
  const keys = await foreignKeys();
  const pick = (target: string, action: string) => keys.filter(k => k.target === target && k.action === action).map(k => k.table).sort();
  assert.deepEqual(pick('members', 'CASCADE'), [
    'caravan_escorts', 'character_ships', 'dkp_points', 'member_professions', 'node_citizenships', 'party_roster', 'siege_roster',
  ], 'Member-owned child tables changed: review delete_group_game');
  assert.deepEqual(pick('members', 'SET NULL'), [
    'activity_log', 'bank_transactions', 'caravan_events', 'event_rsvps', 'freeholds', 'loot_history', 'resource_requests',
  ], 'Tables that keep rows but null a deleted character changed: review delete_group_game');
  assert.deepEqual(pick('events', 'CASCADE'), ['event_rsvps', 'guest_event_rsvps'], 'Event-owned child tables changed: review delete_group_game');
  assert.deepEqual(pick('events', 'SET NULL'), []);

  // Everything delete_group_game removes, directly or by cascade, must not be blocked by a referencing row.
  const removed = new Set(['members', 'events', 'recruitment_applications', 'game_ship_permissions', 'discord_webhook_logs', 'group_games']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const key of keys) {
      if (removed.has(key.target) && key.action === 'CASCADE' && !removed.has(key.table)) { removed.add(key.table); grew = true; }
    }
  }
  const blocking = keys.filter(k => removed.has(k.target) && !['CASCADE', 'SET NULL'].includes(k.action));
  assert.deepEqual(blocking, [], 'A foreign key would block or skip deletion');
});

test('every game slug in src/config/games and every slug present in group_games migrations has a branch in migration 020', async () => {
  const sql = await readFile(new URL(MIGRATION, migrationsDir), 'utf8');
  const branches = resetBranches(sql);
  const slugs = new Map<string, string>();
  const configDir = new URL('src/config/games/', repoRoot);
  for (const name of (await readdir(configDir)).filter(n => n.endsWith('.json'))) {
    const data = JSON.parse(await readFile(new URL(name, configDir), 'utf8'));
    if (data && typeof data.slug === 'string') slugs.set(data.slug, `src/config/games/${name}`);
  }
  const registry = await readFile(new URL('src/lib/games.ts', repoRoot), 'utf8');
  const gameId = registry.match(/export type GameId\s*=\s*([^;]+);/);
  assert.ok(gameId, 'GameId union not found in src/lib/games.ts');
  for (const match of gameId[1].matchAll(/'([^']+)'/g)) slugs.set(match[1], 'src/lib/games.ts');
  for (const { name, sql: migration } of await migrationFiles()) {
    const text = stripComments(migration);
    for (const list of text.matchAll(/\bgame\s+IN\s*\(([^)]*)\)/gi)) for (const m of list[1].matchAll(/'([^']+)'/g)) slugs.set(m[1], name);
    for (const insert of text.matchAll(/INSERT INTO\s+(?:public\.)?game_types\s*\([^)]*\)\s*VALUES([\s\S]*?)(?:ON CONFLICT|;)/gi)) {
      for (const m of insert[1].matchAll(/\(\s*'([^']+)'/g)) slugs.set(m[1], name);
    }
    for (const m of text.matchAll(/game_slug\s*(?:=|<>|!=)\s*'([^']+)'/gi)) slugs.set(m[1], name);
    for (const m of text.matchAll(/game_slug\s+TEXT\s+NOT NULL\s+DEFAULT\s+'([^']+)'/gi)) slugs.set(m[1], name);
  }
  assert.ok(slugs.size >= 4, 'Slug discovery found too few games');
  for (const [slug, source] of slugs) {
    const canonical = SLUG_ALIASES[slug] ?? slug;
    assert.ok(branches.has(canonical), `Game slug '${slug}' (from ${source}) has no groups reset branch in ${MIGRATION}`);
  }
  // Aliases are only valid because group_games was normalised; the function must also sweep legacy-tagged rows.
  const baseline = await readFile(new URL('000_baseline.sql', migrationsDir), 'utf8');
  for (const [legacy, canonical] of Object.entries(SLUG_ALIASES)) {
    assert.match(baseline, new RegExp(`UPDATE group_games\\s+SET game_slug = '${canonical}'\\s+WHERE game_slug = '${legacy}'`));
    assert.match(sql, new RegExp(`'${canonical}'[^;]*'${legacy}'`), `${MIGRATION} must also delete rows tagged '${legacy}'`);
    assert.ok(!branches.has(legacy), 'Aliases must not get their own groups branch');
  }

  const columns = await groupsPerGameColumns();
  for (const [slug, reset] of branches) {
    const prefix = COLUMN_PREFIX[slug];
    assert.ok(prefix, `Branch '${slug}' has no known column prefix`);
    const expected = [...columns.keys()].filter(name => name.startsWith(`${prefix}_`)).sort();
    assert.ok(expected.length > 0, `No ${prefix}_ columns found on groups`);
    assert.deepEqual([...reset].sort(), expected, `Branch '${slug}' must reset exactly the ${prefix}_ columns on groups`);
  }
  for (const slug of Object.keys(COLUMN_PREFIX)) assert.ok(branches.has(slug), `Known game '${slug}' has no branch`);
});

// ---------- database tests ----------

type Ctx = { client: Client; schema: string; t: (name: string) => string; fn: string };

async function withSchema(run: (ctx: Ctx) => Promise<void>) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  const schema = `delete_game_test_${randomUUID().replaceAll('-', '')}`;
  const t = (name: string) => `"${schema}"."${name}"`;
  const rewrite = (source: string) => {
    assert.match(source, /^BEGIN;\s/);
    assert.match(source, /COMMIT;\s*$/);
    return source.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '').replaceAll('public.', `"${schema}".`);
  };
  const migration = async (name: string) => client.query(rewrite(await readFile(new URL(name, migrationsDir), 'utf8')));
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    const perGame = [...(await groupsPerGameColumns()).values()];
    // Stubs mirror 000_baseline.sql column names and ON DELETE actions for every table touched.
    await client.query(`
      CREATE TABLE ${t('migration_history')} (filename text PRIMARY KEY);
      CREATE TABLE ${t('users')} (id uuid PRIMARY KEY, display_name text, discord_username text);
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
        user_id uuid REFERENCES ${t('users')}(id) ON DELETE SET NULL, name varchar(100) NOT NULL,
        game_slug text NOT NULL DEFAULT 'aoc'
      );
      CREATE TABLE ${t('member_professions')} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid REFERENCES ${t('members')}(id) ON DELETE CASCADE,
        profession varchar(50) NOT NULL, rank integer NOT NULL, UNIQUE(member_id, profession)
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
    // The real Star Citizen loaner triggers, verbatim from the baseline (unqualified names, session search_path).
    const baseline = await readFile(new URL('000_baseline.sql', migrationsDir), 'utf8');
    const start = baseline.indexOf('CREATE OR REPLACE FUNCTION ship_id_to_display_name');
    const endMarker = 'EXECUTE FUNCTION remove_loaner_ships_for_pledge();';
    const end = baseline.indexOf(endMarker, start);
    assert.ok(start > 0 && end > start, 'Loaner trigger section not found in baseline');
    await client.query(`SET LOCAL search_path = "${schema}"`);
    await client.query(baseline.slice(start, end + endMarker.length));
    // Production sessions resolve these unqualified names through search_path.
    await client.query(`SET LOCAL search_path = "${schema}", public`);
    for (const name of [
      '013_add_discord_webhook_logs.sql', '015_admin_discord_notifications.sql', '016_admin_notification_role_mentions.sql',
      '017_admin_notification_categories.sql', '018_admin_notification_game_deleted.sql', '019_suppress_alert_flag.sql', MIGRATION,
    ]) await migration(name);
    await run({ client, schema, t, fn: t('delete_group_game') });
  } finally {
    try { await client.query('ROLLBACK'); } finally { await client.end(); }
  }
}

type Seed = Awaited<ReturnType<typeof seed>>;
const X = 'starcitizen'; // deleted game
const Y = 'aoc'; // sibling game

async function seed({ client, t }: Ctx) {
  const users = { adminA: randomUUID(), officerA: randomUUID(), adminB: randomUUID(), player: randomUUID(), outsider: randomUUID() };
  for (const [name, id] of Object.entries(users)) await client.query(`INSERT INTO ${t('users')} VALUES ($1,$2,$2)`, [id, name]);
  const groups = { A: randomUUID(), B: randomUUID() };
  for (const [key, id] of Object.entries(groups)) {
    await client.query(`INSERT INTO ${t('groups')}(id, slug, name, created_by) VALUES ($1,$2,$3,$4)`, [id, `g-${key}-${id}`, `Guild ${key}`, users.adminA]);
  }
  await client.query(`INSERT INTO ${t('group_members')}(group_id,user_id,role) VALUES ($1,$2,'admin'),($1,$3,'officer'),($4,$5,'admin'),($1,$6,'member'),($4,$6,'member')`,
    [groups.A, users.adminA, users.officerA, groups.B, users.adminB, users.player]);
  await client.query(`INSERT INTO ${t('sc_loaner_matrix')}(pledged_ship, loaner_ship) VALUES ('p-ship','l-ship')`);
  const parties: Record<string, string> = {};
  const members: Record<string, string> = {};
  for (const [key, group] of Object.entries(groups)) {
    parties[key] = (await client.query(`INSERT INTO ${t('parties')}(group_id,name) VALUES ($1,'Party') RETURNING id`, [group])).rows[0].id;
    await client.query(`INSERT INTO ${t('announcements')}(group_id,title,content) VALUES ($1,'Hi','Body')`, [group]);
    await client.query(`INSERT INTO ${t('alliances')}(name,leader_group_id) VALUES ('Pact',$1)`, [group]);
    const other = key === 'A' ? groups.B : groups.A;
    for (const game of [X, Y]) {
      await client.query(`INSERT INTO ${t('group_games')}(group_id,game_slug,archived) VALUES ($1,$2,$3)`, [group, game, game === X]);
      const member = (await client.query(`INSERT INTO ${t('members')}(group_id,name,game_slug) VALUES ($1,'Pilot',$2) RETURNING id`, [group, game])).rows[0].id;
      members[`${key}/${game}`] = member;
      await client.query(`INSERT INTO ${t('member_professions')}(member_id,profession,rank) VALUES ($1,'mining',2)`, [member]);
      await client.query(`INSERT INTO ${t('character_ships')}(character_id,ship_id,ownership_type) VALUES ($1,'p-ship','pledged'),($1,'other','in-game')`, [member]);
      await client.query(`INSERT INTO ${t('party_roster')}(party_id,character_id,role) VALUES ($1,$2,'tank')`, [parties[key], member]);
      await client.query(`INSERT INTO ${t('node_citizenships')}(character_id,node_name) VALUES ($1,'Node')`, [member]);
      const event = (await client.query(`INSERT INTO ${t('events')}(group_id,title,game_slug) VALUES ($1,'Op',$2) RETURNING id`, [group, game])).rows[0].id;
      await client.query(`INSERT INTO ${t('event_rsvps')}(event_id,user_id,character_id) VALUES ($1,$2,$3)`, [event, users.player, member]);
      await client.query(`INSERT INTO ${t('guest_event_rsvps')}(event_id,allied_group_id,guest_name,class_id,role) VALUES ($1,$2,'Guest','mage','dps')`, [event, other]);
      await client.query(`INSERT INTO ${t('recruitment_applications')}(group_id,discord_username,game_slug) VALUES ($1,'applicant',$2)`, [group, game]);
      await client.query(`INSERT INTO ${t('game_ship_permissions')}(group_id,game_slug) VALUES ($1,$2)`, [group, game]);
      await client.query(`INSERT INTO ${t('discord_webhook_logs')}(group_id,game_slug,kind,actor_id) VALUES ($1,$2,'event',$3)`, [group, game, users.adminA]);
    }
    // Legacy-tagged Star Citizen rows (the baseline seeded game_ship_permissions with 'star-citizen').
    await client.query(`INSERT INTO ${t('game_ship_permissions')}(group_id,game_slug) VALUES ($1,'star-citizen')`, [group]);
    await client.query(`INSERT INTO ${t('discord_webhook_logs')}(group_id,game_slug,kind,actor_id) VALUES ($1,'star-citizen','test',$2)`, [group, users.adminA]);
    // Group-wide rows that carry no game.
    await client.query(`INSERT INTO ${t('recruitment_applications')}(group_id,discord_username,game_slug) VALUES ($1,'untagged',NULL)`, [group]);
    await client.query(`INSERT INTO ${t('activity_log')}(group_id,character_id) VALUES ($1,$2)`, [group, members[`${key}/${X}`]]);
  }
  return { users, groups, members, parties };
}

async function counts({ client, t }: Ctx, group: string, game: string) {
  const slugs = game === 'starcitizen' ? ['starcitizen', 'star-citizen'] : [game];
  const one = async (sql: string) => Number((await client.query(sql, [group, slugs])).rows[0].count);
  const byMember = (table: string, column = 'character_id') =>
    one(`SELECT count(*) FROM ${t(table)} c JOIN ${t('members')} m ON m.id = c.${column} WHERE m.group_id=$1 AND m.game_slug = ANY($2)`);
  const byEvent = (table: string) =>
    one(`SELECT count(*) FROM ${t(table)} c JOIN ${t('events')} e ON e.id = c.event_id WHERE e.group_id=$1 AND e.game_slug = ANY($2)`);
  const tagged = (table: string) => one(`SELECT count(*) FROM ${t(table)} WHERE group_id=$1 AND game_slug = ANY($2)`);
  return {
    members: await tagged('members'),
    member_professions: await byMember('member_professions', 'member_id'),
    character_ships: await byMember('character_ships'),
    party_roster: await byMember('party_roster'),
    node_citizenships: await byMember('node_citizenships'),
    events: await tagged('events'),
    event_rsvps: await byEvent('event_rsvps'),
    guest_event_rsvps: await byEvent('guest_event_rsvps'),
    recruitment_applications: await tagged('recruitment_applications'),
    game_ship_permissions: await tagged('game_ship_permissions'),
    discord_webhook_logs: await tagged('discord_webhook_logs'),
    group_games: await tagged('group_games'),
  };
}

async function snapshot(ctx: Ctx, s: Seed) {
  const result: Record<string, unknown> = {};
  for (const [key, group] of Object.entries(s.groups)) for (const game of [X, Y]) result[`${key}/${game}`] = await counts(ctx, group, game);
  for (const table of ['groups', 'parties', 'announcements', 'alliances', 'activity_log', 'recruitment_applications', 'admin_discord_notifications', 'character_ships']) {
    result[table] = (await ctx.client.query(`SELECT to_jsonb(r) AS row FROM ${ctx.t(table)} r ORDER BY r.id`)).rows.map(r => r.row);
  }
  return result;
}

const call = (ctx: Ctx, group: string, game: string, confirm: string | null, expected: string | null, actor: string) =>
  ctx.client.query(`SELECT ${ctx.fn}($1,$2,$3,$4,$5)`, [group, game, confirm, expected, actor]);

test('deletes only the target group and game', { skip: !connectionString }, () => withSchema(async ctx => {
  const s = await seed(ctx);
  const before = await snapshot(ctx, s);
  const full = before['A/starcitizen'] as Record<string, number>;
  assert.ok(Object.values(full).every(count => count > 0), `Seed must populate every A/X table: ${JSON.stringify(full)}`);
  assert.equal(full.character_ships, 3, 'Pledged ship auto-grants a loaner via the real baseline trigger');
  await call(ctx, s.groups.A, X, 'Star Citizen', 'Star Citizen', s.users.adminA);
  const after = await snapshot(ctx, s);
  const zero = Object.fromEntries(Object.keys(full).map(key => [key, 0]));
  assert.deepEqual(after['A/starcitizen'], zero, 'All A/X rows (and cascaded children) are gone');
  for (const key of ['A/aoc', 'B/starcitizen', 'B/aoc']) assert.deepEqual(after[key], before[key], `${key} untouched`);
  const remainingShips = (await ctx.client.query(`SELECT count(*) FROM ${ctx.t('character_ships')}`)).rows[0].count;
  assert.equal(Number(remainingShips), 9);
}));

test('leaves group-wide tables alone', { skip: !connectionString }, () => withSchema(async ctx => {
  const s = await seed(ctx);
  const before = await snapshot(ctx, s);
  await call(ctx, s.groups.A, X, 'Star Citizen', 'Star Citizen', s.users.adminA);
  const after = await snapshot(ctx, s);
  for (const table of ['parties', 'announcements', 'alliances']) {
    assert.deepEqual(after[table], before[table], `${table} untouched`);
    assert.ok((after[table] as unknown[]).length >= 2);
  }
  const { rows: log } = await ctx.client.query(`SELECT group_id, character_id FROM ${ctx.t('activity_log')} ORDER BY group_id`);
  assert.equal(log.length, 2, 'Activity log rows are kept');
  assert.equal(log.find(r => r.group_id === s.groups.A).character_id, null, 'Deleted character is nulled, not cascaded');
  assert.equal(log.find(r => r.group_id === s.groups.B).character_id, s.members[`B/${X}`]);
  const untagged = await ctx.client.query(`SELECT count(*) FROM ${ctx.t('recruitment_applications')} WHERE game_slug IS NULL`);
  assert.equal(Number(untagged.rows[0].count), 2, 'Applications without a game are group-wide and kept');
  const { rows: groups } = await ctx.client.query(`SELECT id FROM ${ctx.t('groups')}`);
  assert.equal(groups.length, 2, 'The group itself remains');
  const { rows: members } = await ctx.client.query(`SELECT count(*) FROM ${ctx.t('group_members')} WHERE group_id=$1`, [s.groups.A]);
  assert.equal(Number(members[0].count), 3, 'Group memberships remain');
}));

test('resets per-game groups columns to defaults', { skip: !connectionString }, () => withSchema(async ctx => {
  const s = await seed(ctx);
  const { client, t } = ctx;
  const columns = [...(await groupsPerGameColumns()).keys()];
  const { rows: types } = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name='groups'`, [ctx.schema]);
  const typeOf = Object.fromEntries(types.map(r => [r.column_name, r.data_type]));
  const fresh = (await client.query(`INSERT INTO ${t('groups')}(slug,name) VALUES ('fresh','Fresh') RETURNING to_jsonb(${t('groups')}.*) AS row`)).rows[0].row;
  const custom = (column: string, salt: string) => {
    if (typeOf[column] === 'boolean') return fresh[column] === true ? false : true;
    if (typeOf[column] === 'jsonb') return JSON.stringify([{ id: `rank-${salt}` }]);
    return column.endsWith('webhook_url') ? `${SECRET_URL}/${salt}` : column.endsWith('role_id') ? '123456789012345678' : `custom ${salt}`;
  };
  for (const [key, group] of Object.entries(s.groups)) {
    const assignments = columns.map((column, i) => `${column} = $${i + 2}`).join(', ');
    await client.query(`UPDATE ${t('groups')} SET ${assignments} WHERE id=$1`, [group, ...columns.map(c => custom(c, key))]);
  }
  const extra = ['ror', 'wowforever', 'newgame'];
  for (const game of extra) await client.query(`INSERT INTO ${t('group_games')}(group_id,game_slug,archived) VALUES ($1,$2,true)`, [s.groups.A, game]);
  await client.query(`UPDATE ${t('group_games')} SET archived=true WHERE group_id=$1`, [s.groups.A]);
  const rowOf = async (id: string) => (await client.query(`SELECT to_jsonb(g) AS row FROM ${t('groups')} g WHERE id=$1`, [id])).rows[0].row;
  const beforeA = await rowOf(s.groups.A);
  const beforeB = await rowOf(s.groups.B);
  for (const column of columns) assert.notDeepEqual(beforeA[column], fresh[column], `${column} must start non-default`);

  for (const game of [...Object.keys(COLUMN_PREFIX), 'newgame']) {
    await client.query('SAVEPOINT per_game');
    await call(ctx, s.groups.A, game, DISPLAY_NAME[game] ?? 'New Game', DISPLAY_NAME[game] ?? 'New Game', s.users.adminA);
    const afterA = await rowOf(s.groups.A);
    const prefix = COLUMN_PREFIX[game];
    for (const column of columns) {
      if (prefix && column.startsWith(`${prefix}_`)) assert.deepEqual(afterA[column], fresh[column], `${game}: ${column} reset to default`);
      else assert.deepEqual(afterA[column], beforeA[column], `${game}: ${column} untouched`);
    }
    for (const key of Object.keys(beforeA)) if (!columns.includes(key)) assert.deepEqual(afterA[key], beforeA[key], `${game}: ${key} untouched`);
    assert.deepEqual(await rowOf(s.groups.B), beforeB, `${game}: other group untouched`);
    const gone = await client.query(`SELECT count(*) FROM ${t('group_games')} WHERE group_id=$1 AND game_slug=$2`, [s.groups.A, game]);
    assert.equal(Number(gone.rows[0].count), 0);
    await client.query('ROLLBACK TO SAVEPOINT per_game');
  }
}));

test('rejects', { skip: !connectionString }, () => withSchema(async ctx => {
  const s = await seed(ctx);
  const before = await snapshot(ctx, s);
  const cases: [string, string, string | null, string | null, string, string][] = [
    ['officer', X, 'Star Citizen', 'Star Citizen', s.users.officerA, 'NOT_ADMIN'],
    ['member', X, 'Star Citizen', 'Star Citizen', s.users.player, 'NOT_ADMIN'],
    ['outsider', X, 'Star Citizen', 'Star Citizen', s.users.outsider, 'NOT_ADMIN'],
    ['admin of other group', X, 'Star Citizen', 'Star Citizen', s.users.adminB, 'NOT_ADMIN'],
    ['officer before archived check', Y, 'Ashes of Creation', 'Ashes of Creation', s.users.officerA, 'NOT_ADMIN'],
    ['unknown game', 'ror', 'Return of Reckoning', 'Return of Reckoning', s.users.adminA, 'GAME_NOT_FOUND'],
    ['legacy alias is not a stored game', 'star-citizen', 'Star Citizen', 'Star Citizen', s.users.adminA, 'GAME_NOT_FOUND'],
    ['unknown game before confirmation', 'ror', 'wrong', 'Return of Reckoning', s.users.adminA, 'GAME_NOT_FOUND'],
    ['unarchived', Y, 'Ashes of Creation', 'Ashes of Creation', s.users.adminA, 'GAME_NOT_ARCHIVED'],
    ['unarchived before confirmation', Y, 'wrong', 'Ashes of Creation', s.users.adminA, 'GAME_NOT_ARCHIVED'],
    ['case differs', X, 'star citizen', 'Star Citizen', s.users.adminA, 'CONFIRMATION_MISMATCH'],
    ['trailing space', X, 'Star Citizen ', 'Star Citizen', s.users.adminA, 'CONFIRMATION_MISMATCH'],
    ['leading space', X, ' Star Citizen', 'Star Citizen', s.users.adminA, 'CONFIRMATION_MISMATCH'],
    ['empty', X, '', 'Star Citizen', s.users.adminA, 'CONFIRMATION_MISMATCH'],
    ['null confirmation', X, null, 'Star Citizen', s.users.adminA, 'CONFIRMATION_MISMATCH'],
    ['null expected', X, null, null, s.users.adminA, 'CONFIRMATION_MISMATCH'],
    ['empty expected', X, '', '', s.users.adminA, 'CONFIRMATION_MISMATCH'],
  ];
  for (const [label, game, confirm, expected, actor, code] of cases) {
    await ctx.client.query('SAVEPOINT reject');
    await assert.rejects(call(ctx, s.groups.A, game, confirm, expected, actor),
      (error: Error) => { assert.equal(error.message, code, label); return true; });
    await ctx.client.query('ROLLBACK TO SAVEPOINT reject');
    assert.deepEqual(await snapshot(ctx, s), before, `${label}: all rows intact`);
  }
}));

test('refuses to delete the last remaining game, checked after confirmation', { skip: !connectionString }, () => withSchema(async ctx => {
  const s = await seed(ctx);
  const { client, t } = ctx;
  // Group A keeps only X (starcitizen, archived); a legacy star-citizen alias row must not count as another game.
  await client.query(`DELETE FROM ${t('group_games')} WHERE group_id=$1 AND game_slug=$2`, [s.groups.A, Y]);
  await client.query(`INSERT INTO ${t('group_games')}(group_id,game_slug,archived) VALUES ($1,'star-citizen',true)`, [s.groups.A]);
  const before = await snapshot(ctx, s);
  const cases: [string, string, string, string][] = [
    ['last game', 'Star Citizen', 'Star Citizen', 'LAST_GAME'],
    ['confirmation checked before last game', 'wrong', 'Star Citizen', 'CONFIRMATION_MISMATCH'],
  ];
  for (const [label, confirm, expected, code] of cases) {
    await client.query('SAVEPOINT last');
    await assert.rejects(call(ctx, s.groups.A, X, confirm, expected, s.users.adminA),
      (error: Error) => { assert.equal(error.message, code, label); return true; });
    await client.query('ROLLBACK TO SAVEPOINT last');
    assert.deepEqual(await snapshot(ctx, s), before, `${label}: all rows intact`);
  }
  // With another game present the same deletion succeeds.
  await client.query(`INSERT INTO ${t('group_games')}(group_id,game_slug,archived) VALUES ($1,$2,false)`, [s.groups.A, Y]);
  await call(ctx, s.groups.A, X, 'Star Citizen', 'Star Citizen', s.users.adminA);
  const left = await client.query(`SELECT game_slug FROM ${t('group_games')} WHERE group_id=$1`, [s.groups.A]);
  assert.deepEqual(left.rows.map(r => r.game_slug), [Y]);
}));

test('queues exactly one game_deleted notification', { skip: !connectionString }, () => withSchema(async ctx => {
  const s = await seed(ctx);
  const { client, t } = ctx;
  await client.query(`SELECT ${t('save_group_admin_discord')}($1,$2,$3)`, [s.groups.A, SECRET_URL, s.users.adminA]);
  await client.query(`UPDATE ${t('groups')} SET sc_webhook_url=$1, sc_events_webhook_url=$1, sc_announcement_role_id='123456789012345678' WHERE id=$2`,
    [`${SECRET_URL}/sc`, s.groups.A]);
  const rows = async () => (await client.query(`SELECT * FROM ${t('admin_discord_notifications')} ORDER BY created_at, id`)).rows;
  const before = await rows();
  const destination = (await client.query(`SELECT destination_id FROM ${t('group_admin_discord')} WHERE group_id=$1`, [s.groups.A])).rows[0].destination_id;
  assert.ok(destination);
  await call(ctx, s.groups.A, X, 'Star Citizen', 'Star Citizen', s.users.adminA);
  const added = (await rows()).filter(row => !before.some(prior => prior.id === row.id));
  assert.equal(added.length, 1, `Exactly one alert: ${JSON.stringify(added.map(r => r.kind))}`);
  const [alert] = added;
  assert.equal(alert.kind, 'game_deleted');
  assert.equal(alert.destination, 'group');
  assert.equal(alert.destination_id, destination);
  assert.equal(alert.group_id, s.groups.A);
  assert.equal(alert.group_name, 'Guild A');
  assert.equal(alert.actor_id, s.users.adminA);
  assert.equal(alert.subject_name, 'Star Citizen');
  assert.deepEqual(alert.changes, { game: 'Star Citizen' });
  assert.equal(alert.changes.game, 'Star Citizen');
  assert.equal(alert.status, 'pending');
  const text = JSON.stringify(Object.values(alert));
  for (const secret of ['http://', 'https://', 'discord.com', 'webhooks', 'private-delete-test-token', '123456789012345678']) {
    assert.ok(!text.includes(secret), `No ${secret} in alert: ${text}`);
  }
  assert.equal(added.filter(row => row.kind === 'webhook_changed').length, 0, 'Column reset must not raise webhook_changed');

  // The suppression flag is restored, so later config changes in the same transaction still alert.
  await client.query(`UPDATE ${t('groups')} SET aoc_webhook_url=$1 WHERE id=$2`, [`${SECRET_URL}/later`, s.groups.A]);
  assert.equal((await rows()).filter(row => row.kind === 'webhook_changed' && row.changes?.aoc_webhook_url === 'changed').length, 1);

  // A group without a private admin channel still records the alert, with no destination.
  await client.query(`UPDATE ${t('group_games')} SET archived=true WHERE group_id=$1 AND game_slug=$2`, [s.groups.B, X]);
  await call(ctx, s.groups.B, X, 'Star Citizen', 'Star Citizen', s.users.adminB);
  const forB = (await rows()).filter(row => row.kind === 'game_deleted' && row.group_id === s.groups.B);
  assert.equal(forB.length, 1);
  assert.equal(forB[0].destination_id, null);
}));

test('grants', { skip: !connectionString }, () => withSchema(async ctx => {
  const signature = `${ctx.schema}.delete_group_game(uuid,text,text,text,uuid)`;
  for (const [role, allowed] of [['anon', false], ['authenticated', false], ['public', false], ['service_role', true]] as const) {
    const { rows } = role === 'public'
      ? await ctx.client.query(`SELECT bool_or(a.privilege_type = 'EXECUTE' AND a.grantee = 0) AS allowed
          FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = $1::regprocedure`, [signature])
      : await ctx.client.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed', [role, signature]);
    assert.equal(Boolean(rows[0].allowed), allowed, `${role} execute`);
  }
  const { rows: [proc] } = await ctx.client.query('SELECT prosecdef, proconfig FROM pg_proc WHERE oid = $1::regprocedure', [signature]);
  assert.equal(proc.prosecdef, true);
  assert.deepEqual(proc.proconfig, ['search_path=""']);
  const { rows: [loaner] } = await ctx.client.query('SELECT proconfig FROM pg_proc WHERE oid = $1::regprocedure', [`${ctx.schema}.remove_loaner_ships_for_pledge()`]);
  assert.deepEqual(loaner.proconfig, ['search_path=""'], 'Loaner trigger must not depend on the caller search_path');
}));
