import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { validateRehearsalTarget } from './rehearse-postgres.mts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function run() {
  const target = validateRehearsalTarget(process.env.REHEARSAL_DATABASE_URL || '');
  const client = new Client({ connectionString: target.href, connectionTimeoutMillis: 15000 });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname='group_planner_rehearsal_validation'");
    if (!existing.rowCount) await client.query('CREATE DATABASE group_planner_rehearsal_validation');
  } finally { await client.end(); }
  target.pathname = '/group_planner_rehearsal_validation';
  const environment = { ...process.env, APP_DATABASE_URL: target.href, GP_STANDALONE_TEST_DATABASE_URL: target.href };
  for (const args of [
    [resolve(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
    ['--import', 'tsx', '--test',
      resolve(root, 'scripts', '__tests__', 'rehearse-postgres.test.mts'),
      resolve(root, 'scripts', '__tests__', 'standalone-auth.test.mts')],
  ]) {
    const result = spawnSync(process.execPath, args, { cwd: root, env: environment, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error('Standalone validation failed');
  }
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : 'Standalone validation failed');
  process.exitCode = 1;
});
