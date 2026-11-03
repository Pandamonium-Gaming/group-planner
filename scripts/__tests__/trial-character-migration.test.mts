import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from 'pg';

const connectionString = process.env.GP_MIGRATION_TEST_DATABASE_URL;

test('migration 018 permits Trial INSERT RETURNING while excluding pending and unrelated accounts', {
  skip: !connectionString,
}, async () => {
  if (!connectionString) throw new Error('Local migration test database is required');
  const url = new URL(connectionString);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'Use a disposable local database');
  assert.equal(url.pathname, '/group_planner_rehearsal_validation');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  const suffix = randomUUID().replaceAll('-', '');
  const schema = `trial_character_test_${suffix}`;
  const role = `trial_character_role_${suffix}`;
  const table = (name: string) => `"${schema}"."${name}"`;
  const group = randomUUID();
  const unrelatedGroup = randomUUID();
  const account = randomUUID();
  const source = await readFile(new URL('../../supabase/migrations/018_trial_character_visibility.sql', import.meta.url), 'utf8');
  assert.match(source, /^BEGIN;\s/);
  assert.match(source, /COMMIT;\s*$/);
  const sql = source.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '')
    .replaceAll('public.', `"${schema}".`).replaceAll('auth.uid()', `${table('uid')}()`);
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"; CREATE ROLE "${role}" NOLOGIN`);
    await client.query(`
      CREATE TABLE ${table('group_members')} (group_id uuid, user_id uuid, role text);
      CREATE TABLE ${table('members')} (id uuid PRIMARY KEY, group_id uuid, user_id uuid, name text, discord_id text);
      CREATE TABLE ${table('migration_history')} (filename text PRIMARY KEY);
      CREATE FUNCTION ${table('uid')}() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION ${table('user_has_clan_role')}(gid uuid, uid uuid, roles text[])
        RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
          SELECT EXISTS(SELECT 1 FROM ${table('group_members')} m
            WHERE m.group_id=gid AND m.user_id=uid AND m.role=ANY(roles))
        $$;
      CREATE FUNCTION ${table('current_user_discord_id')}() RETURNS text LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('test.discord_id', true), '') $$;
      CREATE FUNCTION ${table('user_has_clan_role_by_discord')}(gid uuid, discord text, roles text[])
        RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
          SELECT EXISTS(SELECT 1 FROM ${table('members')} c JOIN ${table('group_members')} m
            ON m.user_id=c.user_id AND m.group_id=c.group_id
            WHERE c.group_id=gid AND c.discord_id=discord AND m.role=ANY(roles))
        $$;
      ALTER TABLE ${table('members')} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Group members can create characters" ON ${table('members')} FOR INSERT
        WITH CHECK (${table('user_has_clan_role')}(group_id, ${table('uid')}(), ARRAY['admin','officer','member','trial']));
      CREATE POLICY "Approved members can view members" ON ${table('members')} FOR SELECT
        USING (${table('user_has_clan_role')}(group_id, ${table('uid')}(), ARRAY['admin','officer','member']));
      GRANT USAGE ON SCHEMA "${schema}" TO "${role}";
      GRANT SELECT, INSERT ON ${table('members')} TO "${role}";
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "${schema}" TO "${role}";
    `);
    await client.query(`INSERT INTO ${table('group_members')} VALUES ($1,$2,'trial')`, [group, account]);
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [account]);
    const insert = (groupId = group) => client.query(
      `INSERT INTO ${table('members')} VALUES ($1,$2,$3,'Fixture character','123456789012345678') RETURNING id, user_id`,
      [randomUUID(), groupId, account],
    );
    await client.query(`SET LOCAL ROLE "${role}"`);
    await client.query('SAVEPOINT before_fix');
    await assert.rejects(insert(), /row-level security/);
    await client.query('ROLLBACK TO SAVEPOINT before_fix');
    await client.query('RESET ROLE');
    await client.query(sql);

    for (const membershipRole of ['admin', 'officer', 'member', 'trial']) {
      await client.query(`UPDATE ${table('group_members')} SET role=$1`, [membershipRole]);
      await client.query(`SET LOCAL ROLE "${role}"`);
      assert.equal((await insert()).rows[0].user_id, account);
      assert.ok((await client.query(`SELECT id FROM ${table('members')}`)).rowCount);
      await client.query('SAVEPOINT wrong_group');
      await assert.rejects(insert(unrelatedGroup), /row-level security/);
      await client.query('ROLLBACK TO SAVEPOINT wrong_group');
      await client.query('RESET ROLE');
    }
    await client.query(`UPDATE ${table('group_members')} SET role='pending'`);
    await client.query(`SET LOCAL ROLE "${role}"`);
    assert.equal((await client.query(`SELECT id FROM ${table('members')}`)).rowCount, 0);
    await client.query('SAVEPOINT pending');
    await assert.rejects(insert(), /row-level security/);
    await client.query('ROLLBACK TO SAVEPOINT pending');
    await client.query('RESET ROLE');
    await client.query(`UPDATE ${table('group_members')} SET role='trial'`);
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [randomUUID()]);
    await client.query(`SET LOCAL ROLE "${role}"`);
    assert.equal((await client.query(`SELECT id FROM ${table('members')}`)).rowCount, 0);
    await client.query('SAVEPOINT outsider');
    await assert.rejects(insert(), /row-level security/);
    await client.query('ROLLBACK TO SAVEPOINT outsider');
    await client.query("SELECT set_config('test.discord_id', '123456789012345678', true)");
    assert.ok((await client.query(`SELECT id FROM ${table('members')}`)).rowCount, 'Existing Discord fallback includes Trial');
    await client.query('RESET ROLE');
    await client.query(`UPDATE ${table('group_members')} SET role='pending'`);
    await client.query(`SET LOCAL ROLE "${role}"`);
    assert.equal((await client.query(`SELECT id FROM ${table('members')}`)).rowCount, 0, 'Discord fallback must exclude pending users');
    await client.query('RESET ROLE');
    assert.deepEqual((await client.query(`SELECT filename FROM ${table('migration_history')}`)).rows,
      [{ filename: '018_trial_character_visibility.sql' }]);
  } finally {
    try { await client.query('ROLLBACK'); } finally { await client.end(); }
  }
});
