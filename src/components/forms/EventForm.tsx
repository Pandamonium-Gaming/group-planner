'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar } from 'lucide-react';
import { Event, EventType, EventRole, EVENT_ROLES, utcToLocal, getEventTypesForGame, getCanonicalEventType, isEventTypeAllowedForGame } from '@/lib/events';
import { useLanguage } from '@/contexts/LanguageContext';

interface EventFormData {
  title: string;
  description: string;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  location: string;
  max_attendees: string;
  // AoC role fields
  tanks_min: string;
  clerics_min: string;
  bards_min: string;
  ranged_dps_min: string;
  melee_dps_min: string;
  tanks_max: string;
  clerics_max: string;
  bards_max: string;
  ranged_dps_max: string;
  melee_dps_max: string;
  allow_combined_dps: boolean;
  combined_dps_max: string;
  // RoR role fields
  ror_tanks_min: string;
  ror_tanks_max: string;
  ror_healers_min: string;
  ror_healers_max: string;
  ror_dps_min: string;
  ror_dps_max: string;
  is_public: boolean;
  allow_allied_signups: boolean;
  sendDiscordNotification: boolean;
}

interface EventFormProps {
  initialData?: Partial<Event>;
  groupId: string;
  userId: string;
  gameSlug?: string;
  onSubmit: (event: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'is_cancelled'>, sendDiscordNotification: boolean) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export function EventForm({ 
  initialData, 
  groupId,
  userId,
  gameSlug = 'aoc',
  onSubmit, 
  onCancel,
  isEditing = false 
}: EventFormProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<EventFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    event_type: getCanonicalEventType(initialData?.event_type || 'other', gameSlug),
    starts_at: initialData?.starts_at ? utcToLocal(initialData.starts_at) : '',
    ends_at: initialData?.ends_at ? utcToLocal(initialData.ends_at) : '',
    location: initialData?.location || '',
    max_attendees: initialData?.max_attendees?.toString() || '',
    // AoC defaults
    tanks_min: initialData?.tanks_min?.toString() || '0',
    clerics_min: initialData?.clerics_min?.toString() || '0',
    bards_min: initialData?.bards_min?.toString() || '0',
    ranged_dps_min: initialData?.ranged_dps_min?.toString() || '0',
    melee_dps_min: initialData?.melee_dps_min?.toString() || '0',
    tanks_max: initialData?.tanks_max?.toString() || '',
    clerics_max: initialData?.clerics_max?.toString() || '',
    bards_max: initialData?.bards_max?.toString() || '',
    ranged_dps_max: initialData?.ranged_dps_max?.toString() || '',
    melee_dps_max: initialData?.melee_dps_max?.toString() || '',
    allow_combined_dps: (initialData as any)?.allow_combined_dps || false,
    combined_dps_max: (initialData as any)?.combined_dps_max?.toString() || '',
    // RoR defaults (2/2/2 composition)
    ror_tanks_min: (initialData as any)?.ror_tanks_min?.toString() || (gameSlug === 'ror' ? '2' : '0'),
    ror_tanks_max: (initialData as any)?.ror_tanks_max?.toString() || (gameSlug === 'ror' ? '2' : ''),
    ror_healers_min: (initialData as any)?.ror_healers_min?.toString() || (gameSlug === 'ror' ? '2' : '0'),
    ror_healers_max: (initialData as any)?.ror_healers_max?.toString() || (gameSlug === 'ror' ? '2' : ''),
    ror_dps_min: (initialData as any)?.ror_dps_min?.toString() || (gameSlug === 'ror' ? '2' : '0'),
    ror_dps_max: (initialData as any)?.ror_dps_max?.toString() || (gameSlug === 'ror' ? '2' : ''),
    is_public: (initialData as any)?.is_public || false,
    allow_allied_signups: (initialData as any)?.allow_allied_signups !== false, // Default true
    sendDiscordNotification: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.starts_at) {
      setError('Start time is required');
      return;
    }
    if (!isEventTypeAllowedForGame(formData.event_type, gameSlug, initialData?.event_type)) {
      setError(t('wowForever.invalidEventType'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const eventData = {
        group_id: groupId,
        created_by: userId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        event_type: formData.event_type,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
        location: formData.location.trim() || null,
        max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : null,
        // AoC role requirements
        tanks_min: parseInt(formData.tanks_min) || 0,
        clerics_min: parseInt(formData.clerics_min) || 0,
        bards_min: parseInt(formData.bards_min) || 0,
        ranged_dps_min: parseInt(formData.ranged_dps_min) || 0,
        melee_dps_min: parseInt(formData.melee_dps_min) || 0,
        tanks_max: formData.tanks_max ? parseInt(formData.tanks_max) : null,
        clerics_max: formData.clerics_max ? parseInt(formData.clerics_max) : null,
        bards_max: formData.bards_max ? parseInt(formData.bards_max) : null,
        ranged_dps_max: formData.ranged_dps_max ? parseInt(formData.ranged_dps_max) : null,
        melee_dps_max: formData.melee_dps_max ? parseInt(formData.melee_dps_max) : null,
        allow_combined_dps: formData.allow_combined_dps,
        combined_dps_max: formData.allow_combined_dps && formData.combined_dps_max ? parseInt(formData.combined_dps_max) : null,
        // RoR role requirements
        ror_tanks_min: parseInt(formData.ror_tanks_min) || 0,
        ror_tanks_max: formData.ror_tanks_max ? parseInt(formData.ror_tanks_max) : null,
        ror_healers_min: parseInt(formData.ror_healers_min) || 0,
        ror_healers_max: formData.ror_healers_max ? parseInt(formData.ror_healers_max) : null,
        ror_dps_min: parseInt(formData.ror_dps_min) || 0,
        ror_dps_max: formData.ror_dps_max ? parseInt(formData.ror_dps_max) : null,
        is_public: formData.is_public,
        allow_allied_signups: formData.allow_allied_signups,
      };
      await onSubmit(eventData, formData.sendDiscordNotification);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="event-form-title"
        className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between p-4 border-b border-slate-700">
          <h2 id="event-form-title" className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-400" />
            {isEditing ? 'Edit Event' : 'Create Event'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <div className="min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., Weekly Dungeon Run"
              autoFocus
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Event Type
            </label>
            {gameSlug === 'wowforever' && !Object.prototype.hasOwnProperty.call(getEventTypesForGame(gameSlug), formData.event_type) && (
              <p className="mb-2 text-sm text-slate-400">{t('wowForever.legacyEventType')}</p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(getEventTypesForGame(gameSlug)).map(([id, type]) => {
                const isSelected = formData.event_type === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFormData({ ...formData, event_type: id as EventType })}
                    className={`flex flex-col items-center p-2 rounded-lg text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-offset-slate-900'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                    style={isSelected ? { 
                      backgroundColor: type.color + '30',
                      color: type.color
                    } : undefined}
                  >
                    <span className="text-lg" aria-hidden="true">{type.icon}</span>
                    <span className={isSelected ? '' : 'text-slate-300'}>{gameSlug === 'wowforever' ? t(`wowForever.eventTypes.${id}`) : type.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start Time */}
          <div>
            <label htmlFor="event-starts-at" className="block text-sm font-medium text-slate-300 mb-2">
              Start Date & Time *
            </label>
            <input
              id="event-starts-at"
              type="datetime-local"
              value={formData.starts_at}
              onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* End Time */}
          <div>
            <label htmlFor="event-ends-at" className="block text-sm font-medium text-slate-300 mb-2">
              End Date & Time <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="event-ends-at"
              type="datetime-local"
              value={formData.ends_at}
              onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Location <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Node 5 - Dungeon Entrance"
            />
          </div>

          {/* Max Attendees */}
          <div>
            <label htmlFor="event-max-attendees" className="block text-sm font-medium text-slate-300 mb-2">
              Max Attendees <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="event-max-attendees"
              type="number"
              min="1"
              max="100"
              value={formData.max_attendees}
              onChange={(e) => setFormData({ ...formData, max_attendees: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Leave empty for unlimited"
            />
          </div>

          {/* Role Requirements - AoC Only */}
          {gameSlug === 'aoc' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role Requirements <span className="text-slate-500">(min / max per role)</span>
            </label>
            <div className="space-y-3">
              {Object.entries(EVENT_ROLES).map(([roleKey, roleConfig]) => {
                const minFieldMap = {
                  tank: 'tanks_min',
                  cleric: 'clerics_min',
                  bard: 'bards_min',
                  ranged_dps: 'ranged_dps_min',
                  melee_dps: 'melee_dps_min'
                } as const;
                const maxFieldMap = {
                  tank: 'tanks_max',
                  cleric: 'clerics_max',
                  bard: 'bards_max',
                  ranged_dps: 'ranged_dps_max',
                  melee_dps: 'melee_dps_max'
                } as const;
                const minFieldName = minFieldMap[roleKey as EventRole];
                const maxFieldName = maxFieldMap[roleKey as EventRole];

                // Skip DPS fields if combined DPS is enabled
                if (formData.allow_combined_dps && (roleKey === 'ranged_dps' || roleKey === 'melee_dps')) {
                  return null;
                }

                return (
                  <div key={roleKey} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32">
                      <span className="text-lg">{roleConfig.icon}</span>
                      <span className={`text-sm ${roleConfig.color}`}>
                        {roleConfig.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-400 mb-1">Min</label>
                        <input
                          type="number"
                          min="0"
                          max="40"
                          value={formData[minFieldName]}
                          aria-label={`${roleConfig.name} minimum`}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            [minFieldName]: e.target.value 
                          })}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <span className="text-slate-500 pt-5">/</span>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-400 mb-1">Max</label>
                        <input
                          type="number"
                          min="0"
                          max="40"
                          value={formData[maxFieldName]}
                          aria-label={`${roleConfig.name} maximum`}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            [maxFieldName]: e.target.value 
                          })}
                          placeholder="∞"
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-center placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Combined DPS Option */}
              <div className="pt-2 border-t border-slate-700">
                <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="allowCombinedDps"
                    checked={formData.allow_combined_dps}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      allow_combined_dps: e.target.checked,
                      combined_dps_max: ''
                    })}
                    className="w-4 h-4 text-indigo-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <label htmlFor="allowCombinedDps" className="text-sm text-slate-300 cursor-pointer flex-1">
                    Combine Ranged & Melee DPS limits
                  </label>
                </div>

                {formData.allow_combined_dps && (
                  <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <label htmlFor="combined-dps-max" className="block text-sm text-slate-300 mb-2">
                      Combined DPS Max
                    </label>
                    <input
                      id="combined-dps-max"
                      type="number"
                      min="1"
                      max="40"
                      value={formData.combined_dps_max}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        combined_dps_max: e.target.value 
                      })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., 5"
                    />
                    <p className="text-xs text-slate-400 mt-2">
                      Any combination of Ranged or Melee DPS can fill this slot
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Role Requirements - RoR Only */}
          {gameSlug === 'ror' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Party Composition <span className="text-slate-500">(min / max per role)</span>
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Default: 2 Tanks, 2 Healers, 2 DPS (any combination of Melee/Skirmish/Ranged)
            </p>
            <div className="space-y-3">
              {/* Tank */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-32">
                  <span className="text-lg">🛡️</span>
                  <span className="text-sm text-blue-400">Tank</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Min</label>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={formData.ror_tanks_min}
                      aria-label="Tank minimum"
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ror_tanks_min: e.target.value 
                      })}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <span className="text-slate-500 pt-5">/</span>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Max</label>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={formData.ror_tanks_max}
                      aria-label="Tank maximum"
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ror_tanks_max: e.target.value 
                      })}
                      placeholder="∞"
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-center placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Healer */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-32">
                  <span className="text-lg">✨</span>
                  <span className="text-sm text-green-400">Healer</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Min</label>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={formData.ror_healers_min}
                      aria-label="Healer minimum"
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ror_healers_min: e.target.value 
                      })}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <span className="text-slate-500 pt-5">/</span>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Max</label>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={formData.ror_healers_max}
                      aria-label="Healer maximum"
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ror_healers_max: e.target.value 
                      })}
                      placeholder="∞"
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-center placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* DPS */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-32">
                  <span className="text-lg">⚔️</span>
                  <span className="text-sm text-orange-400">DPS</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Min</label>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={formData.ror_dps_min}
                      aria-label="DPS minimum"
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ror_dps_min: e.target.value 
                      })}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <span className="text-slate-500 pt-5">/</span>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Max</label>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={formData.ror_dps_max}
                      aria-label="DPS maximum"
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        ror_dps_max: e.target.value 
                      })}
                      placeholder="∞"
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-center placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              DPS includes all Melee, Skirmish, and Ranged DPS classes
            </p>
          </div>
          )}

          {/* Public Event Option */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Options
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    is_public: e.target.checked
                  })}
                  className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500"
                />
                <label htmlFor="isPublic" className="text-sm text-slate-300 cursor-pointer flex-1">
                  Make this event public (allow unauthenticated guests to sign up)
                </label>
              </div>

              {/* Allied Member Signup Option */}
              <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
                <input
                  type="checkbox"
                  id="allowAlliedSignups"
                  checked={formData.allow_allied_signups}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    allow_allied_signups: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="allowAlliedSignups" className="text-sm text-slate-300 cursor-pointer flex-1">
                  Allow allied member signups
                </label>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="event-description" className="block text-sm font-medium text-slate-300 mb-2">
              Description <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              id="event-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              placeholder="Additional details about the event..."
            />
          </div>

          {/* Discord Notification */}
          <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <input
              type="checkbox"
              id="sendDiscordNotification"
              checked={formData.sendDiscordNotification}
              onChange={(e) => setFormData({ ...formData, sendDiscordNotification: e.target.checked })}
              className="w-4 h-4 text-orange-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-orange-500"
            />
            <label htmlFor="sendDiscordNotification" className="text-sm text-slate-300 cursor-pointer">
              Send Discord notification
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-3 p-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
