import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from 'pg';
import { createGameSchema } from './game-schema.mts';

// Migration 023: inserts into members, events and recruitment_applications are refused for a game the group no
// longer has enabled, and coordinate with delete_group_game through row locks. Unlike the other migration tests,
// the schema is committed so two real connections can race; it is dropped afterwards.
const connectionString = process.env.GP_MIGRATION_TEST_DATABASE_URL;
const MIGRATION = '023_validate_game_writes.sql';
const X = 'starcitizen'; // archived, then deleted
const Y = 'aoc'; // still enabled

type Ctx = {
  schema: string;
  t: (name: string) => string;
  connect: () => Promise<Client>;
  admin: Client;
  users: { admin: string };
  groups: { A: string; legacy: string };
};

async function withCommittedSchema(run: (ctx: Ctx) => Promise<void>) {
  const schema = `validate_game_test_${randomUUID().replaceAll('-', '')}`;
  const t = (name: string) => `"${schema}"."${name}"`;
  const clients: Client[] = [];
  const connect = async () => {
    const client = new Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
    await client.connect();
    clients.push(client);
    await client.query(`SET search_path = "${schema}", public`);
    return client;
  };
  const admin = new Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  await admin.connect();
  try {
    await admin.query('BEGIN');
    await createGameSchema(admin, schema);
    await admin.query('COMMIT');
    await admin.query(`SET search_path = "${schema}", public`);
    const users = { admin: randomUUID() };
    await admin.query(`INSERT INTO ${t('users')}(id, display_name) VALUES ($1, 'admin')`, [users.admin]);
    const groups = { A: randomUUID(), legacy: randomUUID() };
    for (const [key, id] of Object.entries(groups)) {
      await admin.query(`INSERT INTO ${t('groups')}(id, slug, name) VALUES ($1, $2, $3)`, [id, `g-${key}-${id}`, `Guild ${key}`]);
      await admin.query(`INSERT INTO ${t('group_members')}(group_id, user_id, role) VALUES ($1, $2, 'admin')`, [id, users.admin]);
    }
    // Group A has X (archived) and Y enabled; the legacy group has no group_games rows at all.
    await admin.query(`INSERT INTO ${t('group_games')}(group_id, game_slug, archived) VALUES ($1, $2, true), ($1, $3, false)`,
      [groups.A, X, Y]);
    await run({ schema, t, connect, admin, users, groups });
  } finally {
    for (const client of clients) await client.end().catch(() => undefined);
    try {
      await admin.query('ROLLBACK').catch(() => undefined);
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  }
}

const deleteX = (ctx: Ctx, client: Client = ctx.admin) =>
  client.query(`SELECT ${ctx.t('delete_group_game')}($1, $2, 'Star Citizen', 'Star Citizen', $3)`, [ctx.groups.A, X, ctx.users.admin]);

const insertMember = (ctx: Ctx, client: Client, group: string, game: string) =>
  client.query(`INSERT INTO ${ctx.t('members')}(group_id, name, game_slug) VALUES ($1, 'Pilot', $2) RETURNING id`, [group, game]);
const insertEvent = (ctx: Ctx, client: Client, group: string, game: string) =>
  client.query(`INSERT INTO ${ctx.t('events')}(group_id, title, game_slug) VALUES ($1, 'Op', $2) RETURNING id`, [group, game]);
const insertApplication = (ctx: Ctx, client: Client, group: string, game: string | null) =>
  client.query(`INSERT INTO ${ctx.t('recruitment_applications')}(group_id, discord_username, game_slug) VALUES ($1, 'applicant', $2) RETURNING id`,
    [group, game]);
const insertWebhookLog = (ctx: Ctx, client: Client, group: string, game: string | null) =>
  client.query(`INSERT INTO ${ctx.t('discord_webhook_logs')}(group_id, game_slug, kind, actor_id) VALUES ($1, $2, 'event', $3) RETURNING id`,
    [group, game, ctx.users.admin]);

async function count(ctx: Ctx, table: string, group: string, games: (string | null)[]) {
  const { rows } = await ctx.admin.query(
    `SELECT count(*) FROM ${ctx.t(table)} WHERE group_id = $1 AND (game_slug = ANY($2) OR (game_slug IS NULL AND $3))`,
    [group, games.filter(game => game !== null), games.includes(null)]);
  return Number(rows[0].count);
}

const notEnabled = (error: Error & { code?: string }) => {
  assert.equal(error.message, 'GAME_NOT_ENABLED');
  assert.equal(error.code, 'P0001');
  return true;
};

/** Resolves once the backend `pid` is waiting on a lock (polling pg_stat_activity), or fails after ~5s. */
async function waitUntilBlocked(observer: Client, pid: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const { rows } = await observer.query(`SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1`, [pid]);
    if (rows[0]?.wait_event_type === 'Lock') return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`Backend ${pid} never blocked on a lock`);
}

