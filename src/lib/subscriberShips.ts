/**
 * Star Citizen Subscriber Ships Utility
 *
 * Handles syncing subscriber-exclusive ships to character hangars
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  getSubscriberShips,
  getCurrentMonthKey,
  type SubscriberShipMonth,
} from '@/games/starcitizen/config/subscriber-ships';

export type SubscriberTier = 'centurion' | 'imperator' | null;

/**
 * Check if a character's subscriber ships need to be re-synced
 * (stored month doesn't match current month)
 */
export function needsSubscriberShipResync(storedMonth: string | null | undefined): boolean {
  if (!storedMonth) return false;

  const currentMonth = getCurrentMonthKey();
  const needsResync = storedMonth !== currentMonth;

  if (needsResync) {
    console.log(`[Subscriber Ships] Character needs re-sync: stored "${storedMonth}" vs current "${currentMonth}"`);
  }

  return needsResync;
}

/**
 * Sync subscriber ships to a character's hangar
 *
 * Adds all ships the character is entitled to based on their subscriber tier.
 * Handles both monthly updates and new character creation.
 */
export async function syncSubscriberShips(
  supabase: SupabaseClient,
  characterId: string,
  subscriberTier: SubscriberTier,
  month?: string
): Promise<{ success: boolean; shipsAdded: string[]; error?: string }> {
  try {
    // Get ships for this tier and month
    const ships = getSubscriberShips(subscriberTier, month);

    if (ships.length === 0) {
      return { success: true, shipsAdded: [] };
    }

    const monthKey = month || getCurrentMonthKey();

    // First, delete any old subscriber ships for this character/tier to clean up previous months
    console.log(`[Subscriber Ships] Removing old subscriber ships for character ${characterId}...`);
    const { error: deleteError } = await supabase
      .from('character_ships')
      .delete()
      .eq('character_id', characterId)
      .eq('ownership_type', 'subscriber');

    if (deleteError) {
      console.warn('Warning removing old subscriber ships:', deleteError);
      // Don't fail, just warn - we can still add the new ones
    }

    // Now upsert the new ships
    // Subscriber ships are marked as 'subscriber' ownership type with notes indicating tier/month
    console.log(`[Subscriber Ships] Adding ${ships.length} ships for ${monthKey}...`);
    const { data, error } = await supabase.from('character_ships').upsert(
      ships.map(ship => ({
        character_id: characterId,
        ship_id: ship,
        ownership_type: 'subscriber',
        notes: `${subscriberTier} subscriber perk (${monthKey})`,
      })),
      {
        onConflict: 'character_id,ship_id,ownership_type',
      }
    );

    if (error) {
      console.error('Error syncing subscriber ships:', error);
      return {
        success: false,
        shipsAdded: [],
        error: error.message,
      };
    }

    console.log(`[Subscriber Ships] Successfully synced ships:`, ships);
    return {
      success: true,
      shipsAdded: ships,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Exception syncing subscriber ships:', message);
    return {
      success: false,
      shipsAdded: [],
      error: message,
    };
  }
}

/**
 * Remove subscriber ships when downgrading tier
 *
 * If a user goes from Imperator → Centurion, removes the Imperator-exclusive ships
 */
export async function removeSubscriberShips(
  supabase: SupabaseClient,
  characterId: string,
  shipsToRemove: string[]
): Promise<{ success: boolean; shipsRemoved: string[]; error?: string }> {
  try {
    // Remove subscriber ships by deleting entries with subscriber ownership type
    const { error } = await supabase
      .from('character_ships')
      .delete()
      .eq('character_id', characterId)
      .eq('ownership_type', 'subscriber')
      .in('ship_id', shipsToRemove);

    if (error) {
      console.error('Error removing subscriber ships:', error);
      return {
        success: false,
        shipsRemoved: [],
        error: error.message,
      };
    }

    return {
      success: true,
      shipsRemoved: shipsToRemove,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Exception removing subscriber ships:', message);
    return {
      success: false,
      shipsRemoved: [],
      error: message,
    };
  }
}

/**
 * Handle subscriber tier change on a character
 *
 * Adds new ships and removes old ones based on tier transition
 */
export async function updateSubscriberTier(
  supabase: SupabaseClient,
  characterId: string,
  oldTier: SubscriberTier,
  newTier: SubscriberTier,
  month?: string
): Promise<{
  success: boolean;
  added: string[];
  removed: string[];
  error?: string;
}> {
  try {
    const oldShips = getSubscriberShips(oldTier, month);
    const newShips = getSubscriberShips(newTier, month);

    // Ships to remove: in old tier but not in new
    const toRemove = oldShips.filter(ship => !newShips.includes(ship));

    // Ships to add: in new tier but not in old
    const toAdd = newShips.filter(ship => !oldShips.includes(ship));

    // Remove downgraded ships
    if (toRemove.length > 0) {
      const removeResult = await removeSubscriberShips(
        supabase,
        characterId,
        toRemove
      );
      if (!removeResult.success) {
        return {
          success: false,
          added: [],
          removed: [],
          error: `Failed to remove ships: ${removeResult.error}`,
        };
      }
    }

    // Add new ships
    if (toAdd.length > 0) {
      const addResult = await syncSubscriberShips(
        supabase,
        characterId,
        newTier,
        month
      );
      if (!addResult.success) {
        return {
          success: false,
          added: [],
          removed: toRemove,
          error: `Failed to add ships: ${addResult.error}`,
        };
      }
    }

    return {
      success: true,
      added: toAdd,
      removed: toRemove,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Exception updating subscriber tier:', message);
    return {
      success: false,
      added: [],
      removed: [],
      error: message,
    };
  }
}

/**
 * Get all ships a character should have but might be missing
 *
 * Useful for detecting sync issues
 */
export async function getSubscriberShipStatus(
  supabase: SupabaseClient,
  characterId: string,
  subscriberTier: SubscriberTier,
  month?: string
): Promise<{
  shouldHave: string[];
  has: string[];
  missing: string[];
}> {
  const shouldHave = getSubscriberShips(subscriberTier, month);

  // Fetch character's ships
  const { data: ships } = await supabase
    .from('character_ships')
    .select('ship_name')
    .eq('character_id', characterId)
    .eq('is_subscriber_perk', true);

  const has = ships?.map(s => s.ship_name) || [];
  const missing = shouldHave.filter(ship => !has.includes(ship));

  return {
    shouldHave,
    has,
    missing,
  };
}
