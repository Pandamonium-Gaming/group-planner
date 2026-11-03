import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from 'pg';

const connectionString = process.env.GP_MIGRATION_TEST_DATABASE_URL;
const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
const MIGRATION = '021_fix_loaner_trigger.sql';

type Ctx = { client: Client; schema: string; t: (name: string) => string; member: string; other: string };

/** Builds the production loaner-trigger state (baseline + 020's function rewrite) in a temp schema, then applies 021. */
async function withSchema(run: (ctx: Ctx) => Promise<void>) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  const schema = `loaner_test_${randomUUID().replaceAll('-', '')}`;
  const t = (name: string) => `"${schema}"."${name}"`;
  const rewrite = (source: string) => {
    assert.match(source, /^BEGIN;\s/);
    assert.match(source, /COMMIT;\s*$/);
    return source.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '').replaceAll('public.', `"${schema}".`);
  };
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    // Stubs mirror the 000_baseline.sql columns the loaner functions read and write.
    await client.query(`
      CREATE TABLE ${t('migration_history')} (filename text PRIMARY KEY);
      CREATE TABLE ${t('members')} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid, name varchar(100) NOT NULL,
        game_slug text NOT NULL DEFAULT 'aoc'
      );
      CREATE TABLE ${t('sc_loaner_matrix')} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pledged_ship text NOT NULL, loaner_ship text NOT NULL,
        loaner_type text DEFAULT 'primary' CHECK (loaner_type IN ('primary', 'arena_commander', 'temporary')),
        notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
        UNIQUE(pledged_ship, loaner_ship, loaner_type)
      );
      CREATE TABLE ${t('character_ships')} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        character_id uuid NOT NULL REFERENCES ${t('members')}(id) ON DELETE CASCADE, ship_id text NOT NULL,
        ownership_type text NOT NULL CHECK (ownership_type IN ('pledged', 'in-game', 'loaner', 'subscriber')),
        notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
        UNIQUE(character_id, ship_id, ownership_type)
      );
    `);
    // The real triggers, verbatim from the baseline (unqualified names resolve through this search_path).
    const baseline = await readFile(new URL('000_baseline.sql', migrationsDir), 'utf8');
    const start = baseline.indexOf('CREATE OR REPLACE FUNCTION ship_id_to_display_name');
    const endMarker = 'EXECUTE FUNCTION remove_loaner_ships_for_pledge();';
    const end = baseline.indexOf(endMarker, start);
    assert.ok(start > 0 && end > start, 'Loaner trigger section not found in baseline');
    await client.query(`SET LOCAL search_path = "${schema}"`);
    await client.query(baseline.slice(start, end + endMarker.length));
    // Production also has migration 020's schema-qualified rewrite of the removal function.
    const m020 = rewrite(await readFile(new URL('020_delete_group_game.sql', migrationsDir), 'utf8'));
    const fnEnd = m020.indexOf('$$;');
    const fnStart = m020.indexOf('CREATE OR REPLACE FUNCTION');
    assert.ok(fnStart >= 0 && fnEnd > fnStart && m020.slice(fnStart, fnEnd).includes('remove_loaner_ships_for_pledge'));
    await client.query(m020.slice(fnStart, fnEnd + 3));
    await client.query(rewrite(await readFile(new URL(MIGRATION, migrationsDir), 'utf8')));

    await client.query(`INSERT INTO ${t('sc_loaner_matrix')}(pledged_ship, loaner_ship, loaner_type, notes) VALUES
      ('p-ship','l-ship','primary',NULL), ('p-ship','l-arena','arena_commander',NULL),
      ('p-two','l-ship','primary',NULL), ('p-temp','l-temp','temporary',NULL)`);
    const member = (await client.query(`INSERT INTO ${t('members')}(name, game_slug) VALUES ('Pilot','starcitizen') RETURNING id`)).rows[0].id;
    const other = (await client.query(`INSERT INTO ${t('members')}(name, game_slug) VALUES ('Wingman','starcitizen') RETURNING id`)).rows[0].id;
    for (const id of [member, other]) {
      await client.query(`INSERT INTO ${t('character_ships')}(character_id, ship_id, ownership_type) VALUES ($1,'p-ship','pledged')`, [id]);
      await client.query(`INSERT INTO ${t('character_ships')}(character_id, ship_id, ownership_type) VALUES ($1,'hauler','in-game')`, [id]);
    }
    // Everything below runs with an empty search_path: nothing may depend on the caller's path.
    await client.query(`SET LOCAL search_path = ''`);
    await run({ client, schema, t, member, other });
  } finally {
    try { await client.query('ROLLBACK'); } finally { await client.end(); }
  }
}