const pidOf = async (client: Client) => (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;

/** Tracks whether a promise has settled, without letting a rejection go unhandled. */
function track<T>(promise: Promise<T>) {
  const state = { settled: false };
  const result = promise.then(
    value => { state.settled = true; return { ok: true as const, value }; },
    (error: Error) => { state.settled = true; return { ok: false as const, error }; });
  return { state, result };
}

test('the migration is wrapped and records itself', async () => {
  const sql = await readFile(new URL(`../../supabase/migrations/${MIGRATION}`, import.meta.url), 'utf8');
  assert.match(sql, /^BEGIN;\s/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(sql, new RegExp(`INSERT INTO public\\.migration_history\\(filename\\) VALUES \\('${MIGRATION}'\\)`));
  const list = JSON.parse(await readFile(new URL('../../src/migration_files.json', import.meta.url), 'utf8'));
  assert.ok(list.includes(MIGRATION), 'src/migration_files.json must list the migration');
});

test('a stale form cannot recreate a deleted game\'s data', { skip: !connectionString }, () => withCommittedSchema(async ctx => {
  await deleteX(ctx);
  for (const [label, insert] of [
    ['member', () => insertMember(ctx, ctx.admin, ctx.groups.A, X)],
    ['member (legacy alias)', () => insertMember(ctx, ctx.admin, ctx.groups.A, 'star-citizen')],
    ['event', () => insertEvent(ctx, ctx.admin, ctx.groups.A, X)],
    ['recruitment application', () => insertApplication(ctx, ctx.admin, ctx.groups.A, X)],
    ['webhook log', () => insertWebhookLog(ctx, ctx.admin, ctx.groups.A, X)],
  ] as const) {
    await assert.rejects(insert(), notEnabled, label);
  }
  for (const table of ['members', 'events', 'recruitment_applications', 'discord_webhook_logs']) {
    assert.equal(await count(ctx, table, ctx.groups.A, [X, 'star-citizen']), 0, `${table}: nothing left behind`);
  }
}));

test('writes for a game that is still enabled (archived or not) succeed', { skip: !connectionString }, () => withCommittedSchema(async ctx => {
  for (const game of [Y, X]) {
    await insertMember(ctx, ctx.admin, ctx.groups.A, game);
    await insertEvent(ctx, ctx.admin, ctx.groups.A, game);
    await insertApplication(ctx, ctx.admin, ctx.groups.A, game);
    await insertWebhookLog(ctx, ctx.admin, ctx.groups.A, game);
    for (const table of ['members', 'events', 'recruitment_applications', 'discord_webhook_logs']) {
      assert.equal(await count(ctx, table, ctx.groups.A, [game]), 1);
    }
  }
  // A game the group never enabled is refused too.
  await assert.rejects(insertMember(ctx, ctx.admin, ctx.groups.A, 'ror'), notEnabled);
}));

test('a legacy group with no group_games rows can write for any game', { skip: !connectionString }, () => withCommittedSchema(async ctx => {
  for (const game of [X, Y, 'ror', 'wowforever', 'star-citizen']) {
    await insertMember(ctx, ctx.admin, ctx.groups.legacy, game);
    await insertEvent(ctx, ctx.admin, ctx.groups.legacy, game);
    await insertApplication(ctx, ctx.admin, ctx.groups.legacy, game);
  }
  assert.equal(await count(ctx, 'members', ctx.groups.legacy, [X, Y, 'ror', 'wowforever', 'star-citizen']), 5);
}));

test('the star-citizen alias matches a starcitizen row and vice versa', { skip: !connectionString }, () => withCommittedSchema(async ctx => {
  await insertMember(ctx, ctx.admin, ctx.groups.A, 'star-citizen');
  await insertEvent(ctx, ctx.admin, ctx.groups.A, 'star-citizen');
  // A group whose only Star Citizen row still carries the legacy tag.
  await ctx.admin.query(`INSERT INTO ${ctx.t('group_games')}(group_id, game_slug) VALUES ($1, 'star-citizen')`, [ctx.groups.legacy]);
  await insertMember(ctx, ctx.admin, ctx.groups.legacy, 'starcitizen');
  await assert.rejects(insertMember(ctx, ctx.admin, ctx.groups.legacy, Y), notEnabled, 'legacy group now has rows, so aoc is not enabled');
}));

test('recruitment applications without a game are always accepted', { skip: !connectionString }, () => withCommittedSchema(async ctx => {
  await deleteX(ctx);
  await insertApplication(ctx, ctx.admin, ctx.groups.A, null);
  await insertApplication(ctx, ctx.admin, ctx.groups.legacy, null);
  await insertWebhookLog(ctx, ctx.admin, ctx.groups.A, null);
  assert.equal(await count(ctx, 'recruitment_applications', ctx.groups.A, [null]), 1);
  assert.equal(await count(ctx, 'discord_webhook_logs', ctx.groups.A, [null]), 1);
}));

test('works for roles that cannot read group_games; the function is not directly callable', { skip: !connectionString }, () => withCommittedSchema(async ctx => {
  const { admin, t, schema } = ctx;
  await admin.query(`ALTER TABLE ${t('group_games')} ENABLE ROW LEVEL SECURITY`);
  await admin.query(`ALTER TABLE ${t('groups')} ENABLE ROW LEVEL SECURITY`);
  await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO anon, authenticated`);
  await admin.query(`GRANT INSERT ON ${t('members')}, ${t('events')}, ${t('recruitment_applications')} TO anon, authenticated`);
  await deleteX(ctx);
  const client = await ctx.connect();
  for (const role of ['authenticated', 'anon']) {
    await client.query(`SET ROLE ${role}`);
    await client.query(`INSERT INTO ${t('members')}(group_id, name, game_slug) VALUES ($1, 'Pilot', $2)`, [ctx.groups.A, Y]);
    await client.query(`INSERT INTO ${t('recruitment_applications')}(group_id, discord_username, game_slug) VALUES ($1, 'a', $2)`, [ctx.groups.A, Y]);
    await assert.rejects(client.query(`INSERT INTO ${t('members')}(group_id, name, game_slug) VALUES ($1, 'Pilot', $2)`, [ctx.groups.A, X]), notEnabled);
    await assert.rejects(client.query(`INSERT INTO ${t('recruitment_applications')}(group_id, discord_username, game_slug) VALUES ($1, 'a', $2)`,
      [ctx.groups.A, X]), notEnabled);
    await client.query('RESET ROLE');
  }
  const signature = `"${schema}".require_enabled_game()`;
  for (const role of ['anon', 'authenticated']) {
    const { rows } = await admin.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed`, [role, signature]);
    assert.equal(rows[0].allowed, false, `${role} must not execute the trigger function directly`);
  }
  const { rows: [proc] } = await admin.query('SELECT prosecdef, proconfig FROM pg_proc WHERE oid = $1::regprocedure', [signature]);
  assert.equal(proc.prosecdef, true);
  assert.deepEqual(proc.proconfig, ['search_path=""']);
}));

