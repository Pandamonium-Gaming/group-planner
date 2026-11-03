import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import PostgresAdapter from '@auth/pg-adapter';
import { Pool } from 'pg';
import { getPrisma } from '../../src/server/data/prisma.ts';
import { resolveStandaloneDiscordUser } from '../../src/server/users/discord-identity.ts';
import { findUserProfileById } from '../../src/server/users/user-profile-repository.ts';
import { getGroupPermissionsSnapshot } from '../../src/server/permissions/group-permissions-service.ts';

const connectionString = process.env.GP_STANDALONE_TEST_DATABASE_URL;

test('standalone identity, permissions and database session revocation work without Supabase', {
  skip: !connectionString,
}, async () => {
  if (!connectionString) throw new Error('Standalone test database is required');
  const url = new URL(connectionString);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.equal(url.pathname, '/group_planner_rehearsal_validation');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  process.env.APP_DATABASE_URL = connectionString;
  process.env.APP_DATA_BACKEND = 'postgres';
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const database = getPrisma();
  const pool = new Pool({ connectionString, options: '-c search_path=authjs,pg_catalog' });
  const adapter = PostgresAdapter(pool);
  if (!adapter.createUser || !adapter.createSession || !adapter.getSessionAndUser || !adapter.deleteSession) {
    throw new Error('Database adapter session methods missing');
  }
  const discordId = BigInt(`0x${randomBytes(8).toString('hex')}`).toString().padStart(20, '0');
  const newDiscordId = BigInt(`0x${randomBytes(8).toString('hex')}`).toString().padStart(20, '0');
  const originalId = randomUUID();
  const groupId = randomUUID();
  let authUserId: string | undefined;
  try {
    await database.public_users.create({
      data: { id: originalId, discord_id: discordId, discord_username: 'Old name', display_name: 'Custom name', timezone: 'Europe/London' },
    });
    await database.groups.create({
      data: { id: groupId, name: 'Standalone validation', slug: `validation-${groupId}`, created_by: originalId },
    });
    await database.group_members.create({ data: { group_id: groupId, user_id: originalId, role: 'member' } });
    assert.equal(await resolveStandaloneDiscordUser(discordId, { displayName: 'Current Discord name', avatarUrl: null }), originalId);
    const profile = await findUserProfileById(originalId);
    assert.equal(profile?.display_name, 'Custom name');
    assert.equal(profile?.discord_username, 'Current Discord name');
    assert.equal(profile?.timezone, 'Europe/London');
    const permissions = await getGroupPermissionsSnapshot(groupId, [originalId]);
    assert.equal(permissions?.role, 'member');
    assert.ok(permissions?.permissions.includes('events_create'));
    await database.group_permission_overrides.create({
      data: { group_id: groupId, role: 'member', events_create: false },
    });
    assert.equal((await getGroupPermissionsSnapshot(groupId, [originalId]))?.permissions.includes('events_create'), false);
    assert.equal(await getGroupPermissionsSnapshot(groupId, [randomUUID()]), null);

    const newIds = await Promise.all(Array.from({ length: 4 }, () =>
      resolveStandaloneDiscordUser(newDiscordId, { displayName: 'New account', avatarUrl: null })));
    assert.equal(new Set(newIds).size, 1, 'Concurrent sign-ins must map to exactly one application user');
    assert.equal(await database.public_users.count({ where: { discord_id: newDiscordId } }), 1);
    assert.equal(await database.admin_discord_notifications.count({ where: { kind: 'account_registered', subject_id: newIds[0] } }), 1);
    await assert.rejects(resolveStandaloneDiscordUser('invalid-provider-id', { displayName: null, avatarUrl: null }));

    const authUser = await adapter.createUser({
      id: randomUUID(), email: `standalone-${randomUUID()}@example.test`, name: 'Validation', emailVerified: null, image: null,
    });
    authUserId = authUser.id;
    assert.notEqual(authUser.id, originalId, 'Auth and application identities must be separate');
    const token = randomUUID();
    await adapter.createSession({ sessionToken: token, userId: authUser.id, expires: new Date(Date.now() + 60000) });
    const active = await adapter.getSessionAndUser(token);
    assert.equal(active?.user.id, authUser.id);
    await adapter.deleteSession(token);
    assert.equal(await adapter.getSessionAndUser(token), null, 'Revocation must invalidate the next session lookup');
    const privateAccess = await database.$queryRaw<{ allowed: boolean }[]>`
      SELECT has_function_privilege('authenticated','public.save_site_admin_discord_webhook(text,uuid)','EXECUTE') AS allowed
    `;
    assert.equal(privateAccess[0].allowed, false);
  } finally {
    try {
      await database.groups.deleteMany({ where: { id: groupId } });
      await database.public_users.deleteMany({ where: { discord_id: { in: [discordId, newDiscordId] } } });
      if (authUserId) await pool.query('DELETE FROM authjs.users WHERE id=$1', [authUserId]);
    } finally {
      await pool.end();
      await database.$disconnect();
    }
  }
});
