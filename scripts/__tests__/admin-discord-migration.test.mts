import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from 'pg';

const connectionString = process.env.GP_MIGRATION_TEST_DATABASE_URL;

test('admin queue captures committed changes, protects secrets, survives deletion and claims safely', {
  skip: !connectionString,
}, async () => {
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  const schema = `admin_discord_test_${randomUUID().replaceAll('-', '')}`;
  const source = await readFile(new URL('../../supabase/migrations/015_admin_discord_notifications.sql', import.meta.url), 'utf8');
  assert.match(source, /^BEGIN;\s/);
  assert.match(source, /COMMIT;\s*$/);
  const sql = source.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '').replaceAll('public.', `"${schema}".`);
  const table = (name: string) => `"${schema}"."${name}"`;
  const admin = randomUUID();
  const member = randomUUID();
  const group = randomUUID();
  const secretUrl = 'https://discord.com/api/webhooks/123/private-test-token';
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`
      CREATE TABLE ${table('users')} (id uuid PRIMARY KEY, display_name text, discord_username text);
      CREATE TABLE ${table('groups')} (id uuid PRIMARY KEY, name text, created_by uuid, group_webhook_url text, notify_on_events boolean);
      CREATE TABLE ${table('group_members')} (
        id uuid PRIMARY KEY, group_id uuid REFERENCES ${table('groups')}(id) ON DELETE CASCADE,
        user_id uuid REFERENCES ${table('users')}(id) ON DELETE CASCADE, role text, guild_rank text
      );
      CREATE TABLE ${table('group_permission_overrides')} (
        id uuid PRIMARY KEY, group_id uuid REFERENCES ${table('groups')}(id) ON DELETE CASCADE,
        role text, events_create boolean, updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE ${table('migration_history')} (filename text PRIMARY KEY);
    `);
    await client.query(sql);
    const roleMigration = await readFile(new URL('../../supabase/migrations/016_admin_notification_role_mentions.sql', import.meta.url), 'utf8');
    await client.query(roleMigration.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '').replaceAll('public.', `"${schema}".`));
    const categoryMigration = await readFile(new URL('../../supabase/migrations/017_admin_notification_categories.sql', import.meta.url), 'utf8');
    await client.query(categoryMigration.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '').replaceAll('public.', `"${schema}".`));
    const gameMigration = await readFile(new URL('../../supabase/migrations/018_admin_notification_game_deleted.sql', import.meta.url), 'utf8');
    assert.match(gameMigration, /^BEGIN;\s/);
    assert.match(gameMigration, /COMMIT;\s*$/);
    await client.query('SAVEPOINT before_game_deleted');
    await assert.rejects(client.query(`INSERT INTO ${table('admin_discord_notifications')}(kind,destination) VALUES ('game_deleted','group')`), /check constraint/);
    await client.query('ROLLBACK TO SAVEPOINT before_game_deleted');
    await client.query(gameMigration.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '').replaceAll('public.', `"${schema}".`));
    const suppressMigration = await readFile(new URL('../../supabase/migrations/019_suppress_alert_flag.sql', import.meta.url), 'utf8');
    assert.match(suppressMigration, /^BEGIN;\s/);
    assert.match(suppressMigration, /COMMIT;\s*$/);
    await client.query(suppressMigration.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '').replaceAll('public.', `"${schema}".`));
    const rows = async () => (await client.query(`SELECT * FROM ${table('admin_discord_notifications')} ORDER BY created_at, id`)).rows;
    await client.query(`INSERT INTO ${table('users')} VALUES ($1,'Admin','admin'),($2,'Member','member')`, [admin, member]);
    assert.equal((await rows()).filter(row => row.kind === 'account_registered').length, 2);
    await client.query(`UPDATE ${table('users')} SET display_name='Renamed' WHERE id=$1`, [member]);
    assert.equal((await rows()).length, 2, 'Profile refresh must not count as a new account');
    await client.query(`INSERT INTO ${table('groups')} VALUES ($1,'Test Guild',$2,null,true)`, [group, admin]);
    await client.query(`INSERT INTO ${table('group_members')} VALUES ($1,$2,$3,'admin',null)`, [randomUUID(), group, admin]);
    await client.query(`SELECT ${table('save_group_admin_discord')}($1,$2,$3)`, [group, secretUrl, admin]);
    const configured = await rows();
    assert.equal(configured.filter(row => row.kind === 'webhook_changed').length, 1);
    const destination = configured.find(row => row.kind === 'webhook_changed').destination_id;
    assert.ok(destination);
    await client.query(`SELECT ${table('save_group_admin_discord')}($1,$2,$3)`, [group, secretUrl, admin]);
    assert.equal((await rows()).length, configured.length, 'Same saved URL must not generate a duplicate alert');
    await client.query('SAVEPOINT denied');
    await assert.rejects(client.query(`SELECT ${table('save_group_admin_discord')}($1,$2,$3)`, [group, secretUrl, member]), /Administrator access required/);
    await client.query('ROLLBACK TO SAVEPOINT denied');
    await client.query('SAVEPOINT rollback_event');
    await client.query(`INSERT INTO ${table('group_members')} VALUES ($1,$2,$3,'member',null)`, [randomUUID(), group, member]);
    await client.query('ROLLBACK TO SAVEPOINT rollback_event');
    assert.equal((await rows()).length, configured.length, 'Rolled-back changes must not notify');
    const membership = randomUUID();
    await client.query(`INSERT INTO ${table('group_members')} VALUES ($1,$2,$3,'pending',null)`, [membership, group, member]);
    assert.equal((await rows()).filter(row => row.kind === 'member_requested').length, 1);
    await client.query(`UPDATE ${table('group_members')} SET role='member' WHERE id=$1`, [membership]);
    assert.equal((await rows()).filter(row => row.kind === 'member_joined' && row.subject_id === member).length, 1);
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [admin]);
    await client.query(`UPDATE ${table('group_members')} SET role='officer' WHERE id=$1`, [membership]);
    const roleChange = (await rows()).find(row => row.kind === 'role_changed');
    assert.deepEqual(roleChange.changes, { role: { before: 'member', after: 'officer' } });
    assert.equal(roleChange.actor_id, admin);
    const count = (await rows()).length;
    await client.query(`UPDATE ${table('group_members')} SET guild_rank='Veteran' WHERE id=$1`, [membership]);
    assert.equal((await rows()).length, count, 'Unrelated changes must not notify');
    const roleId = '123456789012345678';
    await client.query(`SELECT ${table('save_group_admin_discord_roles')}($1,$2,$3)`,
      [group, JSON.stringify({ role_changed: roleId }), admin]);
    await client.query(`UPDATE ${table('group_members')} SET role='member' WHERE id=$1`, [membership]);
    assert.ok((await rows()).some(row => row.kind === 'role_changed' && row.mention_role_id === roleId));
    assert.equal(roleChange.mention_role_id, null, 'Existing queued events must not gain a mention retroactively');
    await client.query(`SELECT ${table('save_group_admin_discord_roles')}($1,'{}',$2)`, [group, admin]);
    assert.ok((await rows()).some(row => row.mention_role_id === roleId), 'Clearing config must preserve queued mention snapshot');
    for (const invalid of [{ role_changed: '@everyone' }, { unknown: roleId }, { role_changed: 123 }, []]) {
      await client.query('SAVEPOINT invalid_roles');
      await assert.rejects(client.query(`SELECT ${table('save_group_admin_discord_roles')}($1,$2,$3)`,
        [group, JSON.stringify(invalid), admin]), /Invalid role configuration/);
      await client.query('ROLLBACK TO SAVEPOINT invalid_roles');
    }
    await client.query('SAVEPOINT denied_roles');
    await assert.rejects(client.query(`SELECT ${table('save_group_admin_discord_roles')}($1,'{}',$2)`, [group, member]), /Administrator access required/);
    await client.query('ROLLBACK TO SAVEPOINT denied_roles');
    const permission = randomUUID();
    await client.query(`INSERT INTO ${table('group_permission_overrides')} VALUES ($1,$2,'officer',true,now())`, [permission, group]);
    await client.query(`UPDATE ${table('group_permission_overrides')} SET updated_at=now() WHERE id=$1`, [permission]);
    assert.equal((await rows()).filter(row => row.kind === 'permissions_changed').length, 1);
    await client.query(`UPDATE ${table('group_permission_overrides')} SET events_create=false WHERE id=$1`, [permission]);
    assert.ok((await rows()).some(row => row.kind === 'permissions_changed' && row.changes.events_create.before === true && row.changes.events_create.after === false));
    await client.query(`DELETE FROM ${table('group_permission_overrides')} WHERE id=$1`, [permission]);
    assert.ok((await rows()).some(row => row.kind === 'permissions_changed' && row.changes.events_create.before === false && row.changes.events_create.after === null));
    await client.query(`INSERT INTO ${table('group_permission_overrides')} VALUES ($1,$2,'officer',true,now())`, [permission, group]);
    await client.query(`UPDATE ${table('groups')} SET group_webhook_url=$1 WHERE id=$2`, [secretUrl, group]);
    await client.query(`DELETE FROM ${table('group_members')} WHERE id=$1`, [membership]);
    assert.equal((await rows()).filter(row => row.kind === 'member_left_or_removed').length, 1);
    await client.query(`INSERT INTO ${table('group_members')} VALUES ($1,$2,$3,'pending',null)`, [membership, group, member]);
    await client.query(`DELETE FROM ${table('group_members')} WHERE id=$1`, [membership]);
    assert.equal((await rows()).filter(row => row.kind === 'member_request_closed').length, 1);
    await client.query(`SELECT ${table('save_group_admin_discord')}($1,null,$2)`, [group, admin]);
    assert.ok((await rows()).some(row => row.kind === 'webhook_changed' && row.changes.admin_webhook?.after === false && row.destination_id === destination));
    await client.query(`SELECT ${table('save_group_admin_discord')}($1,$2,$3)`, [group, secretUrl, admin]);
    await client.query('SAVEPOINT category_checks');
    const pendingRole = (await rows()).find(row => row.kind === 'role_changed' && row.status === 'pending');
    assert.ok(pendingRole, 'Categories default to enabled');
    await client.query(`INSERT INTO ${table('admin_discord_notifications')}(kind,destination,group_id,changes) VALUES ('game_deleted','group',$1,'{"game":"Test Game"}')`, [group]);
    await client.query(`SELECT ${table('save_admin_discord_preferences')}($1,'{"game_deleted":true}','{}',$2)`, [group, admin]);
    const stored = async () => (await client.query(`SELECT categories, role_mentions FROM ${table('group_admin_discord')} WHERE group_id=$1`, [group])).rows[0];
    assert.equal((await stored()).categories.game_deleted, true, 'game_deleted category is stored');
    await client.query(`SELECT ${table('save_group_admin_discord_roles')}($1,$2,$3)`, [group, JSON.stringify({ game_deleted: roleId }), admin]);
    assert.equal((await stored()).role_mentions.game_deleted, roleId, 'game_deleted role mention is stored');
    await client.query(`SELECT ${table('save_admin_discord_preferences')}($1,$2,$3,$4)`,
      [group, JSON.stringify({ role_changed: false, webhook_changed: false }), JSON.stringify({ role_changed: roleId }), admin]);
    assert.equal((await rows()).find(row => row.id === pendingRole.id).status, 'skipped');
    assert.ok((await rows()).filter(row => row.destination === 'site').every(row => row.status === 'pending'), 'Group switches must not affect site alerts');
    await client.query(`INSERT INTO ${table('group_members')} VALUES ($1,$2,$3,'member',null)`, [membership, group, member]);
    await client.query(`UPDATE ${table('group_members')} SET role='officer' WHERE id=$1`, [membership]);
    const disabledRoles = (await rows()).filter(row => row.kind === 'role_changed');
    assert.ok(disabledRoles.every(row => row.status === 'skipped'));
    assert.ok(disabledRoles.some(row => row.mention_role_id === roleId), 'Disabled events retain mention snapshots and audit data');
    await client.query(`SELECT ${table('save_admin_discord_preferences')}($1,'{}','{}',$2)`, [group, admin]);
    assert.equal((await rows()).find(row => row.id === pendingRole.id).status, 'skipped', 'Re-enabling never replays old alerts');
    await client.query(`UPDATE ${table('group_members')} SET role='member' WHERE id=$1`, [membership]);
    assert.ok((await rows()).some(row => row.kind === 'role_changed' && row.status === 'pending'));
    await client.query(`SELECT ${table('save_admin_discord_preferences')}(null,'{"account_registered":false}','{}',$1)`, [admin]);
    assert.ok((await rows()).filter(row => row.kind === 'account_registered').every(row => row.status === 'skipped'));
    const newAccount = randomUUID();
    await client.query(`INSERT INTO ${table('users')} VALUES ($1,'New account','new')`, [newAccount]);
    assert.equal((await rows()).find(row => row.subject_id === newAccount).status, 'skipped');
    assert.ok((await rows()).some(row => row.destination === 'group' && row.kind === 'role_changed' && row.status === 'pending'), 'Site switches must not affect group alerts');
    await client.query(`SELECT ${table('save_site_admin_discord_webhook')}($1,$2)`, [secretUrl, admin]);
    const site = (await client.query(`SELECT * FROM ${table('site_admin_discord')}`)).rows[0];
    assert.equal(site.webhook_override, true);
    assert.ok(site.destination_id);
    assert.deepEqual(site.categories, { account_registered: false }, 'Webhook writes must preserve preferences');
    await client.query(`SELECT ${table('save_site_admin_discord_webhook')}(null,$1)`, [admin]);
    const disabledSite = (await client.query(`SELECT * FROM ${table('site_admin_discord')}`)).rows[0];
    assert.equal(disabledSite.webhook_override, true);
    assert.equal(disabledSite.destination_id, null, 'Explicit disabling must not restore environment fallback');
    for (const [categories, roles] of [[[], {}], [{ unknown: false }, {}], [{ role_changed: 'false' }, {}], [{}, { role_changed: '@everyone' }]]) {
      await client.query('SAVEPOINT invalid_preferences');
      await assert.rejects(client.query(`SELECT ${table('save_admin_discord_preferences')}($1,$2,$3,$4)`,
        [group, JSON.stringify(categories), JSON.stringify(roles), admin]), /Invalid preferences|Unknown notification category/);
      await client.query('ROLLBACK TO SAVEPOINT invalid_preferences');
    }
    await client.query('SAVEPOINT denied_preferences');
    await assert.rejects(client.query(`SELECT ${table('save_admin_discord_preferences')}($1,'{}','{}',$2)`, [group, member]), /Administrator access required/);
    await client.query('ROLLBACK TO SAVEPOINT denied_preferences');
    await client.query('ROLLBACK TO SAVEPOINT category_checks');
    const configAlerts = async () => (await rows()).filter(row => row.kind === 'webhook_changed' && row.changes?.group_webhook_url === 'changed').length;
    const configBefore = await configAlerts();
    await client.query(`UPDATE ${table('groups')} SET group_webhook_url='https://discord.com/api/webhooks/1/changed-a' WHERE id=$1`, [group]);
    assert.equal(await configAlerts(), configBefore + 1, 'Config change queues one alert');
    await client.query("SELECT set_config('app.suppress_admin_config_alert','on',true)");
    await client.query(`UPDATE ${table('groups')} SET group_webhook_url='https://discord.com/api/webhooks/1/changed-b' WHERE id=$1`, [group]);
    await client.query("SELECT set_config('app.suppress_admin_config_alert','',true)");
    assert.equal(await configAlerts(), configBefore + 1, 'Suppression flag queues no alert');
    // The flag only silences the per-column config alert; other capture branches are unaffected.
    await client.query('SAVEPOINT suppressed_role');
    const suppressedMembership = randomUUID();
    await client.query(`INSERT INTO ${table('group_members')} VALUES ($1,$2,$3,'member',null)`, [suppressedMembership, group, member]);
    const roleAlerts = async () => (await rows()).filter(row => row.kind === 'role_changed').length;
    const roleBefore = await roleAlerts();
    await client.query("SELECT set_config('app.suppress_admin_config_alert','on',true)");
    await client.query(`UPDATE ${table('group_members')} SET role='officer' WHERE id=$1`, [suppressedMembership]);
    await client.query("SELECT set_config('app.suppress_admin_config_alert','',true)");
    assert.equal(await roleAlerts(), roleBefore + 1, 'Suppression flag must not silence role_changed alerts');
    await client.query('ROLLBACK TO SAVEPOINT suppressed_role');
    const beforeDelete = (await rows()).length;
    await client.query(`DELETE FROM ${table('groups')} WHERE id=$1`, [group]);
    assert.equal((await rows()).length, beforeDelete + 2, 'Deletion must notify site and private group channel without cascade noise');
    const deletion = (await rows()).filter(row => row.kind === 'group_deleted');
    assert.deepEqual(deletion.map(row => row.destination).sort(), ['group', 'site']);
    assert.ok(deletion.every(row => row.group_name === 'Test Guild'));
    assert.ok(!JSON.stringify(await rows()).includes('private-test-token'), 'Audit rows must not contain webhook secrets');

    for (const role of ['anon', 'authenticated']) {
      for (const name of ['admin_discord_destinations', 'group_admin_discord', 'admin_discord_notifications', 'site_admin_discord']) {
        const { rows: access } = await client.query('SELECT has_table_privilege($1,$2,\'SELECT\') AS read, has_table_privilege($1,$2,\'INSERT,UPDATE,DELETE\') AS write', [role, `${schema}.${name}`]);
        assert.deepEqual(access[0], { read: false, write: false });
      }
      for (const signature of ['claim_admin_discord_notifications()', 'save_group_admin_discord(uuid,text,uuid)', 'capture_admin_discord_change()', 'save_group_admin_discord_roles(uuid,jsonb,uuid)', 'capture_admin_discord_mention()', 'save_admin_discord_preferences(uuid,jsonb,jsonb,uuid)', 'save_site_admin_discord_webhook(text,uuid)', 'filter_admin_discord_category()']) {
        const { rows: execute } = await client.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed', [role, `${schema}.${signature}`]);
        assert.equal(execute[0].allowed, false);
      }
    }
    const { rows: protectedTables } = await client.query(`
      SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname IN ('admin_discord_destinations','group_admin_discord','admin_discord_notifications','site_admin_discord')`, [schema]);
    assert.equal(protectedTables.length, 4);
    assert.ok(protectedTables.every(row => row.relrowsecurity === true));
    const first = (await client.query(`SELECT * FROM ${table('claim_admin_discord_notifications')}()`)).rows;
    const second = (await client.query(`SELECT * FROM ${table('claim_admin_discord_notifications')}()`)).rows;
    assert.equal(first.length, 5);
    assert.ok(first.every(row => row.status === 'processing' && row.attempts === 1));
    assert.ok(second.every(row => !first.some(prior => prior.id === row.id)), 'Repeated claims must not overlap');
    await client.query(`UPDATE ${table('admin_discord_notifications')} SET claimed_at=now()-interval '6 minutes' WHERE id=$1`, [first[0].id]);
    await client.query(`SELECT * FROM ${table('claim_admin_discord_notifications')}()`);
    const expired = (await rows()).find(row => row.id === first[0].id);
    assert.equal(expired.status, 'uncertain', 'Interrupted sends must not be blindly retried');
  } finally {
    try { await client.query('ROLLBACK'); } finally { await client.end(); }
  }
});
