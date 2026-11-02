import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getCurrentMonthKey,
  getSubscriberShips,
} from '@/games/starcitizen/config/subscriber-ships';
import { syncSubscriberShips, type SubscriberTier } from '@/lib/subscriberShips';
import supabaseAdmin from '@/lib/supabaseAdmin';

interface SubscriberMember {
  id: string;
  subscriber_tier: SubscriberTier;
  subscriber_ships_month: string | null;
}

interface MatrixLoanerRow {
  pledged_ship: string;
  loaner_ship: string;
}

interface CharacterShipRow {
  character_id: string;
  ship_id: string;
}

interface LoanerSyncSummary {
  charactersChecked: number;
  added: number;
  removed: number;
  failed: number;
  errors: Array<{ characterId: string; error: string }>;
}

async function reconcileLoaners(): Promise<LoanerSyncSummary> {
  const [matrixResult, pledgedResult, existingLoanersResult] = await Promise.all([
    supabaseAdmin
      .from('sc_loaner_matrix')
      .select('pledged_ship, loaner_ship'),
    supabaseAdmin
      .from('character_ships')
      .select('character_id, ship_id')
      .eq('ownership_type', 'pledged'),
    supabaseAdmin
      .from('character_ships')
      .select('character_id, ship_id')
      .eq('ownership_type', 'loaner'),
  ]);

  if (matrixResult.error) {
    throw new Error(matrixResult.error.message);
  }
  if (pledgedResult.error) {
    throw new Error(pledgedResult.error.message);
  }
  if (existingLoanersResult.error) {
    throw new Error(existingLoanersResult.error.message);
  }

  const matrixRows = (matrixResult.data || []) as MatrixLoanerRow[];
  const pledgedRows = (pledgedResult.data || []) as CharacterShipRow[];
  const existingLoanerRows = (existingLoanersResult.data || []) as CharacterShipRow[];

  const loanersByPledge = new Map<string, Set<string>>();
  for (const row of matrixRows) {
    if (!loanersByPledge.has(row.pledged_ship)) {
      loanersByPledge.set(row.pledged_ship, new Set());
    }
    loanersByPledge.get(row.pledged_ship)?.add(row.loaner_ship);
  }

  const pledgedByCharacter = new Map<string, Set<string>>();
  for (const row of pledgedRows) {
    if (!pledgedByCharacter.has(row.character_id)) {
      pledgedByCharacter.set(row.character_id, new Set());
    }
    pledgedByCharacter.get(row.character_id)?.add(row.ship_id);
  }

  const currentLoanersByCharacter = new Map<string, Set<string>>();
  for (const row of existingLoanerRows) {
    if (!currentLoanersByCharacter.has(row.character_id)) {
      currentLoanersByCharacter.set(row.character_id, new Set());
    }
    currentLoanersByCharacter.get(row.character_id)?.add(row.ship_id);
  }

  const characterIds = new Set<string>([
    ...Array.from(pledgedByCharacter.keys()),
    ...Array.from(currentLoanersByCharacter.keys()),
  ]);

  let added = 0;
  let removed = 0;
  let failed = 0;
  const errors: Array<{ characterId: string; error: string }> = [];

  for (const characterId of characterIds) {
    const pledgedShips = pledgedByCharacter.get(characterId) || new Set<string>();
    const currentLoaners = currentLoanersByCharacter.get(characterId) || new Set<string>();

    const expectedLoaners = new Set<string>();
    for (const pledgedShip of pledgedShips) {
      const mappedLoaners = loanersByPledge.get(pledgedShip);
      if (!mappedLoaners) {
        continue;
      }
      for (const loaner of mappedLoaners) {
        expectedLoaners.add(loaner);
      }
    }

    const toAdd = Array.from(expectedLoaners).filter((shipId) => !currentLoaners.has(shipId));
    const toRemove = Array.from(currentLoaners).filter((shipId) => !expectedLoaners.has(shipId));

    if (toAdd.length > 0) {
      const { error } = await supabaseAdmin
        .from('character_ships')
        .upsert(
          toAdd.map((shipId) => ({
            character_id: characterId,
            ship_id: shipId,
            ownership_type: 'loaner',
            notes: 'Auto-granted loaner (cron reconciliation)',
          })),
          { onConflict: 'character_id,ship_id,ownership_type' }
        );

      if (error) {
        failed += 1;
        errors.push({ characterId, error: error.message });
        continue;
      }

      added += toAdd.length;
    }

    if (toRemove.length > 0) {
      const { error } = await supabaseAdmin
        .from('character_ships')
        .delete()
        .eq('character_id', characterId)
        .eq('ownership_type', 'loaner')
        .like('notes', 'Auto-granted loaner%')
        .in('ship_id', toRemove);

      if (error) {
        failed += 1;
        errors.push({ characterId, error: error.message });
        continue;
      }

      removed += toRemove.length;
    }
  }

  return {
    charactersChecked: characterIds.size,
    added,
    removed,
    failed,
    errors,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const currentMonth = getCurrentMonthKey();
    const loanerSummary = await reconcileLoaners();

    const { data, error } = await supabaseAdmin
      .from('members')
      .select('id, subscriber_tier, subscriber_ships_month')
      .eq('game_slug', 'starcitizen')
      .in('subscriber_tier', ['centurion', 'imperator']);

    if (error) {
      throw error;
    }

    const subscribers = (data || []) as SubscriberMember[];

    const subscriberIds = subscribers.map((subscriber) => subscriber.id);
    const subscriberShipsByCharacter = new Map<string, Set<string>>();

    if (subscriberIds.length > 0) {
      const { data: subscriberShipRows, error: subscriberShipError } = await supabaseAdmin
        .from('character_ships')
        .select('character_id, ship_id')
        .eq('ownership_type', 'subscriber')
        .in('character_id', subscriberIds);

      if (subscriberShipError) {
        throw subscriberShipError;
      }

      for (const row of (subscriberShipRows || []) as CharacterShipRow[]) {
        if (!subscriberShipsByCharacter.has(row.character_id)) {
          subscriberShipsByCharacter.set(row.character_id, new Set());
        }
        subscriberShipsByCharacter.get(row.character_id)?.add(row.ship_id);
      }
    }

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ characterId: string; error: string }> = [];

    for (const subscriber of subscribers) {
      processed += 1;

      if (!subscriber.subscriber_tier) {
        skipped += 1;
        continue;
      }

      const expectedShips = getSubscriberShips(subscriber.subscriber_tier, currentMonth);
      if (expectedShips.length === 0) {
        skipped += 1;
        continue;
      }

      if (subscriber.subscriber_ships_month === currentMonth) {
        const existingShips = subscriberShipsByCharacter.get(subscriber.id) || new Set<string>();
        const hasMissingExpected = expectedShips.some((shipId) => !existingShips.has(shipId));
        const hasUnexpectedExisting = Array.from(existingShips).some(
          (shipId) => !expectedShips.includes(shipId)
        );

        if (!hasMissingExpected && !hasUnexpectedExisting) {
          skipped += 1;
          continue;
        }
      }

      const { error: removeError } = await supabaseAdmin
        .from('character_ships')
        .delete()
        .eq('character_id', subscriber.id)
        .eq('ownership_type', 'subscriber');

      if (removeError) {
        failed += 1;
        errors.push({ characterId: subscriber.id, error: removeError.message });
        continue;
      }

      const syncResult = await syncSubscriberShips(
        supabaseAdmin,
        subscriber.id,
        subscriber.subscriber_tier,
        currentMonth
      );

      if (!syncResult.success) {
        failed += 1;
        errors.push({
          characterId: subscriber.id,
          error: syncResult.error || 'Unknown sync error',
        });
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('members')
        .update({ subscriber_ships_month: currentMonth })
        .eq('id', subscriber.id);

      if (updateError) {
        failed += 1;
        errors.push({ characterId: subscriber.id, error: updateError.message });
        continue;
      }

      updated += 1;
    }

    return res.status(200).json({
      success: true,
      month: currentMonth,
      subscribers: {
        processed,
        updated,
        skipped,
        failed,
        errors,
      },
      loaners: loanerSummary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Subscriber ships sync job failed:', message);
    return res.status(500).json({ success: false, error: message });
  }
}