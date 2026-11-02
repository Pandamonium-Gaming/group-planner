# GitHub Copilot Instructions for Group Planner

## Critical Rules - Always Follow

### 1. CHANGELOG.md Updates (REQUIRED)

**When making ANY significant code changes, you MUST update CHANGELOG.md:**

* **What requires changelog updates:**
  * Any changes to `src/`, `components/`, `lib/`, `app/`, `pages/`
  * Database migrations in `supabase/migrations/`
  * Changes to `public/` assets or locales
  * Modifications to `package.json`, `next.config.ts`, or build config

* **What does NOT require changelog updates:**
  * Documentation files (`*.md`)
  * Test files (`*.test.*`, `*.spec.*`)
  * Configuration files (eslint, jest, tsconfig, etc.)
  * GitHub workflow files (`.github/`)
  * Script utilities (`scripts/check-*`)

**CHANGELOG format:**

```markdown
## \[Unreleased]

### Added
* New features or capabilities

### Changed
* Changes to existing functionality

### Fixed
* Bug fixes

### Deprecated
* Soon-to-be removed features

### Removed
* Removed features

### Security
* Security-related changes
```

**Pre-commit hook will reject commits if:**

* Significant changes exist but CHANGELOG.md `[Unreleased]` section is empty
* Translation files are out of sync

### 2. Translation Sync (REQUIRED)

**All translation files must have identical keys:**

* `public/locales/en-GB.json` (English - primary)
* `public/locales/es.json` (Spanish)
* `public/locales/nl.json` (Dutch)

**When adding/removing translation keys:**

1. Update `en-GB.json` first with English text
2. Add corresponding keys to `es.json` with Spanish translation
3. Add corresponding keys to `nl.json` with Dutch translation
4. Run `yarn check:translations` to verify

**Pre-commit hook will reject commits if:**

* Translation files have mismatched keys

### 3. Database Safety (CRITICAL)

**Never perform simultaneous write operations to both prod and dev databases.**

This prevents data consistency issues, auth conflicts, and disaster recovery failures.

* **ALLOWED**: Dump prod → file (read-only), then restore file → dev (write)
* **ALLOWED**: Write to prod only, write to dev only (separate operations)
* **FORBIDDEN**: Direct sync prod → dev (simultaneous writes)
* **FORBIDDEN**: Tools that directly copy data between databases in one operation

**Pattern for any sync/backup/restore operations:**

```powershell
# Step 1: Read prod, write to local file (read-only on prod)
pg_dump $prodDbUrl --data-only | Out-File temp.sql

# Step 2: Read file, write to dev (safe file-based transfer)
psql $devDbUrl -f temp.sql
```

**Why this matters:**

* Auth systems can conflict if both databases modified simultaneously
* Disaster recovery/restore scenarios fail if both DB written at once
* RLS policies and user permissions can become inconsistent
* Transaction isolation breaks

**Scripts that follow this pattern:**

* ✅ `backup-prod-database.ps1` - dump only
* ✅ `backup-dev-database.ps1` - dump only
* ✅ `restore-prod-to-dev.ps1` - read file, write dev
* ✅ `sync-prod-to-dev-data.ps1` - dump prod, restore to dev separately

### 4. Pre-commit Compliance (MANDATORY)

**NEVER skip linting or pre-commit checks. Always fix violations instead.**

Using `--no-verify` or `--allow-empty` bypasses critical safety checks and creates tech debt.

**Pre-commit checks validate:**

* ✅ Markdown linting (markdownlint) - format issues
* ✅ Spelling (CSpell) - typos in docs
* ✅ Translation sync - all locale files have identical keys
* ✅ Changelog updates - required for significant code changes
* ✅ Copilot command compliance - Windows/Unix commands match OS

**If pre-commit fails:**

1. **Read the error message** - identifies exact issue
2. **Fix the violation** - correct code, markdown, spelling, etc.
3. **Re-run commit** - let hooks re-validate
4. **Repeat until pass** - all checks must pass before commit

**Common fixes:**

| Issue | Fix |
| --- | --- |
| Markdown lint error | Open file, fix formatting (typically spacing, heading style) |
| Spelling error | Add word to `cspell.json` if it's a valid domain term |
| Translation mismatch | Ensure all 3 locale files have identical keys |
| Empty `[Unreleased]` | Add entry to CHANGELOG.md under appropriate section |
| Unix command on Windows | Replace `head`, `tail`, `grep` with PowerShell equivalents (see table below) |

**PowerShell Command Equivalents (use ALWAYS on Windows):**

| Unix | PowerShell | Example |
| --- | --- | --- |
| `head -N file` | `Get-Content file \| Select-Object -First N` | `Get-Content log.txt \| Select-Object -First 20` |
| `tail -N file` | `Get-Content file \| Select-Object -Last N` | `Get-Content log.txt \| Select-Object -Last 5` |
| `grep pattern file` | `Select-String -Pattern pattern file` | `Select-String -Pattern "error" log.txt` |
| `cat file` | `Get-Content file` | `Get-Content package.json` |
| `wc -l file` | `(Get-Content file).Count` | `(Get-Content results.txt).Count` |
| `ls directory` | `Get-ChildItem directory` | `Get-ChildItem src/` |
| `rm file` | `Remove-Item file` | `Remove-Item temp.txt` |
| `cp src dst` | `Copy-Item src dst` | `Copy-Item file.js file.backup` |