test('an insert racing an uncommitted deletion waits, then is refused', { skip: !connectionString }, () => withCommittedSchema(async ctx => {
  const deleter = await ctx.connect();
  const writer = await ctx.connect();
  const writerPid = await pidOf(writer);
  await deleter.query('BEGIN');
  await deleteX(ctx, deleter); // holds groups / group_games FOR UPDATE until commit
  const insert = track(insertMember(ctx, writer, ctx.groups.A, X));
  await waitUntilBlocked(ctx.admin, writerPid);
  assert.equal(insert.state.settled, false, 'The insert must wait for the deletion');
  await deleter.query('COMMIT');
  const outcome = await insert.result;
  assert.equal(outcome.ok, false, 'The insert must fail once the deletion commits');
  if (!outcome.ok) notEnabled(outcome.error);
  assert.equal(await count(ctx, 'members', ctx.groups.A, [X, 'star-citizen']), 0, 'No orphaned member remains');
}));

test('an insert that commits first is removed by the deletion waiting on it', { skip: !connectionString }, () => withCommittedSchema(async ctx => {
  const deleter = await ctx.connect();
  const writer = await ctx.connect();
  const deleterPid = await pidOf(deleter);
  await writer.query('BEGIN');
  const { rows: [created] } = await insertMember(ctx, writer, ctx.groups.A, X); // holds FOR KEY SHARE until commit
  const deletion = track(deleteX(ctx, deleter));
  await waitUntilBlocked(ctx.admin, deleterPid);
  assert.equal(deletion.state.settled, false, 'The deletion must wait for the insert');
  await writer.query('COMMIT');
  const outcome = await deletion.result;
  assert.ok(outcome.ok, `Deletion should succeed: ${outcome.ok ? '' : outcome.error.message}`);
  const { rows } = await ctx.admin.query(`SELECT id FROM ${ctx.t('members')} WHERE id = $1`, [created.id]);
  assert.deepEqual(rows, [], 'The concurrently inserted member is deleted with the game');
  assert.equal(await count(ctx, 'members', ctx.groups.A, [X, 'star-citizen']), 0);
}));

