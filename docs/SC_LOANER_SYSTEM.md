# Star Citizen Loaner Ship System

## Overview

Automatically tracks and manages Star Citizen loaner ships based on the official RSI Loaner Ship Matrix.

## Database Schema

### Tables

**`sc_loaner_matrix`** - Official loaner ship mappings from RSI

* `pledged_ship` - The ship that's pledged (not flight ready)
* `loaner_ship` - The ship provided as a loaner
* `loaner_type` - 'primary', 'arena\_commander', or 'temporary'
* `notes` - Additional context (e.g., bug workarounds)

**`character_ships`** - Player ship ownership (existing table)

* `ownership_type` - 'pledged', 'in-game', or 'loaner'
* Automatically populated with loaners when pledges are added

## Automatic Triggers

### Adding Loaners (`add_loaner_ships_for_pledge`)

When a user adds a **pledged** ship:

1. Query `sc_loaner_matrix` for all loaners granted by that ship
2. Insert loaner ships with `ownership_type: 'loaner'`
3. Skip duplicates (won't create multiple of the same loaner)

### Removing Loaners (`remove_loaner_ships_for_pledge`)

When a user removes a **pledged** ship:

1. Find all loaners granted by that ship
2. Check if any OTHER pledges still grant those loaners
3. Only remove loaners that are no longer granted by any pledge

## Loaner Stacking Logic

**Important:** Loaners don't stack. You only get one of each loaner ship regardless of how many pledges grant it.

Example:

* Own 4 Pioneers → Each grants Caterpillar loaner
* Result: 1 Caterpillar (not 4)

## Updating the Matrix

The loaner matrix changes when RSI updates ships or releases new content.

### Routine Data Refresh (No Migration)

Run `yarn update-loaners` to:

1. Scrape latest data from RSI support page
2. Generate SQL snapshot in `scripts/generated/refresh_sc_loaner_matrix.sql`
3. Generate TypeScript types
4. Apply directly to `sc_loaner_matrix` using service role credentials

Preview only (no DB writes):

```bash
yarn update-loaners:preview
```

## Usage Example

```typescript
// User adds a pledged ship
await supabase
  .from('character_ships')
  .insert({
    character_id: 'user-char-id',
    ship_id: 'Carrack',
    ownership_type: 'pledged'
  });

// Trigger automatically adds:
// - C8 Pisces (loaner)
// - URSA Rover (loaner)

// User removes the Carrack
await supabase
  .from('character_ships')
  .delete()
  .match({ 
    character_id: 'user-char-id',
    ship_id: 'Carrack',
    ownership_type: 'pledged'
  });

// Trigger automatically removes:
// - C8 Pisces (if no other pledges grant it)
// - URSA Rover (if no other pledges grant it)
```

## Special Cases

### Arena Commander Loaners

Some ships have secondary loaners specifically for Arena Commander game modes.

* Example: Arrastra gets Arrow for AC play
* Marked with `loaner_type: 'arena_commander'`

### Temporary Loaners

Some loaners are temporary workarounds for bugs.

* Example: Prospector/Mole for mining ships due to HUD bug (STARC-113044)
* Marked with `loaner_type: 'temporary'`
* Include bug tracker reference in `notes`

## Data Source

Official RSI Support:\
<https://support.robertsspaceindustries.com/hc/en-us/articles/360003093114-Loaner-Ship-Matrix>

## Migrations

* **069** - Create `sc_loaner_matrix` table and triggers
* **070** - Historical initial loaner matrix seed

Routine matrix refreshes are now data sync operations, not new schema migrations.

## Future Enhancements

* \[ ] UI to view/manage loaners in fleet screen
* \[ ] Badge to distinguish loaner ships from owned ships
* \[ ] Filter to show/hide loaners
* \[ ] Notification when loaner matrix is updated
* \[ ] Automated weekly scraper to detect RSI changes
