'use client';

import React, { useState, useMemo } from 'react';
import { X, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ARCHETYPES } from '@/lib/characters';
import { GAMES, getAllGames, GameId } from '@/lib/games';
import { ROR_CLASSES } from '@/games/returnofreckooning/config';
import { WOW_FOREVER_CLASSES } from '@/games/wowforever/config';

export interface RecruitmentGameRow {
  game_slug: string;
  archived: boolean;
}

interface ClassOption {
  id: string;
  label: string;
}

/** Per-game class list from the existing game configs. Empty = game has no class list. */
function getClassOptions(game: GameId | ''): ClassOption[] {
  switch (game) {
    case 'aoc':
      return Object.entries(ARCHETYPES).map(([id, a]) => ({ id, label: `${a.icon} ${a.name}` }));
    case 'ror':
      return ROR_CLASSES.map((c) => ({ id: c.id, label: c.name }));
    case 'wowforever':
      return WOW_FOREVER_CLASSES.map((c) => ({ id: c.id, label: c.name }));
    default:
      return [];
  }
}

/**
 * Games the applicant can apply for. A group with no group_games rows is a legacy group with every
 * game enabled; otherwise only non-archived rows (legacy 'star-citizen' alias normalised) are offered.
 */
function getAvailableGames(rows: RecruitmentGameRow[]): GameId[] {
  if (rows.length === 0) return getAllGames().map((g) => g.id);
  const ids = rows
    .filter((r) => !r.archived)
    .map((r) => (r.game_slug === 'star-citizen' ? 'starcitizen' : r.game_slug))
    .filter((slug): slug is GameId => slug in GAMES);
  return Array.from(new Set(ids));
}

interface RecruitmentFormProps {
  groupId: string;
  groupName: string;
  /** The group's group_games rows (from /api/clan-public). Empty = legacy group, all games. */
  groupGames: RecruitmentGameRow[];
  onClose: () => void;
  onSuccess: () => void;
}

export function RecruitmentForm({
  groupId,
  groupName,
  groupGames,
  onClose,
  onSuccess,
}: RecruitmentFormProps) {
  const [discordUsername, setDiscordUsername] = useState('');
  const [characterName, setCharacterName] = useState('');
  const availableGames = useMemo(() => getAvailableGames(groupGames), [groupGames]);
  const [chosenGame, setChosenGame] = useState<GameId | ''>('');
  const gameSlug: GameId | '' = availableGames.length === 1 ? availableGames[0] : chosenGame;
  const classOptions = getClassOptions(gameSlug);
  const [primaryClass, setPrimaryClass] = useState('');
  const [experience, setExperience] = useState('');
  const [availability, setAvailability] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!discordUsername.trim() || !gameSlug) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const applicationData = {
      group_id: groupId,
      game_slug: gameSlug,
      discord_username: discordUsername.trim(),
      character_name: characterName.trim() || null,
      primary_class: primaryClass || null,
      experience: experience.trim() || null,
      availability: availability.trim() || null,
      message: message.trim() || null,
    };

    try {
      const { error: submitError } = await supabase
        .from('recruitment_applications')
        .insert(applicationData)
        .select();

      if (submitError) {
        console.error('[RecruitmentForm] Submit error:', submitError);
        throw submitError;
      }
      onSuccess();
    } catch (err) {
      console.error('[RecruitmentForm] Error:', err);
      setError('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Apply to {groupName}</h2>
            <p className="text-sm text-slate-400">Fill out the form to submit your application</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
            aria-label="Close"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Discord Username - Required */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Discord Username *
            </label>
            <input
              type="text"
              value={discordUsername}
              onChange={(e) => setDiscordUsername(e.target.value)}
              placeholder="username#1234 or @username"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Game - Required */}
          {availableGames.length === 0 ? (
            <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
              This group is not currently accepting applications for any game.
            </div>
          ) : availableGames.length === 1 ? (
            <div>
              <span className="block text-sm font-medium text-slate-300 mb-1">Game</span>
              <p className="text-white">{GAMES[availableGames[0]].name}</p>
            </div>
          ) : (
            <div>
              <label htmlFor="recruit-game" className="block text-sm font-medium text-slate-300 mb-1">
                Game *
              </label>
              <select
                id="recruit-game"
                value={chosenGame}
                onChange={(e) => {
                  setChosenGame(e.target.value as GameId | '');
                  setPrimaryClass('');
                }}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">Select game...</option>
                {availableGames.map((id) => (
                  <option key={id} value={id}>
                    {GAMES[id].name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Character Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Character Name
            </label>
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="Your in-game character name"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Primary Class (follows the chosen game; hidden when the game has no class list) */}
          {classOptions.length > 0 && (
            <div>
              <label htmlFor="recruit-primary" className="block text-sm font-medium text-slate-300 mb-1">
                Primary Class
              </label>
              <select
                id="recruit-primary"
                value={primaryClass}
                onChange={(e) => setPrimaryClass(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">Select class...</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Experience */}
          <div>
            <label htmlFor="recruitment-experience" className="block text-sm font-medium text-slate-300 mb-1">
              MMO Experience
            </label>
            <textarea
              id="recruitment-experience"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Tell us about your MMO experience..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Availability */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Availability
            </label>
            <input
              type="text"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="e.g., Weekday evenings EST, Weekends"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="recruitment-message" className="block text-sm font-medium text-slate-300 mb-1">
              Why do you want to join?
            </label>
            <textarea
              id="recruitment-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us a bit about yourself and why you're interested..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !discordUsername.trim() || !gameSlug}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                'Submitting...'
              ) : (
                <>
                  <Send size={16} />
                  Submit Application
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

