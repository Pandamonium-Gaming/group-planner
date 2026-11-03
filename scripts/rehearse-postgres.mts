import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { Client } from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type TableDigest = { count: number; digest: string };
type Manifest = Record<string, TableDigest>;

export function validateRehearsalTarget(targetValue: string) {
  const target = new URL(targetValue);
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('Expected PostgreSQL URLs');
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
    || target.pathname !== '/group_planner_rehearsal' || target.search || target.hash) {
    throw new Error('Target must be the loopback group_planner_rehearsal database');
  }
  return target;
}

export function validateRehearsalUrls(sourceValue: string, targetValue: string) {
  const source = new URL(sourceValue);
  const target = validateRehearsalTarget(targetValue);
  if (!['postgres:', 'postgresql:'].includes(source.protocol)) throw new Error('Expected PostgreSQL source URL');
  const developmentProject = 'uphtjyfuuhhekvwtzgon';
  const directDevelopment = source.hostname === `db.${developmentProject}.supabase.co`;
  const pooledDevelopment = source.hostname.endsWith('.pooler.supabase.com')
    && decodeURIComponent(source.username) === `postgres.${developmentProject}`;
  if ((!directDevelopment && !pooledDevelopment) || source.hash
    || [...source.searchParams.keys()].some(key => key !== 'sslmode')) {
    throw new Error('Rehearsal source must be the development Supabase project');
  }
  return { source, target };
}

function commandEnvironment(url: URL, readOnly: boolean): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: readOnly ? 'require' : 'disable',
    PGOPTIONS: readOnly ? '-c default_transaction_read_only=on -c statement_timeout=120000'
      : '-c statement_timeout=120000',
  };
}

function command(name: string, args: string[], url: URL, readOnly: boolean) {
  const result = spawnSync(name, args, {
    env: commandEnvironment(url, readOnly), encoding: 'utf8', windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    // Dump/restore diagnostics can contain rows or credentials: keep them local.
    throw new Error(`${name} failed; exit ${result.status ?? 'unavailable'}. Verify PostgreSQL client tools and database access.`);
  }
  return result.stdout;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function manifest(client: Client): Promise<Manifest> {
  const tables = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const result: Manifest = {};
  for (const { tablename } of tables.rows) {
    const table = `public.${quoteIdentifier(tablename)}`;
    const { rows } = await client.query<TableDigest>(`
      SELECT count(*)::integer AS count,
        md5(coalesce(string_agg(row_digest, '' ORDER BY row_digest), '')) AS digest
      FROM (SELECT md5(to_jsonb(t)::text) AS row_digest FROM ${table} t) digests
    `);
    result[tablename] = rows[0];
  }
  return result;
}

export function assertManifestsMatch(source: Manifest, target: Manifest) {
  assert.deepEqual(Object.keys(target).sort(), Object.keys(source).sort(), 'Table inventory differs');
  for (const name of Object.keys(source)) {
    assert.deepEqual(target[name], source[name], `Row count/content mismatch in ${name}`);
  }
}

async function run() {
  const { source, target } = validateRehearsalUrls(
    process.env.DATABASE_URL || '', process.env.REHEARSAL_DATABASE_URL || '',
  );
  const sourceClient = new Client({ connectionString: source.href, connectionTimeoutMillis: 15000 });
  const targetClient = new Client({ connectionString: target.href, connectionTimeoutMillis: 15000 });
  const directory = resolve(root, '.backups', `rehearsal-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`);
  const archive = resolve(directory, 'development-public.dump');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let expected: Manifest;
  // Finish all source access before opening a writable target connection.
  await sourceClient.connect();
  try {
    await sourceClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await sourceClient.query("SET LOCAL statement_timeout='120s'");
    const snapshot = (await sourceClient.query<{ snapshot: string }>('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
    expected = await manifest(sourceClient);
    command('pg_dump', [
      '--format=custom', '--schema=public', '--no-owner', '--no-acl',
      `--snapshot=${snapshot}`, '--file', archive,
    ], source, true);
    await sourceClient.query('COMMIT');
  } finally { await sourceClient.end(); }
  await writeFile(resolve(directory, 'source-manifest.json'), JSON.stringify(expected, null, 2), { mode: 0o600 });
  console.log(`Read-only development dump completed: ${Object.keys(expected).length} tables. Source disconnected.`);

  await targetClient.connect();
  try {
    const { rows } = await targetClient.query<{ count: number }>(
      "SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%' AND c.relkind IN ('r','p','v','m','S')",
    );
    if (rows[0].count !== 0) throw new Error('Target is not empty; refusing to overwrite an existing rehearsal');
    const existingAuth = await targetClient.query("SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','authjs')");
    if (existingAuth.rowCount) throw new Error('Target already has auth schemas; refusing to overwrite');
    await targetClient.query('BEGIN');
    try {
      await targetClient.query(await readFile(resolve(root, 'docker', 'rehearsal', 'bootstrap.sql'), 'utf8'));
      // The exact empty, local rehearsal schema is replaced by the archive.
      await targetClient.query('DROP SCHEMA public');
      await targetClient.query('COMMIT');
    } catch (error) {
      await targetClient.query('ROLLBACK');
      throw error;
    }
    // pg_restore loads data before triggers are created, preventing alert/backfill side effects.
    command('pg_restore', [
      '--single-transaction', '--exit-on-error', '--no-owner', '--no-acl',
      '--dbname', target.pathname.slice(1), archive,
    ], target, false);
    await targetClient.query(await readFile(resolve(root, 'docker', 'rehearsal', 'harden.sql'), 'utf8'));
    const actual = await manifest(targetClient);
    assertManifestsMatch(expected, actual);
    const invalid = await targetClient.query("SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND NOT c.convalidated");
    if (invalid.rowCount) throw new Error('Unvalidated constraints remain in the restored target');
    await writeFile(resolve(directory, 'target-manifest.json'), JSON.stringify(actual, null, 2), { mode: 0o600 });
    console.log(`Standalone restore verified: ${Object.keys(actual).length} tables, exact row counts and content digests; constraints validated.`);
    console.log('No scheduler, webhook worker or production cutover was started.');
    console.log(`Local backup and validation manifests: ${directory}`);
  } finally { await targetClient.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch(error => {
    console.error(error instanceof Error ? error.message : 'PostgreSQL rehearsal failed');
    process.exitCode = 1;
  });
}
