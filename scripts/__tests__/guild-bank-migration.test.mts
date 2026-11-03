import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from 'pg';
import { createGameSchema } from './game-schema.mts';

const connectionString = process.env.GP_MIGRATION_TEST_DATABASE_URL;
const migrationName = '024_game_scoped_guild_banks.sql';
const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
type Context = {
  client: Client;
  t: (name: string) => string;
  group: string;
  user: string;
  bank: string;
  resource: string;
};

async function withSchema(run: (context: Context) => Promise<void>) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  const schema = `bank_test_${randomUUID().replaceAll('-', '')}`;
  const t = (name: string) => `"${schema}"."${name}"`;
  await client.connect();
  try {
    await client.query('BEGIN');
    await createGameSchema(client, schema);
    await client.query(`SET LOCAL search_path = "${schema}", public`);
    await client.query(`
      CREATE TYPE item_rarity AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary');
      CREATE TABLE ${t('siege_events')} (id uuid PRIMARY KEY);
    `);
    const baseline = await readFile(new URL('000_baseline.sql', migrationsDir), 'utf8');
    const start = baseline.indexOf('-- Resource category enum');
    const end = baseline.indexOf('ALTER TABLE guild_banks ENABLE ROW LEVEL SECURITY', start);
    assert.ok(start > 0 && end > start);
    await client.query(baseline.slice(start, end));

    const group = randomUUID();
    const user = randomUUID();
    await client.query(`INSERT INTO ${t('users')}(id, display_name) VALUES ($1, 'Bank admin')`, [user]);
    await client.query(`INSERT INTO ${t('groups')}(id, slug, name) VALUES ($1, $2, 'Bank group')`, [group, group]);
    await client.query(`INSERT INTO ${t('group_members')}(group_id, user_id, role) VALUES ($1, $2, 'admin')`, [group, user]);
    await client.query(`INSERT INTO ${t('group_games')}(group_id, game_slug, archived)
      VALUES ($1, 'aoc', false), ($1, 'wowforever', true)`, [group]);
    const bank = (await client.query(`INSERT INTO ${t('guild_banks')}(group_id, gold_balance)
      VALUES ($1, 1234) RETURNING id`, [group])).rows[0].id as string;
    const resource = (await client.query(`INSERT INTO ${t('resource_catalog')}(name, category)
      VALUES ('Iron Ore', 'raw_material') RETURNING id`)).rows[0].id as string;
    await client.query(`INSERT INTO ${t('bank_inventory')}(bank_id, resource_id, quantity) VALUES ($1, $2, 42)`, [bank, resource]);
    await client.query(`INSERT INTO ${t('bank_transactions')}(bank_id, resource_id, transaction_type, quantity)
      VALUES ($1, $2, 'deposit', 42)`, [bank, resource]);

    const migration = await readFile(new URL(migrationName, migrationsDir), 'utf8');
    await client.query(migration.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '').replaceAll('public.', `"${schema}".`));
    await client.query(`SET LOCAL search_path = ''`);
    await run({ client, t, group, user, bank, resource });
  } finally {
    try { await client.query('ROLLBACK'); } finally { await client.end(); }
  }
}

async function rejectsQuery(client: Client, sql: string, values: string[], pattern: RegExp) {
  await client.query('SAVEPOINT expected_rejection');
  try {
    await assert.rejects(client.query(sql, values), pattern);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
  }
}

test('preserves Ashes balances, inventory and history while creating independent WoW banks and catalogue entries',
  { skip: !connectionString }, () => withSchema(async ({ client, t, group, bank, resource }) => {
    const legacy = (await client.query(`SELECT game_slug, gold_balance FROM ${t('guild_banks')} WHERE id = $1`, [bank])).rows[0];
    assert.deepEqual(legacy, { game_slug: 'aoc', gold_balance: '1234' });
    assert.equal((await client.query(`SELECT game_slug FROM ${t('resource_catalog')} WHERE id = $1`, [resource])).rows[0].game_slug, 'aoc');
    assert.equal((await client.query(`SELECT quantity FROM ${t('bank_inventory')} WHERE bank_id = $1`, [bank])).rows[0].quantity, 42);
    assert.equal((await client.query(`SELECT quantity FROM ${t('bank_transactions')} WHERE bank_id = $1`, [bank])).rows[0].quantity, 42);
    assert.equal((await client.query(`SELECT count(*) FROM ${t('resource_catalog')} WHERE name = 'Iron Ore'`)).rows[0].count, '2');
    const wow = (await client.query(`INSERT INTO ${t('guild_banks')}(group_id, game_slug)
      VALUES ($1, 'wowforever') RETURNING id, gold_balance`, [group])).rows[0];
    assert.notEqual(wow.id, bank);
    assert.equal(wow.gold_balance, '0');
    await rejectsQuery(client, `INSERT INTO ${t('guild_banks')}(group_id, game_slug) VALUES ($1, 'wowforever')`,
      [group], /guild_banks_group_game_key/);
    const catalogue = (await client.query(`SELECT name FROM ${t('resource_catalog')} WHERE game_slug = 'wowforever'`)).rows.map(row => row.name);
    assert.ok(catalogue.includes('Runecloth'));
    assert.ok(catalogue.includes('Major Healing Potion'));
    assert.equal((await client.query(`SELECT count(*) FROM ${t('migration_history')} WHERE filename = $1`, [migrationName])).rows[0].count, '1');
  }));