const ships = async ({ client, t }: Ctx, character: string) =>
  (await client.query(`SELECT ship_id, ownership_type, notes FROM ${t('character_ships')} WHERE character_id=$1 ORDER BY ownership_type, ship_id`, [character])).rows;
const pairs = async (ctx: Ctx, character: string) => (await ships(ctx, character)).map(r => `${r.ownership_type}:${r.ship_id}`);

const SEEDED = ['in-game:hauler', 'loaner:l-arena', 'loaner:l-ship', 'pledged:p-ship'];

test('deleting a member with a pledged ship and its loaners removes every ship row', { skip: !connectionString }, () => withSchema(async ctx => {
  assert.deepEqual(await pairs(ctx, ctx.member), SEEDED);
  await ctx.client.query(`DELETE FROM ${ctx.t('members')} WHERE id=$1`, [ctx.member]);
  assert.deepEqual(await pairs(ctx, ctx.member), []);
  assert.deepEqual(await pairs(ctx, ctx.other), SEEDED, 'Other characters keep their ships');
}));

test('multi-row deletes of a character\'s ships succeed', { skip: !connectionString }, () => withSchema(async ctx => {
  const { client, t } = ctx;
  // The character-transfer import clears a character's ships with one statement.
  await client.query(`DELETE FROM ${t('character_ships')} WHERE character_id=$1`, [ctx.member]);
  assert.deepEqual(await pairs(ctx, ctx.member), []);
  // Deleting every member at once (a group deletion cascade).
  await client.query(`DELETE FROM ${t('members')}`);
  assert.equal(Number((await client.query(`SELECT count(*) FROM ${t('character_ships')}`)).rows[0].count), 0);
}));

test('deleting just the pledged ship removes its loaners, keeping loaners another pledge still grants', { skip: !connectionString }, () => withSchema(async ctx => {
  const { client, t } = ctx;
  await client.query(`DELETE FROM ${t('character_ships')} WHERE character_id=$1 AND ownership_type='pledged'`, [ctx.member]);
  assert.deepEqual(await pairs(ctx, ctx.member), ['in-game:hauler']);
  assert.deepEqual(await pairs(ctx, ctx.other), SEEDED, 'Other characters keep their loaners');

  // A loaner granted by two pledges survives removal of one of them, and goes with the last.
  await client.query(`INSERT INTO ${t('character_ships')}(character_id, ship_id, ownership_type) VALUES ($1,'p-two','pledged')`, [ctx.other]);
  await client.query(`DELETE FROM ${t('character_ships')} WHERE character_id=$1 AND ship_id='p-ship' AND ownership_type='pledged'`, [ctx.other]);
  assert.deepEqual(await pairs(ctx, ctx.other), ['in-game:hauler', 'loaner:l-ship', 'pledged:p-two']);
  await client.query(`DELETE FROM ${t('character_ships')} WHERE character_id=$1 AND ship_id='p-two'`, [ctx.other]);
  assert.deepEqual(await pairs(ctx, ctx.other), ['in-game:hauler']);

  // Both granting pledges deleted in one statement also removes the shared loaner.
  await client.query(`INSERT INTO ${t('character_ships')}(character_id, ship_id, ownership_type) VALUES ($1,'p-ship','pledged'),($1,'p-two','pledged')`, [ctx.member]);
  assert.deepEqual(await pairs(ctx, ctx.member), ['in-game:hauler', 'loaner:l-arena', 'loaner:l-ship', 'pledged:p-ship', 'pledged:p-two']);
  await client.query(`DELETE FROM ${t('character_ships')} WHERE character_id=$1 AND ownership_type='pledged'`, [ctx.member]);
  assert.deepEqual(await pairs(ctx, ctx.member), ['in-game:hauler']);
}));

