import assert from 'node:assert/strict';
import test from 'node:test';
import { assertManifestsMatch, validateRehearsalUrls } from '../rehearse-postgres.mts';

const source = 'postgresql://postgres:placeholder@db.uphtjyfuuhhekvwtzgon.supabase.co/postgres';
const target = 'postgresql://postgres:placeholder@127.0.0.1:55439/group_planner_rehearsal';

test('allows only development to the isolated local rehearsal target', () => {
  assert.equal(validateRehearsalUrls(source, target).target.hostname, '127.0.0.1');
  for (const invalid of [
    target.replace('127.0.0.1', 'example.com'),
    target.replace('group_planner_rehearsal', 'postgres'),
    target.replace('postgresql:', 'https:'),
    `${target}?host=example.com`,
    `${target}?dbname=postgres`,
    `${target}#unexpected`,
  ]) assert.throws(() => validateRehearsalUrls(source, invalid));
  assert.throws(() => validateRehearsalUrls(source.replace('uphtjyfuuhhekvwtzgon', 'yrwgqjjwmsryhyvybyqe'), target));
  assert.throws(() => validateRehearsalUrls(`${source}?host=example.com`, target));
  const pooled = new URL(source);
  pooled.hostname = 'aws-0-eu-west-2.pooler.supabase.com';
  pooled.username = 'postgres.uphtjyfuuhhekvwtzgon';
  assert.doesNotThrow(() => validateRehearsalUrls(pooled.href, target));
  pooled.hostname = 'db.yrwgqjjwmsryhyvybyqe.supabase.co';
  assert.throws(() => validateRehearsalUrls(pooled.href, target));
});

test('verifies exact table inventory, counts and content rather than counts alone', () => {
  const manifest = { users: { count: 2, digest: 'original' } };
  assert.doesNotThrow(() => assertManifestsMatch(manifest, manifest));
  assert.throws(() => assertManifestsMatch(manifest, {}));
  assert.throws(() => assertManifestsMatch(manifest, { users: { count: 2, digest: 'changed' } }));
  assert.throws(() => assertManifestsMatch(manifest, { users: { count: 3, digest: 'original' } }));
});
