# Star Citizen Subscriber Ship Updates

## Overview

Star Citizen subscriber ships are granted monthly to active subscribers based on
their tier. This document explains how to monitor for new promotions and update
the system.

## Automated Update Process

**Since March 2026**, subscriber ship updates are **partially automated**:

### How It Works

1. **Automatic**: A scheduled GitHub Action runs on the **1st of each month at 10 AM UTC**
   * Fetches the official RSI comm-link for subscriber promotions
   * Attempts to extract ship data automatically
   * Creates a **Pull Request** if successful with the new ships

2. **Fallback**: If automated fetching fails
   * Creates a **GitHub Issue** reminder to manually update
   * Provides links and instructions for manual extraction
   * Assigns to maintainers for review

### For Reviewers

When a PR is created by the automation:

1. ✅ Review the extracted ships against [RSI's official promotion](https://robertsspaceindustries.com/comm-link/transmission/)
2. ✅ Verify ship IDs are correct (match database)
3. ✅ Confirm insurance durations (12m Centurion, 24m Imperator)
4. ✅ Merge if accurate, or request changes

**If an issue is created instead**, follow the [Manual Update](#manual-update-when-automation-doesnt-work) steps below.

### Parser Regression Tests

The parser uses the ship database for IDs and preserves explicit Centurion and
Imperator tier selections. Run its offline regression tests before changing the
extraction logic (PowerShell):

```powershell
node --import tsx --test scripts\__tests__\fetch-subscriber-ships.test.mts
```

These tests cover ship variants, duplicate IDs, the five-ship limit, and tier
parsing using a mocked promotions page.

## RSI Comm-Link Pattern

### URL Structure

```text
<https://robertsspaceindustries.com/comm-link/transmission/[ID]-[Month]-[Year]-Subscriber-Promotions>
```

**Examples:**

* January 2026:
  `https://robertsspaceindustries.com/comm-link/transmission/20913-January-2026-Subscriber-Promotions`
* February 2026:
  `https://robertsspaceindustries.com/comm-link/transmission/20961-February-2026-Subscriber-Promotions`

### Publication Schedule

New subscriber promotions are typically announced in the **first week of each
month** (usually around the 1st-5th).

## Manual Update (When Automation Doesn't Work)

**Use this process when:**

* No PR was created on the 1st of the month
* An issue was created asking for manual review
* The automated PR needs corrections

### Finding the Promotion Post

#### Option A: RSS Feed (Recommended)

**Feed URL**: <https://robertsspaceindustries.com/en/comm-link/rss>

1. **RSS Reader**: Add the feed to Feedly, Inoreader, or your preferred RSS reader
2. **Filter for**: Posts titled "\[Month] \[Year] Subscriber Promotions"
3. **Set alerts** for posts containing "Subscriber Promotions"

#### Option B: Direct Search

1. Visit <https://robertsspaceindustries.com/comm-link/transmission/>
2. Look for posts titled "\[Month] \[Year] Subscriber Promotions"
3. Click to open the promotion post

#### Option C: Community Sources

1. **Reddit**: [r/starcitizen](https://reddit.com/r/starcitizen) announces immediately
2. **Spectrum**: [Official RSI forums](https://robertsspaceindustries.com/spectrum/)
3. **Discord**: Star Citizen community servers

### Extracting Ship Information

Look for these key details in the promotion post:

* **Centurion Ships**: Listed as "Centurion Subscribers receive..."
* **Imperator Ships**: Listed as "Imperator Subscribers receive..."
* **Flair Items**: Monthly cosmetic rewards
* **Insurance Duration**: 12 months (Centurion) or 24 months (Imperator)

### Updating Configuration File

Edit: `src/games/starcitizen/config/subscriber-ships.ts`

#### Step 1: Find Ship IDs

Ship names from RSI need to be converted to ship IDs (kebab-case). Check existing entries in the file or search `src/games/starcitizen/data/star-citizen-ships.json`.

**Examples:**

* "Sabre" → `'sabre'`
* "Starlancer MAX" → `'starlancer-max'`
* "Corsair" → `'corsair'`

#### Step 2: Add Month Entry

```typescript
'2026-03': {
  label: 'March 2026',
  centurion: ['ship-id-1'],
  imperator: ['ship-id-1', 'ship-id-2'],
  flair: 'Flair Item Description',
  notes: 'Ship names (12m insurance for Centurion, 24m for Imperator)',
},
```

**Important:**

* Use ship IDs from database (lowercase, hyphenated)
* Imperator tier always includes Centurion ships PLUS additional ships
* Include insurance duration in notes

#### Step 3: Create PR

```bash
git add src/games/starcitizen/config/subscriber-ships.ts
git commit -m "chore: Add [Month Year] subscriber ships"
git push -u origin feature/subscriber-[month]-[year]
```

Then create a Pull Request for team review.

## Automatic Updates

The system automatically syncs ships when:

* A character's subscriber tier is set or changed
* A character is created with subscriber tier
* New ships are added to subscriber config

## Subscriber Tiers

### Centurion ($10/month)

* **Color**: Blue (#54ADF7)

* **Ships per month**: 1

* **Ships**: 1 per month

* **Flair**: 1 per month

* **Insurance**: 12 months

### Imperator ($20/month)

* **Color**: Platinum/Silver (#E5E4E2)
* **Icon**: 🥈
* **Ships**: 2 per month (includes Centurion ship + exclusive variant)
* **Flair**: 2 per month
* **Insurance**: 24 months

## Branding Usage

The subscriber tier colors are defined in `SUBSCRIBER_COLORS`:

```typescript
import { SUBSCRIBER_COLORS, SUBSCRIBER_TIERS } from '@/games/starcitizen/config/subscriber-ships';

// Use in UI components
<div style={{ 
  borderColor: SUBSCRIBER_COLORS.centurion.primary,
  backgroundColor: SUBSCRIBER_COLORS.centurion.bg 
}}>
  {SUBSCRIBER_TIERS.centurion.icon} {SUBSCRIBER_TIERS.centurion.label}
</div>
```

## Recent Updates

### February 2026

* **Centurion**: MISC Starlancer MAX
* **Imperator**: MISC Starlancer MAX, MISC Starlancer TAC
* **Flair**: Coramor Décor Collection (Pink Heart Lamp, Carmilla Nightstand)

### January 2026

* **Centurion**: Aegis Sabre
* **Imperator**: Aegis Sabre, Sabre Firebird, Sabre Peregrine
* **Flair**: CC's Conversions Azreal Helmet

## Technical Implementation

### Database Schema

```sql
-- Migration 063
subscriber_tier VARCHAR(50)      -- 'centurion' or 'imperator'
subscriber_since TIMESTAMPTZ     -- When tier was first set
subscriber_ships_month VARCHAR(7) -- Last synced month (YYYY-MM)
```

### Utility Functions

* `syncSubscriberShips()` - Add ships to character hangar
* `removeSubscriberShips()` - Remove ships on tier downgrade
* `updateSubscriberTier()` - Handle tier changes
* `getSubscriberShipStatus()` - Check sync status

See: `src/lib/subscriberShips.ts`

## Troubleshooting

### Ships Not Appearing

1. Verify `subscriber_tier` is set correctly in database
2. Check `subscriber_ships_month` matches current month
3. Ensure ship names in config exactly match game database

### Tier Change Issues

Use `updateSubscriberTier()` instead of directly updating the field - it
handles ship additions/removals automatically.

### Month Transition

Ships auto-update when month changes. Manual sync available via
CharacterForm.

## Automation Details (GitHub Action)

### How It Works

The `Update Subscriber Ships` workflow (`.github/workflows/update-subscriber-ships.yml`):

1. **Triggers**: 1st of each month at 10 AM UTC (and manually via workflow\_dispatch)
2. **Scripts**: Runs `scripts/fetch-subscriber-ships.ts`
3. **Success Path**:
   * Extracts ship data from RSI comm-link
   * Updates `src/games/starcitizen/config/subscriber-ships.ts`
   * Creates PR for review (`chore/update-subscriber-ships` branch)
4. **Failure Path**:
   * Posts GitHub Issue asking for manual update
   * Includes links and instructions
   * Assigns to maintainers

### Requirements

* Node.js 20+
* Dependencies: `cheerio`, `node-fetch`
* GitHub permissions: `contents:write`, `pull-requests:write`, `issues:write`

### Known Limitations

* Depends on RSI's HTML structure (may fail if layout changes)
* Heuristic-based ship name extraction (may need manual correction)
* No verification against actual ship database

### Manual Workflow Skip

If needed to run immediately without waiting for schedule:

```bash
# In GitHub Actions UI:
# 1. Go to ".github/workflows/update-subscriber-ships.yml"
# 2. Click "Run workflow"
# 3. Select branch: "develop"
# 4. Click "Run workflow"
```

Or via CLI:

```bash
# Requires GitHub CLI installed
gh workflow run update-subscriber-ships.yml --ref develop
```

## External Resources

* **Subscriptions Page**:
  <https://robertsspaceindustries.com/pledge/subscriptions>
* **Comm-Link Archive**:
  <https://robertsspaceindustries.com/comm-link/transmission>
* **RSS Feed**:
  <https://robertsspaceindustries.com/en/comm-link/rss>