test('rejects cross-game inventory, transactions and requests on insert and update, including parent relabelling',
  { skip: !connectionString }, () => withSchema(async ({ client, t, group, user, bank, resource }) => {
    const wowBank = (await client.query(`INSERT INTO ${t('guild_banks')}(group_id, game_slug)
      VALUES ($1, 'wowforever') RETURNING id`, [group])).rows[0].id as string;
    const wowResource = (await client.query(`SELECT id FROM ${t('resource_catalog')}
      WHERE game_slug = 'wowforever' AND name = 'Iron Ore'`)).rows[0].id as string;
    for (const [table, extraColumns, extraValues, args] of [
      ['bank_inventory', 'quantity', '1', []],
      ['bank_transactions', 'quantity, transaction_type', "1, 'deposit'", []],
      ['resource_requests', 'quantity, requested_by', '1, $3', [user]],
    ] as const) {
      for (const [bankId, resourceId] of [[bank, wowResource], [wowBank, resource]]) {
        await rejectsQuery(client, `INSERT INTO ${t(table)}(bank_id, resource_id, ${extraColumns})
          VALUES ($1, $2, ${extraValues})`, [bankId, resourceId, ...args], /BANK_RESOURCE_GAME_MISMATCH/);
      }
      await client.query(`INSERT INTO ${t(table)}(bank_id, resource_id, ${extraColumns})
        VALUES ($1, $2, ${extraValues})`, [wowBank, wowResource, ...args]);
      await rejectsQuery(client, `UPDATE ${t(table)} SET resource_id = $1 WHERE bank_id = $2`,
        [resource, wowBank], /BANK_RESOURCE_GAME_MISMATCH/);
    }
    await client.query(`INSERT INTO ${t('bank_transactions')}(bank_id, transaction_type, quantity, gold_amount)
      VALUES ($1, 'deposit', 0, 100)`, [wowBank]);
    await rejectsQuery(client, `UPDATE ${t('guild_banks')} SET game_slug = 'ror' WHERE id = $1`,
      [wowBank], /BANK_GAME_IMMUTABLE/);
    await rejectsQuery(client, `UPDATE ${t('resource_catalog')} SET game_slug = 'aoc' WHERE id = $1`,
      [wowResource], /BANK_GAME_IMMUTABLE/);
  }));

test('deleting WoW removes only its bank and dependent rows and prevents stale recreation',
  { skip: !connectionString }, () => withSchema(async ({ client, t, group, user, bank }) => {
    const wowBank = (await client.query(`INSERT INTO ${t('guild_banks')}(group_id, game_slug)
      VALUES ($1, 'wowforever') RETURNING id`, [group])).rows[0].id as string;
    const wowResource = (await client.query(`SELECT id FROM ${t('resource_catalog')}
      WHERE game_slug = 'wowforever' AND name = 'Runecloth'`)).rows[0].id as string;
    await client.query(`INSERT INTO ${t('bank_inventory')}(bank_id, resource_id, quantity) VALUES ($1, $2, 12)`, [wowBank, wowResource]);
    await client.query(`INSERT INTO ${t('bank_transactions')}(bank_id, resource_id, transaction_type, quantity)
      VALUES ($1, $2, 'deposit', 12)`, [wowBank, wowResource]);
    await client.query(`INSERT INTO ${t('resource_requests')}(bank_id, resource_id, requested_by, quantity)
      VALUES ($1, $2, $3, 2)`, [wowBank, wowResource, user]);
    await client.query(`SELECT ${t('delete_group_game')}($1, 'wowforever', 'WoW Forever', 'WoW Forever', $2)`, [group, user]);
    for (const table of ['bank_inventory', 'bank_transactions', 'resource_requests']) {
      assert.equal((await client.query(`SELECT count(*) FROM ${t(table)} WHERE bank_id = $1`, [wowBank])).rows[0].count, '0');
    }
    assert.equal((await client.query(`SELECT id FROM ${t('guild_banks')} WHERE group_id = $1`, [group])).rows[0].id, bank);
    assert.equal((await client.query(`SELECT quantity FROM ${t('bank_inventory')} WHERE bank_id = $1`, [bank])).rows[0].quantity, 42);
    await rejectsQuery(client, `INSERT INTO ${t('guild_banks')}(group_id, game_slug) VALUES ($1, 'wowforever')`,
      [group], /GAME_NOT_ENABLED/);
  }));