test('a character transfer and stale deletion use the same parent-first lock order', { skip: !connectionString }, () => withCommittedSchema(async ctx => {
  const deleter = await ctx.connect();
  const writer = await ctx.connect();
  const transferFunction = ctx.t('transfer_group_characters');
  const lockKey = Number.parseInt(randomUUID().slice(0, 7), 16);
  const document = {
    format: 'group-planner-characters',
    version: 1,
    game_slug: X,
    characters: [{
      id: randomUUID(),
      owner: { discord_id: null, label: null },
      data: { name: 'Imported pilot', level: 1, is_main: false },
      professions: [],
      ships: [],
    }],
  };

  await ctx.admin.query(`UPDATE ${ctx.t('group_games')} SET archived = false WHERE group_id = $1 AND game_slug = $2`,
    [ctx.groups.A, X]);
  await ctx.admin.query(`
    CREATE FUNCTION ${ctx.t('pause_member_insert')}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(${lockKey}, 42);
      RETURN NEW;
    END
    $$;
    CREATE TRIGGER aaa_pause_member_insert BEFORE INSERT ON ${ctx.t('members')}
      FOR EACH ROW EXECUTE FUNCTION ${ctx.t('pause_member_insert')}();
  `);
  const preview = await writer.query(`SELECT ${transferFunction}($1, $2, $3::jsonb) AS result`,
    [ctx.groups.A, X, JSON.stringify(document)]);

  const writerPid = await pidOf(writer);
  const deleterPid = await pidOf(deleter);
  await ctx.admin.query('SELECT pg_advisory_lock($1, 42)', [lockKey]);
  await writer.query('BEGIN');
  let transfer: ReturnType<typeof track> | undefined;
  let deletion: ReturnType<typeof track> | undefined;
  try {
    transfer = track(writer.query(`SELECT ${transferFunction}($1, $2, $3::jsonb, true, $4)`,
      [ctx.groups.A, X, JSON.stringify(document), preview.rows[0].result.token]));
    await waitUntilBlocked(ctx.admin, writerPid);
    deletion = track(deleteX(ctx, deleter));
    await waitUntilBlocked(ctx.admin, deleterPid);
  } finally {
    await ctx.admin.query('SELECT pg_advisory_unlock($1, 42)', [lockKey]);
  }

  assert.ok(transfer);
  const transferOutcome = await transfer.result;
  assert.ok(transferOutcome.ok, `Transfer should finish first: ${transferOutcome.ok ? '' : transferOutcome.error.message}`);
  await writer.query('COMMIT');
  assert.ok(deletion);
  const deletionOutcome = await deletion.result;
  assert.equal(deletionOutcome.ok, false, 'The stale deletion must revalidate the now-active game');
  if (!deletionOutcome.ok) assert.match(deletionOutcome.error.message, /GAME_NOT_ARCHIVED/);
  assert.equal(await count(ctx, 'members', ctx.groups.A, [X]), 1, 'The successful import remains intact');
}));