### 5. Version Management

**Semantic Versioning (semver):**

* **patch** (0.0.X): Bug fixes, small changes
* **minor** (0.X.0): New features, backwards-compatible
* **major** (X.0.0): Breaking changes

**Version bump workflow:**

```bash
# After making changes and updating CHANGELOG.md:
yarn version:patch -- --commit   # Automatically commits and tags
# Then just: git push && git push --tags
```

**Manual workflow (if you have other uncommitted changes):**

```bash
yarn version:patch    # Updates files only
# Review changes, then:
git add package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push && git push --tags
```

## Development Workflow

### Making Changes

1. **Implement the change** in source code
2. **Update CHANGELOG.md** under `[Unreleased]` section
3. **Update translations** if adding new UI text
4. **Commit** - pre-commit hooks will validate
5. **Push** to trigger CI validation

### Creating a Release

1. Ensure CHANGELOG.md is up-to-date
2. Run `yarn version:patch -- --commit` (or minor/major)
3. Push: `git push && git push --tags`

**That's it! Three commands total, or just one if using aliases.**

## Automated Checks

### Pre-commit (Husky)

* ✅ Spelling (cspell on \*.md files)
* ✅ Markdown linting
* ✅ Translation sync
* ✅ Changelog updates

### CI Pipeline (GitHub Actions)

* ✅ Linting (ESLint)
* ✅ Translation sync
* ✅ Changelog updates
* ✅ Tests (Jest with coverage)
* ✅ Build verification

## File Structure Conventions

### Settings Organization

* **Group Settings** (`/[group]/settings`): Guild-wide settings
  * Recruitment (guild-wide)
  * Permissions
  * Games management
  * Member management
  * Discord webhooks (guild-wide)
  * Group icon

* **Game Settings** (`/[group]/[game]/settings`): Game-specific settings
  * Rank management (per game)
  * Discord webhooks (per game)
  * Per-game recruitment settings

### Multi-Game Architecture

* Check `docs/MULTI_GAME_ARCHITECTURE.md` for details
* Support for: Ashes of Creation, Star Citizen, Return of Reckoning
* Game-specific components in `src/games/[game]/`
* Shared components in `src/components/`

## Common Tasks

### Adding a New Translation Key

1. Add to `en-GB.json`: `"key": "English text"`
2. Add to `es.json`: `"key": "Spanish text"`
3. Add to `nl.json`: `"key": "Dutch text"`
4. Verify: `yarn check:translations`
5. Update CHANGELOG.md under `### Added`

### Adding a New Feature

1. Implement feature in appropriate directory

2. Add tests if applicable

3. Update CHANGELOG.md:

   ```markdown
   ### Added
   * Feature description with key details
   ```

4. Add translations if UI text is involved

5. Commit and let pre-commit hooks validate

### Fixing a Bug

1. Implement fix

2. Add test to prevent regression (if applicable)

3. Update CHANGELOG.md:

   ```markdown
   ### Fixed
   * Bug description and what was fixed
   ```

4. Commit

### Database Migrations

1. Create migration file in `supabase/migrations/`
2. Follow existing naming convention: `XXX_descriptive_name.sql`
3. Include migration in `migration_history` table recording
4. Update CHANGELOG.md under `### Added` or `### Changed`
5. Test migration locally before committing

## Testing

### Running Tests

```bash
yarn test             # Run all tests
yarn test:watch       # Watch mode
yarn test:coverage    # With coverage report
```

### Test Coverage

* Minimum 50% coverage threshold enforced
* See `TESTING.md` for comprehensive testing guide

## Quick Reference

```bash
# Validation
yarn check:translations      # Check translation sync
yarn check:changelog         # Check changelog updates

# Version Management
yarn version:patch           # Bump patch version
yarn version:minor           # Bump minor version
yarn version:major           # Bump major version

# Development
yarn dev                     # Start dev server
yarn build                   # Production build
yarn lint                    # Run linter
yarn test                    # Run tests

# Database Operations
.\scripts\backup-prod-database.ps1       # Backup prod DB (read-only)
.\scripts\backup-dev-database.ps1        # Backup dev DB (read-only)
.\scripts\restore-prod-to-dev.ps1        # Restore prod backup to dev
.\scripts\sync-prod-to-dev-data.ps1      # Sync prod data to dev (file-based)

# Scripts
yarn update-ships            # Update Star Citizen ship data
```

## Notes for AI Assistant

* **Always ask** if unsure about version bump type (patch/minor/major)
* **Always update CHANGELOG.md** when making code changes
* **Always sync translations** when adding UI text
* **NEVER do direct database syncs** - always use dump→restore pattern
* **Reference existing patterns** in codebase before creating new approaches
* **Follow TypeScript types** - check `src/lib/types.ts` for interfaces
* **Use existing hooks** - check `src/hooks/` before creating new ones
* **Check documentation** - `docs/` folder has detailed guides
