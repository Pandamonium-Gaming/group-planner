"use client";

import { useMemo, useState } from 'react';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, Loader2, Check, ListOrdered } from 'lucide-react';
import { getClientAuthStack } from '@/lib/authStack';
import { Clan } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import {
  GameRank,
  getConfiguredGameRanks,
  getRankColumnNames,
  isGameRankEnabled,
  normalizeGameId,
} from '@/lib/gameRankSettings';

interface GameRankSettingsProps {
  groupId: string;
  gameSlug: string;
  group: Clan;
  onSaved?: () => void;
}

function slugifyRankName(name: string): string {
  const value = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return value || 'rank';
}

function toSavedRanks(ranks: GameRank[]): GameRank[] {
  const ordered = ranks.slice();
  const total = ordered.length;

  return ordered.map((rank, index) => ({
    ...rank,
    hierarchy: total - index,
  }));
}

export function GameRankSettings({ groupId, gameSlug, group, onSaved }: GameRankSettingsProps) {
  const gameId = normalizeGameId(gameSlug);
  const gameName = gameId === 'sc'
    ? 'Star Citizen'
    : gameId === 'ror'
      ? 'Return of Reckoning'
      : gameId === 'wowforever'
        ? 'WoW Forever'
        : 'Ashes of Creation';

  const initialRanksDesc = useMemo(() => {
    return getConfiguredGameRanks(group, gameSlug)
      .slice()
      .sort((a, b) => b.hierarchy - a.hierarchy);
  }, [group, gameSlug]);

  const [enabled, setEnabled] = useState(isGameRankEnabled(group, gameSlug));
  const [ranks, setRanks] = useState<GameRank[]>(initialRanksDesc);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canUseV2Api = getClientAuthStack() === 'v2' && typeof fetch === 'function';

  const moveRank = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= ranks.length) {
      return;
    }

    const updated = ranks.slice();
    const [item] = updated.splice(index, 1);
    updated.splice(nextIndex, 0, item);
    setRanks(updated);
  };

  const addRank = () => {
    const existingIds = new Set(ranks.map((rank) => rank.id));
    let candidateId = `rank-${ranks.length + 1}`;
    let suffix = ranks.length + 1;

    while (existingIds.has(candidateId)) {
      suffix += 1;
      candidateId = `rank-${suffix}`;
    }

    setRanks([
      ...ranks,
      {
        id: candidateId,
        name: 'New Rank',
        hierarchy: 1,
      },
    ]);
  };

  const removeRank = (index: number) => {
    setRanks((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRankName = (index: number, name: string) => {
    setRanks((prev) => {
      const updated = prev.slice();
      const current = updated[index];
      if (!current) {
        return prev;
      }

      // Keep stable IDs for existing ranks. For generated placeholders, derive from name.
      const shouldRegenerateId = current.id.startsWith('rank-');
      const nextId = shouldRegenerateId ? slugifyRankName(name) : current.id;

      updated[index] = {
        ...current,
        id: nextId,
        name,
      };
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const sanitized = ranks
        .map((rank) => ({ ...rank, name: rank.name.trim() }))
        .filter((rank) => rank.name.length > 0);

      const ids = sanitized.map((rank) => rank.id);
      const duplicateId = ids.find((id, index) => ids.indexOf(id) !== index);
      if (duplicateId) {
        throw new Error('Rank IDs must be unique. Rename duplicated ranks and try again.');
      }

      const { enabledColumn, customRanksColumn } = getRankColumnNames(gameSlug);
      const changes: Record<string, unknown> = {
        [enabledColumn]: enabled,
        [customRanksColumn]: toSavedRanks(sanitized),
      };

      if (canUseV2Api) {
        const response = await fetch('/api/group/settings', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'update_group_fields',
            group_id: groupId,
            changes,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          throw new Error(payload.details || payload.error || `Failed to save rank settings (${response.status})`);
        }
      } else {
        const { error: updateError } = await supabase
          .from('groups')
          .update(changes)
          .eq('id', groupId);

        if (updateError) {
          throw updateError;
        }
      }

      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rank settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <ListOrdered className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">{gameName} Rank Settings</h3>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500"
        />
        <div>
          <span className="text-sm font-medium text-slate-200">Enable Ranks For This Game</span>
          <p className="text-xs text-slate-400">
            Turn off if your group does not use game-specific member ranks.
          </p>
        </div>
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-300">Ranks (highest to lowest)</p>
          <button
            type="button"
            onClick={addRank}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-100 rounded"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Rank
          </button>
        </div>

        {ranks.length === 0 && (
          <p className="text-xs text-slate-500">No ranks configured. Add at least one rank to use rank assignments.</p>
        )}

        {ranks.map((rank, index) => (
          <div key={`${rank.id}-${index}`} className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <input
              value={rank.name}
              onChange={(e) => updateRankName(index, e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Rank name"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveRank(index, -1)}
                disabled={index === 0}
                className="p-2 rounded bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40"
                title="Move up"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveRank(index, 1)}
                disabled={index === ranks.length - 1}
                className="p-2 rounded bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40"
                title="Move down"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeRank(index)}
                className="p-2 rounded bg-red-900/30 border border-red-800 text-red-300"
                title="Remove rank"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          <>
            <Check className="w-4 h-4" />
            Saved
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Rank Settings
          </>
        )}
      </button>
    </div>
  );
}