test('deleting a loaner or an in-game ship alone removes only that row', { skip: !connectionString }, () => withSchema(async ctx => {
  const { client, t } = ctx;
  await client.query(`DELETE FROM ${t('character_ships')} WHERE character_id=$1 AND ship_id='l-ship'`, [ctx.member]);
  assert.deepEqual(await pairs(ctx, ctx.member), ['in-game:hauler', 'loaner:l-arena', 'pledged:p-ship'], 'The pledge stays and the loaner is not re-added');
  await client.query(`DELETE FROM ${t('character_ships')} WHERE character_id=$1 AND ship_id='hauler'`, [ctx.member]);
  assert.deepEqual(await pairs(ctx, ctx.member), ['loaner:l-arena', 'pledged:p-ship']);
  assert.deepEqual(await pairs(ctx, ctx.other), SEEDED);
}));

test('inserting a pledged ship auto-creates its loaners', { skip: !connectionString }, () => withSchema(async ctx => {
  const { client, t } = ctx;
  const rows = await ships(ctx, ctx.member);
  assert.deepEqual(rows.filter(r => r.ownership_type === 'loaner').map(r => [r.ship_id, r.notes]), [
    ['l-arena', 'Auto-granted loaner for P Ship (Arena Commander)'],
    ['l-ship', 'Auto-granted loaner for P Ship'],
  ]);
  // Under the empty search_path set by the harness.
  await client.query(`INSERT INTO ${t('character_ships')}(character_id, ship_id, ownership_type) VALUES ($1,'p-temp','pledged')`, [ctx.member]);
  await client.query(`INSERT INTO ${t('character_ships')}(character_id, ship_id, ownership_type) VALUES ($1,'p-two','pledged')`, [ctx.member]);
  await client.query(`INSERT INTO ${t('character_ships')}(character_id, ship_id, ownership_type) VALUES ($1,'p-ship','in-game')`, [ctx.member]);
  const after = await ships(ctx, ctx.member);
  assert.deepEqual(after.map(r => `${r.ownership_type}:${r.ship_id}`),
    ['in-game:hauler', 'in-game:p-ship', 'loaner:l-arena', 'loaner:l-ship', 'loaner:l-temp', 'pledged:p-ship', 'pledged:p-temp', 'pledged:p-two'],
    'Existing loaners are not duplicated and non-pledged ships grant nothing');
  assert.equal(after.find(r => r.ship_id === 'l-temp').notes, 'Auto-granted loaner for P Temp (Temporary: see RSI)');
}));

test('both loaner functions pin an empty search_path and stay SECURITY INVOKER; removal fires AFTER DELETE', { skip: !connectionString }, () => withSchema(async ctx => {
  const { client, schema } = ctx;
  for (const name of ['add_loaner_ships_for_pledge', 'remove_loaner_ships_for_pledge']) {
    const { rows: [proc] } = await client.query('SELECT prosecdef, proconfig FROM pg_catalog.pg_proc WHERE oid = $1::regprocedure', [`"${schema}".${name}()`]);
    assert.equal(proc.prosecdef, false, `${name} keeps the baseline SECURITY INVOKER`);
    assert.deepEqual(proc.proconfig, ['search_path=""'], `${name} must not depend on the caller search_path`);
  }
  const { rows } = await client.query(`
    SELECT tg.tgname, pg_catalog.pg_get_triggerdef(tg.oid) AS def FROM pg_catalog.pg_trigger tg
    WHERE tg.tgrelid = $1::regclass AND NOT tg.tgisinternal ORDER BY tg.tgname`, [`"${schema}".character_ships`]);
  const defs = Object.fromEntries(rows.map(r => [r.tgname, r.def.replace(`"${schema}".`, '').replace(`${schema}.`, '')]));
  assert.deepEqual(Object.keys(defs), ['trigger_add_loaner_ships', 'trigger_remove_loaner_ships']);
  assert.match(defs.trigger_add_loaner_ships, /AFTER INSERT ON character_ships FOR EACH ROW EXECUTE FUNCTION .*add_loaner_ships_for_pledge\(\)$/);
  assert.match(defs.trigger_remove_loaner_ships, /AFTER DELETE ON character_ships FOR EACH ROW EXECUTE FUNCTION .*remove_loaner_ships_for_pledge\(\)$/);
  const recorded = await client.query(`SELECT 1 FROM "${schema}".migration_history WHERE filename=$1`, [MIGRATION]);
  assert.equal(recorded.rowCount, 1);
}));
