#!/usr/bin/env node

/**
 * Version Bump Script
 * 
 * Bumps the version in package.json and updates CHANGELOG.md
 * Usage: yarn version:bump [patch|minor|major] [--commit]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_PATH = path.join(__dirname, '..', 'package.json');
const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');

// Parse arguments
const args = process.argv.slice(2);
const bumpType = args.filter(arg => !arg.startsWith('--'))[0] || 'patch'; // default to patch
const autoCommit = args.includes('--commit') || args.includes('-c');

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('❌ Invalid version bump type. Use: patch, minor, or major');
  console.error('   Options: --commit or -c to auto-commit and tag');
  process.exit(1);
}

/**
 * Bump version number based on semver
 */
function bumpVersion(currentVersion, type) {
  const parts = currentVersion. split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
    default:
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Update package.json version
 */
function updatePackageJson(newVersion) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  fs.writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + '\n');
  return oldVersion;
}

/**
 * Update CHANGELOG.md
 */
function updateChangelog(newVersion) {
  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const date = getCurrentDate();
  
  // Find and replace [Unreleased] header, inserting new version below it
  const unreleasedHeader = '## \\[Unreleased]';
  const newHeader = `## \\[Unreleased]\n\n## \\[${newVersion}] - ${date}`;
  
  const updatedChangelog = changelog.replace(unreleasedHeader, newHeader);
  
  fs.writeFileSync(CHANGELOG_PATH, updatedChangelog);
}

/**
 * Execute git commands to commit and tag
 */
function gitCommitAndTag(version) {
  try {
    console.log('\n📦 Staging changes...');
    execSync('git add package.json CHANGELOG.md', { stdio: 'inherit' });
    
    console.log(`📝 Committing version ${version}...`);
    execSync(`git commit --no-verify -m "chore: bump version to ${version}"`, { stdio: 'inherit' });
    
    console.log(`🏷️  Creating tag v${version}...`);
    execSync(`git tag -a v${version} -m "Release v${version}"`, { stdio: 'inherit' });
    
    console.log('\n✅ Version bump complete!');
    console.log('\n📤 To publish, run:');
    console.log('   git push && git push --tags');
    
    return true;
  } catch (error) {
    console.error('\n❌ Git operation failed:', error.message);
    console.error('You may need to commit and tag manually.');
    return false;
  }
}

/**
 * Check if there are uncommitted changes
 */
function hasUncommittedChanges() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    const otherChanges = status
      .split('\n')
      .filter(line => line.trim())
      .filter(line => !line.includes('package.json') && !line.includes('CHANGELOG.md'));
    return otherChanges.length > 0;
  } catch (error) {
    return false;
  }
}

// Main execution
console.log(`🔖 Bumping version (${bumpType})...`);

// Read current version
const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
const currentVersion = pkg.version;
const newVersion = bumpVersion(currentVersion, bumpType);

console.log(`   ${currentVersion} → ${newVersion}`);

// Check if CHANGELOG has unreleased content
const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
const hasUnreleased = changelog.indexOf('## \\[Unreleased]') >= 0;

if (!hasUnreleased) {
  console.error('❌ No [Unreleased] section found in CHANGELOG.md');
  process.exit(1);
}

// Update files
console.log('📝 Updating package.json...');
updatePackageJson(newVersion);

console.log('📝 Updating CHANGELOG.md...');
updateChangelog(newVersion);

console.log('\n✅ Version bumped successfully!');

// Handle git operations
if (autoCommit) {
  // Check for uncommitted changes first
  if (hasUncommittedChanges()) {
    console.warn('\n⚠️  Warning: You have other uncommitted changes besides package.json and CHANGELOG.md');
    console.log('Commit those first or use manual workflow.\n');
    process.exit(1);
  }
  
  gitCommitAndTag(newVersion);
} else {
  console.log('\n📋 Manual steps:');
  console.log('  1. Review the changes in package.json and CHANGELOG.md');
  console.log('  2. Run these commands:');
  console.log('');
  console.log('     git add package.json CHANGELOG.md');
  console.log(`     git commit -m "chore: bump version to ${newVersion}"`);
  console.log(`     git tag -a v${newVersion} -m "Release v${newVersion}"`);
  console.log('     git push && git push --tags');
  console.log('');
  console.log('💡 Or use --commit flag for automatic git operations:');
  console.log(`   yarn version:${bumpType} -- --commit`);
}
