'use client';

import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ARCHETYPES, ArchetypeId } from '@/lib/characters';

interface RecruitmentFormProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecruitmentForm({
  groupId,
  groupName,
  onClose,
  onSuccess,
}: RecruitmentFormProps) {
  const [discordUsername, setDiscordUsername] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [primaryClass, setPrimaryClass] = useState<ArchetypeId | ''>('');
  const [experience, setExperience] = useState('');
  const [availability, setAvailability] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!discordUsername.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const applicationData = {
      group_id: groupId,
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

          {/* Primary Class */}
          <div>
            <label htmlFor="recruit-primary" className="block text-sm font-medium text-slate-300 mb-1">
              Primary Archetype
            </label>
            <select
              id="recruit-primary"
              value={primaryClass}
              onChange={(e) => setPrimaryClass(e.target.value as ArchetypeId | '')}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Select archetype...</option>
              {Object.entries(ARCHETYPES).map(([id, arch]) => (
                <option key={id} value={id}>
                  {arch.icon} {arch.name}
                </option>
              ))}
            </select>
          </div>

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
              disabled={submitting || !discordUsername.trim()}
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

