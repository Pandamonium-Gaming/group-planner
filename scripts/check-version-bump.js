#!/usr/bin/env node

/**
 * Check Version Bump Required
 * 
 * Ensures that PRs to main branch have a version bump (new tag or updated package.json version).
 * This prevents merging unreleased changes to main without proper versioning.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_PATH = path.join(__dirname, '..', 'package.json');

/**
 * Get the latest git tag
 */
function getLatestTag() {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch (error) {
    // No tags exist yet
    return null;
  }
}

/**
 * Get the current version from package.json
 */
function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  return pkg.version;
}

/**
 * Check if we're on a PR to main
 */
function isPRToMain() {
  const targetBranch = process.env.GITHUB_BASE_REF || '';
  return targetBranch === 'main';
}

// Main execution
if (!isPRToMain()) {
  console.log('ℹ️  Not a PR to main branch, skipping version bump check');
  process.exit(0);
}

const latestTag = getLatestTag();
const currentVersion = getCurrentVersion();

if (!latestTag) {
  console.log('⚠️  No git tags found. Creating first release...');
  if (currentVersion === '0.0.0' || currentVersion === '0.1.0') {
    console.error('❌ Please bump the version in package.json before merging to main');
    process.exit(1);
  }
  console.log(`✅ Version ${currentVersion} ready for tagging`);
  process.exit(0);
}

// Extract version from tag (remove 'v' prefix)
const tagVersion = latestTag.replace(/^v/, '');

console.log(`📌 Latest tag: ${latestTag} (${tagVersion})`);
console.log(`📦 Current package.json version: ${currentVersion}`);

if (tagVersion === currentVersion) {
  console.error('\n❌ VERSION BUMP REQUIRED!\n');
  console.error('You are trying to merge to main without bumping the version.');
  console.error(`Current version: ${currentVersion}`);
  console.error(`Latest tag: ${latestTag}\n`);
  console.error('Please run one of the following commands before merging:');
  console.error('  yarn version:patch -- --commit  (for bug fixes)');
  console.error('  yarn version:minor -- --commit  (for new features)');
  console.error('  yarn version:major -- --commit  (for breaking changes)\n');
  process.exit(1);
}

console.log(`✅ Version bumped: ${tagVersion} → ${currentVersion}`);
process.exit(0);
