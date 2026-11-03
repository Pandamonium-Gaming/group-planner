import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from 'pg';

const connectionString = process.env.GP_MIGRATION_TEST_DATABASE_URL;

test('migration 014 preserves UUID/null guest classes and round-trips game registry IDs', {
  skip: !connectionString,
}, async () => {
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  const schema = `guest_class_test_${randomUUID().replaceAll('-', '')}`;
  const migration = await readFile(new URL('../../supabase/migrations/014_guest_rsvp_class_registry_ids.sql', import.meta.url), 'utf8');
  // Run the exact migration against an isolated schema without committing the test transaction.
  assert.match(migration, /^BEGIN;\s/);
  assert.match(migration, /COMMIT;\s*$/);
  const sql = migration.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '').replaceAll('public.', `"${schema}".`);
  const legacyClass = randomUUID();
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`
      CREATE TABLE "${schema}".events (id uuid PRIMARY KEY, game_slug text NOT NULL);
      CREATE TABLE "${schema}".guest_event_rsvps (
        id uuid PRIMARY KEY, event_id uuid REFERENCES "${schema}".events(id),
        guest_name text NOT NULL, class_id uuid, status text NOT NULL
      );
      CREATE TABLE "${schema}".migration_history (filename text PRIMARY KEY);
    `);
    const eventId = randomUUID();
    await client.query(`INSERT INTO "${schema}".events VALUES ($1, 'wowforever')`, [eventId]);
    await client.query(`INSERT INTO "${schema}".guest_event_rsvps VALUES
      ($1, $2, 'Legacy guest', $3, 'attending'), ($4, $2, 'No class', null, 'maybe')`,
    [randomUUID(), eventId, legacyClass, randomUUID()]);
    await client.query(sql);

    const { rows: column } = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema=$1 AND table_name='guest_event_rsvps' AND column_name='class_id'`, [schema]);
    assert.equal(column[0].data_type, 'text');
    const { rows: legacy } = await client.query(`SELECT guest_name, class_id FROM "${schema}".guest_event_rsvps ORDER BY guest_name`);
    assert.deepEqual(legacy, [
      { guest_name: 'Legacy guest', class_id: legacyClass },
      { guest_name: 'No class', class_id: null },
    ]);

    for (const [game, classId, status] of [
      ['wowforever', 'mage', 'attending'], ['wowforever', 'priest', 'maybe'],
      ['ror', 'ironbreaker', 'attending'], ['aoc', 'mage', 'maybe'],
    ]) {
      const event = randomUUID();
      const guest = randomUUID();
      await client.query(`INSERT INTO "${schema}".events VALUES ($1, $2)`, [event, game]);
      await client.query(`INSERT INTO "${schema}".guest_event_rsvps VALUES ($1, $2, 'Registry guest', $3, $4)`,
        [guest, event, classId, status]);
      const { rows } = await client.query(`
        SELECT e.game_slug, g.class_id, g.status
        FROM "${schema}".guest_event_rsvps g JOIN "${schema}".events e ON e.id=g.event_id WHERE g.id=$1`, [guest]);
      assert.deepEqual(rows, [{ game_slug: game, class_id: classId, status }]);
    }
    const { rows: history } = await client.query(`SELECT filename FROM "${schema}".migration_history`);
    assert.deepEqual(history, [{ filename: '014_guest_rsvp_class_registry_ids.sql' }]);
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      await client.end();
    }
  }
});
