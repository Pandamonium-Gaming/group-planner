#!/usr/bin/env node
/**
 * Validate Copilot command compliance with OS context
 * Runs as pre-commit hook to catch violations before commit
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RULES_FILE = path.join(__dirname, '..', '.copilot-rules.json');
const OS = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

let rules;
try {
  rules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'));
} catch (err) {
  console.error(`❌ Failed to load .copilot-rules.json: ${err.message}`);
  process.exit(1);
}

const osRules = rules.osCommandPolicy[OS];

if (!osRules) {
  console.error(`❌ No rules found for OS: ${OS}`);
  process.exit(1);
}

/**
 * Check if a command line violates Windows policy
 */
function checkCommandViolations(content, filename) {
  const violations = [];

  if (OS === 'Windows') {
    // Remove comments from content to avoid false positives
    const contentWithoutComments = content
      .split('\n')
      .map(line => {
        // Remove single-line comments
        const hashIndex = line.indexOf('#');
        const slashIndex = line.indexOf('//');
        let endIndex = line.length;
        
        if (hashIndex !== -1 && slashIndex !== -1) {
          endIndex = Math.min(hashIndex, slashIndex);
        } else if (hashIndex !== -1 || slashIndex !== -1) {
          endIndex = Math.max(hashIndex, slashIndex);
        }
        
        return line.substring(0, endIndex);
      })
      .join('\n');

    for (const blocked of osRules.blocked) {
      // Look for pipes to blocked commands: | head, | grep, etc
      // More strict: must be in actual command context, not just text
      const pattern = new RegExp(`npm[^&]*\\s+\\|\\s+${blocked}\\b`, 'gi');
      const matches = contentWithoutComments.matchAll(pattern);
      
      for (const match of matches) {
        violations.push({
          file: filename,
          command: match[0].trim(),
          violation: `Unix command '${blocked}' used on Windows`,
          fix: `Use PowerShell equivalent: Select-Object, Select-String, Get-ChildItem, etc.`
        });
      }
    }
  }

  return violations;
}

/**
 * Check CHANGELOG.md is updated
 */
function checkChangelogUpdate() {
  try {
    const diff = execSync('git diff --cached CHANGELOG.md', { encoding: 'utf-8' });
    
    // Check if [Unreleased] section has content
    if (diff.includes('## [Unreleased]')) {
      const afterUnreleased = diff.split('## [Unreleased]')[1];
      const beforeNextVersion = afterUnreleased?.split('## [')[0];
      
      // If only whitespace after [Unreleased], it's empty
      if (!beforeNextVersion || beforeNextVersion.trim().length < 20) {
        return {
          violation: 'CHANGELOG.md [Unreleased] section is empty',
          fix: 'Add changes under [Unreleased] section or use: yarn version:patch'
        };
      }
    }
  } catch (err) {
    // File may not exist or not be staged
  }
  return null;
}

/**
 * Check translations are synced
 */
function checkTranslationSync() {
  try {
    const diff = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    const transFiles = diff.split('\n').filter(f => f.includes('public/locales/'));
    
    if (transFiles.length > 0) {
      // If translations changed, check they're synced
      try {
        execSync('yarn check:translations', { stdio: 'pipe' });
      } catch (err) {
        return {
          violation: 'Translation files are out of sync',
          fix: 'Run: yarn check:translations'
        };
      }
    }
  } catch (err) {
    // Silently continue
  }
  return null;
}

/**
 * Main validation
 */
function validate() {
  let violations = [];
  let warnings = [];

  // Check staged files for command violations
  try {
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf-8' }).split('\n').filter(f => f);
    
    for (const file of stagedFiles) {
      if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
        try {
          const content = execSync(`git show :${file}`, { encoding: 'utf-8' });
          const fileViolations = checkCommandViolations(content, file);
          violations = violations.concat(fileViolations);
        } catch (err) {
          // File may be new or have read issues
        }
      }
    }
  } catch (err) {
    // Silently continue
  }

  // Check CHANGELOG
  const changelogViolation = checkChangelogUpdate();
  if (changelogViolation) warnings.push(changelogViolation);

  // Check translations
  const translationViolation = checkTranslationSync();
  if (translationViolation) violations.push(translationViolation);

  // Report violations
  if (violations.length > 0) {
    console.error('\n❌ BLOCKING VIOLATIONS FOUND:\n');
    violations.forEach((v, i) => {
      console.error(`${i + 1}. ${v.violation}`);
      if (v.file) console.error(`   File: ${v.file}`);
      if (v.command) console.error(`   Found: ${v.command}`);
      console.error(`   Fix: ${v.fix}\n`);
    });
    process.exit(1);
  }

  // Report warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  WARNINGS:\n');
    warnings.forEach((w, i) => {
      console.warn(`${i + 1}. ${w.violation}`);
      console.warn(`   Fix: ${w.fix}\n`);
    });
    console.warn('These will fail in CI. Consider fixing them.\n');
  }

  if (violations.length === 0 && warnings.length === 0) {
    console.log(`✅ Copilot compliance check passed (OS: ${OS})`);
  }

  return violations.length === 0;
}

if (require.main === module) {
  const success = validate();
  process.exit(success ? 0 : 1);
}

module.exports = { validate, checkCommandViolations, checkChangelogUpdate, checkTranslationSync };
