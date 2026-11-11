'use client';

import React, { useState } from 'react';
import { Calendar, MapPin, Users, Clock, Check, HelpCircle, X, ChevronDown, ChevronUp, Link as LinkIcon, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { postEventNotification } from '@/lib/webhookClient';
import { EventClassRoster } from './EventClassRoster';
import { GuildRankBadge } from '@/components/characters/GuildRankBadge';
import { CharacterWithProfessions } from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnonymousGuestForm } from '@/components/forms/AnonymousGuestForm';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { 
  EventWithRsvps, 
  RsvpStatus, 
  EventRole,
  getEventTypeForGame,
  EVENT_ROLE_FIELDS,
  getEventRolesForGame,
  getEventRoleForGame,
  RSVP_STATUSES,
  formatEventTime,
  formatTime,
  getRelativeTime,
  isEventPast,
  isEventNow
} from '@/lib/events';

interface EventCardProps {
  event: EventWithRsvps;
  timezone: string;
  groupId: string;
  userId: string;
  characters: CharacterWithProfessions[];
  onRsvp: (status: RsvpStatus, role?: EventRole | null, characterId?: string, targetUserId?: string) => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  canManage?: boolean;
  isPublicView?: boolean;
}

export function EventCard({ 
  event, 
  timezone, 
  groupId,
  userId,
  characters,
  onRsvp, 
  onEdit, 
  onCancel,
  onDelete,
  canManage = false,
  isPublicView = false
}: EventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedRole, setSelectedRole] = useState<EventRole | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [adminTargetUserId, setAdminTargetUserId] = useState<string | null>(null);
  const [isRsvpLoading, setIsRsvpLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [reposting, setReposting] = useState(false);
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { hasPermission } = usePermissions(groupId);

  // Get user's main character and filter characters for this user
  const userCharacters = characters.filter(c => c.user_id === userId);
  const mainCharacter = userCharacters.find(c => c.is_main);
  
  // Check if user is admin
  const isAdmin = hasPermission('events_edit_any') || canManage;
  
  // Get unique users from all characters for admin selector
  const uniqueUsers = Array.from(new Map(
    characters
      .filter(char => char.user_id !== userId) // Exclude current user
      .map(char => {
        const mainChar = characters.find(c => c.user_id === char.user_id && c.is_main);
        const displayChar = mainChar || char;
        return [char.user_id, { userId: char.user_id, characterName: displayChar.name, characterId: displayChar.id }];
      })
  ).values());

  // Helper function to format attendee name (show char + discord name)
  const formatAttendeeName = (rsvp: EventWithRsvps['rsvps'][0]) => {
    let charName = rsvp.character?.name;
    let characterId = rsvp.character?.id || rsvp.character_id;
    const userName = rsvp.user?.display_name;
    
    // If no character linked but user exists, find their main character
    if (!charName && rsvp.user_id) {
      const userMainChar = characters.find(c => c.user_id === rsvp.user_id && c.is_main);
      if (userMainChar) {
        charName = userMainChar.name;
        characterId = userMainChar.id;
      }
    }
    
    const name = charName && userName ? `${charName} (${userName})` : charName || userName || 'Unknown';
    return <>{name} {charName && <GuildRankBadge characterId={characterId} />}</>;
  };

  // Wrapper for RSVP calls with error handling and loading state
  const handleRsvpClick = async (status: RsvpStatus, role?: EventRole | null) => {
    try {
      setIsRsvpLoading(true);
      // Use selected character, or default to main character for status changes
      const charId = selectedCharacterId || mainCharacter?.id;
      const targetUserId = adminMode && adminTargetUserId ? adminTargetUserId : undefined;
      await onRsvp(status, role, charId, targetUserId);
      // Show success toast
      const statusText = status === 'attending' ? 'attending' : status === 'maybe' ? 'maybe' : 'declined';
      const forText = adminMode && adminTargetUserId ? ' for selected member' : '';
      showToast('success', `Successfully marked as ${statusText}${forText}`);
    } catch (err) {
      console.error('RSVP error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to RSVP for event';
      showToast('error', errorMsg);
    } finally {
      setIsRsvpLoading(false);
    }
  };
  
  const eventType = getEventTypeForGame(event.event_type, event.game_slug || 'aoc');
  const isPast = isEventPast(event.starts_at);
  const isNow = isEventNow(event.starts_at, event.ends_at);
  const userRsvp = event.user_rsvp;
  const userRole = getEventRoleForGame(userRsvp?.role ?? null, event.game_slug);
  
  // Check if user can edit or delete events
  const { loading } = usePermissions(groupId);
  const canEditEvent = hasPermission('events_edit_any') || (hasPermission('events_edit_own') && event.created_by === userId);
  const canDeleteEvent = hasPermission('events_delete_any') || (hasPermission('events_delete_own') && event.created_by === userId);

  const totalAttending = event.rsvp_counts.attending + event.rsvp_counts.maybe;
  const isWow = event.game_slug === 'wowforever';
  const eventRoles = getEventRolesForGame(event.game_slug);
  const showRoleComposition = isWow || Object.keys(eventRoles).some(key => {
    const fields = EVENT_ROLE_FIELDS[key as EventRole];
    return event[fields.min] > 0 || event[fields.max] != null;
  }) || (event.allow_combined_dps && event.combined_dps_max != null);

  // Copy event link to clipboard
  const copyEventLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#event-${event.id}`;
    navigator.clipboard.writeText(url);
    showToast('success', 'Event link copied to clipboard!');
  };
  
  // When calculating if full, exclude current user's RSVP if they have one
  // This allows switching from Maybe to Attending even if at capacity
  const userCountsTowardCapacity = userRsvp && (userRsvp.status === 'attending' || userRsvp.status === 'maybe');
  const effectiveAttending = userCountsTowardCapacity ? totalAttending - 1 : totalAttending;
  const isFull = event.max_attendees ? effectiveAttending >= event.max_attendees : false;

  return (
    <div
      id={`event-${event.id}`}
      className={`bg-slate-900/80 backdrop-blur-sm rounded-lg border transition-all scroll-mt-4 ${
        event.is_cancelled ? 'border-red-500/50 opacity-60' :
        isNow ? 'border-green-500 shadow-lg shadow-green-500/20' :
        isPast ? 'border-slate-700 opacity-70' :
        'border-slate-700 hover:border-slate-600'
      }`}
    >
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Event type icon and title */}
          <div className="flex items-start gap-3 min-w-0 w-full sm:w-auto">
            <div 
              className="p-2 rounded-lg text-xl shrink-0"
              style={{ backgroundColor: eventType.color + '20' }}
            >
              {eventType.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold truncate ${event.is_cancelled ? 'line-through text-slate-400' : 'text-white'}`}>
                  {event.title}
                </h3>
                {isNow && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full animate-pulse">
                    NOW
                  </span>
                )}
                {event.is_cancelled && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                    CANCELLED
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatEventTime(event.starts_at, timezone)}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {event.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right side: RSVP counts and expand */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:shrink-0">
            {!isPublicView && !event.is_cancelled && hasPermission('events_create') &&
              (event.created_by === userId || hasPermission('events_edit_any')) && (
              <button
                type="button"
                disabled={reposting}
                onClick={async (e) => {
                  e.stopPropagation();
                  setReposting(true);
                  try {
                    const result = await postEventNotification(event.id, true);
                    showToast(result.skipped ? 'info' : 'success', t(result.skipped ? 'webhooks.skippedNotice' : 'webhooks.reposted'));
                  } catch (error) {
                    console.error('Discord repost failed:', error);
                    showToast('error', t('webhooks.repostFailed'), 10000);
                  } finally {
                    setReposting(false);
                  }
                }}
                className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 cursor-pointer"
              >
                {t(reposting ? 'webhooks.sending' : 'webhooks.repost')}
              </button>
            )}
            {/* Copy link button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyEventLink();
              }}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded cursor-pointer transition-colors"
              title="Copy event link"
              aria-label="Copy event link"
            >
              <LinkIcon size={16} />
            </button>
            
            {/* Attendee count */}
            <div className="text-sm text-slate-400 flex items-center gap-1">
              <Users size={14} />
              <span className="text-green-400">{event.rsvp_counts.attending}</span>
              {event.rsvp_counts.maybe > 0 && (
                <span className="text-yellow-400">+{event.rsvp_counts.maybe}?</span>
              )}
              {event.max_attendees && (
                <span className="text-slate-500">/{event.max_attendees}</span>
              )}
            </div>

            {/* Relative time */}
            <span className="text-xs text-slate-500 hidden sm:block">
              {getRelativeTime(event.starts_at)}
            </span>

            {/* Expand indicator */}
            <div className="text-slate-400">
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {/* Description */}
          {event.description && (
            <p className="text-slate-300 text-sm">{event.description}</p>
          )}

          {/* Time details */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Clock size={14} />
              <span>Starts: {formatTime(event.starts_at, timezone)}</span>
              {event.ends_at && (
                <span>- Ends: {formatTime(event.ends_at, timezone)}</span>
              )}
            </div>
          </div>

          {!isPublicView && <EventClassRoster event={event} />}

          {/* Role Requirements & Roster */}
          {showRoleComposition && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Role Composition</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(eventRoles).map(([roleKey, roleConfig]) => {
                  const role = roleKey as EventRole;
                  
                  // Skip individual DPS roles if combined
                  if (event.allow_combined_dps && (role === 'ranged_dps' || role === 'melee_dps')) {
                    return null;
                  }
                  
                  const fields = EVENT_ROLE_FIELDS[role];
                  const minimum = event[fields.min];
                  const maximum = event[fields.max];
                  if (!isWow && minimum === 0 && maximum == null) return null;
                  
                  const roleCounts = event.role_counts?.[role] || { attending: 0, maybe: 0 };
                  const attending = roleCounts.attending;
                  const maybe = roleCounts.maybe;
                  const total = attending + maybe;
                  const isMinimumMet = minimum > 0 && total >= minimum;
                  const isAtMax = maximum !== null && total >= maximum;
                  
                  // Get RSVPs for this role (both member and guest)
                  const roleRsvps = event.rsvps?.filter(rsvp => 
                    getEventRoleForGame(rsvp.role, event.game_slug) === role &&
                    (rsvp.status === 'attending' || rsvp.status === 'maybe')
                  ) || [];
                  
                  // Get guest RSVPs for this role
                  const roleGuestRsvps = event.guest_rsvps?.filter(guest => 
                    getEventRoleForGame(guest.role, event.game_slug) === role &&
                    (guest.status === 'attending' || guest.status === 'maybe')
                  ) || [];
                  
                  // Format the count display
                  let countDisplay;
                  if (minimum > 0 && maximum !== null) {
                    countDisplay = `${total}/${minimum}/${maximum}`;
                  } else if (minimum > 0) {
                    countDisplay = `${total}/${minimum}+`;
                  } else if (maximum !== null) {
                    countDisplay = `${total}/${maximum}`;
                  } else {
                    countDisplay = `${total}`;
                  }
                  
                  return (
                    <div 
                      key={role}
                      className={`bg-slate-800/50 rounded-lg p-3 space-y-2 border transition-all ${
                        isAtMax ? 'border-red-500/50' :
                        isMinimumMet ? 'border-green-500/50' : 'border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{roleConfig.icon}</span>
                          <span className="text-sm font-medium" style={{ color: roleConfig.color }}>
                            {roleConfig.nameKey ? t(roleConfig.nameKey) : roleConfig.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold ${
                            isAtMax ? 'text-red-400' :
                            isMinimumMet ? 'text-green-400' : 'text-slate-400'
                          }`}>
                            {countDisplay}
                          </span>
                          {isAtMax && (
                            <span className="text-xs text-red-400" title="Role is full">🔒</span>
                          )}
                          {isMinimumMet && !isAtMax && (
                            <Check size={14} className="text-green-400" />
                          )}
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div 
                          className="h-1.5 rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, (total / (maximum || minimum || 1)) * 100)}%`,
                            backgroundColor: isAtMax ? '#ef4444' : roleConfig.color
                          }}
                        />
                      </div>
                      
                      {/* List of signups - hide names on public view, show counts instead */}
                      {!isPublicView && (roleRsvps.length > 0 || roleGuestRsvps.length > 0) && (
                        <div className="text-xs space-y-1">
                          {roleRsvps.map((rsvp, idx) => (
                            <div 
                              key={`member-${idx}`}
                              className="flex items-center gap-1.5 text-slate-300"
                            >
                              {rsvp.status === 'attending' ? (
                                <Check size={12} className="text-green-400" />
                              ) : (
                                <HelpCircle size={12} className="text-yellow-400" />
                              )}
                              <span className="truncate">
                                {formatAttendeeName(rsvp)}
                              </span>
                            </div>
                          ))}
                          {roleGuestRsvps.map((guest, idx) => (
                            <div 
                              key={`guest-${idx}`}
                              className="flex items-center gap-1.5 text-slate-400 italic"
                            >
                              {guest.status === 'maybe'
                                ? <HelpCircle size={12} className="text-yellow-400" />
                                : <Check size={12} className="text-blue-400" />}
                              <span className="truncate">
                                {guest.guest_name}
                                <span className="text-slate-500 text-xs ml-1">(guest)</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* On public view, show counts without names - always show even if 0 */}
                      {isPublicView && (
                        <div className="text-xs space-y-1">
                          <div className="text-slate-300">
                            <span className="font-medium text-green-400">{roleRsvps.filter(r => r.status === 'attending').length}</span>
                            <span className="text-slate-400 mx-1">confirmed</span>
                            {roleRsvps.filter(r => r.status === 'maybe').length > 0 && (
                              <>
                                <span className="font-medium text-yellow-400">{roleRsvps.filter(r => r.status === 'maybe').length}</span>
                                <span className="text-slate-400">tentative</span>
                              </>
                            )}
                          </div>
                          {roleGuestRsvps.length > 0 && (
                            <div className="text-slate-400 italic">
                              <span className="font-medium text-blue-400">
                                {roleGuestRsvps.filter(g => g.status === 'attending').length}
                              </span>
                              <span className="text-slate-400 mx-1">guest confirmed</span>
                              {roleGuestRsvps.filter(g => g.status === 'maybe').length > 0 && (
                                <>
                                  <span className="font-medium text-blue-300">
                                    {roleGuestRsvps.filter(g => g.status === 'maybe').length}
                                  </span>
                                  <span className="text-slate-400 mx-1">guest tentative</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Combined DPS card if enabled */}
                {event.allow_combined_dps && (isWow || event.ranged_dps_min > 0 || event.melee_dps_min > 0 || event.combined_dps_max != null) && (
                  (() => {
                    const combinedMin = (event.ranged_dps_min || 0) + (event.melee_dps_min || 0);
                    const combinedMax = event.combined_dps_max;
                    
                    const rangedCounts = event.role_counts?.ranged_dps || { attending: 0, maybe: 0 };
                    const meleeCounts = event.role_counts?.melee_dps || { attending: 0, maybe: 0 };
                    const combinedAttending = rangedCounts.attending + meleeCounts.attending;
                    const combinedMaybe = rangedCounts.maybe + meleeCounts.maybe;
                    const combinedTotal = combinedAttending + combinedMaybe;
                    
                    const isMinimumMet = combinedMin > 0 && combinedTotal >= combinedMin;
                    const isAtMax = combinedMax !== null && combinedTotal >= combinedMax;
                    
                    // Get combined RSVPs
                    const combinedRsvps = (event.rsvps || []).filter(rsvp => 
                      (rsvp.role === 'ranged_dps' || rsvp.role === 'melee_dps') &&
                      (rsvp.status === 'attending' || rsvp.status === 'maybe')
                    );
                    
                    // Get combined guest RSVPs
                    const combinedGuestRsvps = (event.guest_rsvps || []).filter(guest =>
                      (guest.role === 'ranged_dps' || guest.role === 'melee_dps') &&
                      (guest.status === 'attending' || guest.status === 'maybe')
                    );
                    
                    let countDisplay;
                    if (combinedMin > 0 && combinedMax !== null) {
                      countDisplay = `${combinedTotal}/${combinedMin}/${combinedMax}`;
                    } else if (combinedMin > 0) {
                      countDisplay = `${combinedTotal}/${combinedMin}+`;
                    } else if (combinedMax !== null) {
                      countDisplay = `${combinedTotal}/${combinedMax}`;
                    } else {
                      countDisplay = `${combinedTotal}`;
                    }
                    
                    return (
                      <div 
                        key="combined_dps"
                        className={`bg-slate-800/50 rounded-lg p-3 space-y-2 border transition-all sm:col-span-2 lg:col-span-3 ${
                          isAtMax ? 'border-red-500/50' :
                          isMinimumMet ? 'border-green-500/50' : 'border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🗡️</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-purple-400">
                                DPS (Combined)
                              </span>
                              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                                Ranged + Melee
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-semibold ${
                              isAtMax ? 'text-red-400' :
                              isMinimumMet ? 'text-green-400' : 'text-slate-400'
                            }`}>
                              {countDisplay}
                            </span>
                            {isAtMax && (
                              <span className="text-xs text-red-400" title="Role is full">🔒</span>
                            )}
                            {isMinimumMet && !isAtMax && (
                              <Check size={14} className="text-green-400" />
                            )}
                          </div>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-slate-700 rounded-full h-1.5">
                          <div 
                            className="h-1.5 rounded-full transition-all"
                            style={{ 
                              width: `${Math.min(100, (combinedTotal / (combinedMax || combinedMin || 1)) * 100)}%`,
                              backgroundColor: isAtMax ? '#ef4444' : '#a855f7'
                            }}
                          />
                        </div>
                        
                        {/* List of signups */}
                        {!isPublicView && (combinedRsvps.length > 0 || combinedGuestRsvps.length > 0) && (
                          <div className="text-xs space-y-1">
                            {combinedRsvps.map((rsvp, idx) => (
                              <div 
                                key={`combined-member-${idx}`}
                                className="flex items-center gap-1.5 text-slate-300"
                              >
                                {rsvp.status === 'attending' ? (
                                  <Check size={12} className="text-green-400" />
                                ) : (
                                  <HelpCircle size={12} className="text-yellow-400" />
                                )}
                                <span className="text-xs text-slate-500">{rsvp.role === 'ranged_dps' ? '(Ranged)' : '(Melee)'}</span>
                                <span className="truncate">
                                  {formatAttendeeName(rsvp)}
                                </span>
                              </div>
                            ))}
                            {combinedGuestRsvps.map((guest, idx) => (
                              <div 
                                key={`combined-guest-${idx}`}
                                className="flex items-center gap-1.5 text-slate-400 italic"
                              >
                                {guest.status === 'maybe'
                                  ? <HelpCircle size={12} className="text-yellow-400" />
                                  : <Check size={12} className="text-blue-400" />}
                                <span className="text-xs text-slate-500">{guest.role === 'ranged_dps' ? '(Ranged)' : '(Melee)'}</span>
                                <span className="truncate">
                                  {guest.guest_name}
                                  <span className="text-slate-500 text-xs ml-1">(guest)</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Public view combined counts */}
                        {isPublicView && (
                          <div className="text-xs space-y-1">
                            <div className="text-slate-300">
                              <span className="font-medium text-green-400">{combinedRsvps.filter(r => r.status === 'attending').length}</span>
                              <span className="text-slate-400 mx-1">confirmed</span>
                              {combinedRsvps.filter(r => r.status === 'maybe').length > 0 && (
                                <>
                                  <span className="font-medium text-yellow-400">{combinedRsvps.filter(r => r.status === 'maybe').length}</span>
                                  <span className="text-slate-400">tentative</span>
                                </>
                              )}
                            </div>
                            {combinedGuestRsvps.length > 0 && (
                              <div className="text-slate-400 italic">
                                <span className="font-medium text-blue-400">
                                  {combinedGuestRsvps.filter(g => g.status === 'attending').length}
                                </span>
                                <span className="text-slate-400 mx-1">guest confirmed</span>
                                {combinedGuestRsvps.filter(g => g.status === 'maybe').length > 0 && (
                                  <>
                                    <span className="font-medium text-blue-300">
                                      {combinedGuestRsvps.filter(g => g.status === 'maybe').length}
                                    </span>
                                    <span className="text-slate-400 mx-1">guest tentative</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* RSVP buttons */}
          {!event.is_cancelled && !isPast && (
            <div className="space-y-3">
              {/* For public events with anonymous users, show anonymous signup only */}
              {event.is_public && !userId && (
                <AnonymousGuestForm 
                  eventId={event.id}
                  gameSlug={event.game_slug}
                  onSuccess={() => {
                    // Could refresh the event here
                  }}
                />
              )}

              {/* Admin mode toggle - only show for admins */}
              {isAdmin && (
                <div className="p-2 bg-slate-800/50 border border-amber-500/30 rounded-lg">
                  <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={adminMode}
                      onChange={(e) => {
                        setAdminMode(e.target.checked);
                        setAdminTargetUserId(null);
                      }}
                      className="cursor-pointer"
                    />
                    <span>Respond on behalf of member</span>
                  </label>
                  
                  {/* Show member selector when admin mode is on */}
                  {adminMode && uniqueUsers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uniqueUsers.map((user) => (
                        <button
                          key={user.userId}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdminTargetUserId(adminTargetUserId === user.userId ? null : user.userId);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            adminTargetUserId === user.userId
                              ? 'ring-2 ring-offset-2 ring-offset-slate-900 bg-amber-600/30 text-amber-300'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          }`}
                        >
                          {user.characterName}
                          {' '}<GuildRankBadge characterId={user.characterId} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Character selector - show if user has characters (or admin selected a target) */}
              {(userCharacters.length > 0 || (adminMode && adminTargetUserId)) && (
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Attending as
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      // If admin mode is on, show target user's characters; otherwise show current user's
                      const charsToShow = adminMode && adminTargetUserId 
                        ? characters.filter(c => c.user_id === adminTargetUserId)
                        : userCharacters;
                      const mainChar = charsToShow.find(c => c.is_main);
                      
                      return charsToShow.map((character) => (
                        <button
                          key={character.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCharacterId(selectedCharacterId === character.id ? null : character.id);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            selectedCharacterId === character.id || (!selectedCharacterId && mainChar?.id === character.id)
                              ? 'ring-2 ring-offset-2 ring-offset-slate-900 bg-slate-700 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          {character.name}
                          <GuildRankBadge characterId={character.id} />
                          {character.is_main && <span className="text-xs text-yellow-400">★</span>}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}
              
              {/* Role selector - show if any roles are needed */}
              {showRoleComposition && (
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    RSVP with role <span className="text-red-400">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(eventRoles).map(([roleKey, roleConfig]) => {
                      const role = roleKey as EventRole;
                      const fields = EVENT_ROLE_FIELDS[role];
                      const minimum = event[fields.min];
                      const isCombinedDps = event.allow_combined_dps && (role === 'ranged_dps' || role === 'melee_dps');
                      const maximum = isCombinedDps ? event.combined_dps_max : event[fields.max];
                      if (!isWow && !isCombinedDps && minimum === 0 && maximum == null) return null;
                      
                      // Check if this role is full
                      const roleCounts = event.role_counts?.[role] || { attending: 0, maybe: 0 };
                      const total = isCombinedDps
                        ? event.role_counts.ranged_dps.attending + event.role_counts.ranged_dps.maybe +
                          event.role_counts.melee_dps.attending + event.role_counts.melee_dps.maybe
                        : roleCounts.attending + roleCounts.maybe;
                      const isRoleFull = maximum !== null && total >= maximum;
                      const userInThisRole = (userRole === role ||
                        (isCombinedDps && (userRole === 'ranged_dps' || userRole === 'melee_dps'))) &&
                        (userRsvp?.status === 'attending' || userRsvp?.status === 'maybe');
                      
                      const isSelected = selectedRole === role;
                      
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isRoleFull || userInThisRole) {
                              if (isSelected) {
                                // Deselect the role
                                setSelectedRole(null);
                              } else {
                                // Select the role and automatically RSVP as attending
                                setSelectedRole(role);
                                handleRsvpClick('attending', role);
                              }
                            }
                          }}
                          disabled={isRoleFull && !userInThisRole}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            isRoleFull && !userInThisRole ? 'opacity-50 cursor-not-allowed bg-slate-900 text-slate-500' :
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-offset-slate-900 cursor-pointer'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
                          }`}
                          style={isSelected && !isRoleFull ? { 
                            backgroundColor: roleConfig.color + '30',
                            color: roleConfig.color
                          } : undefined}
                        >
                          <span>{roleConfig.icon}</span>
                          <span>{roleConfig.nameKey ? t(roleConfig.nameKey) : roleConfig.name}</span>
                          {isRoleFull && !userInThisRole && <span className="text-xs ml-1">(Full)</span>}
                          {isSelected && <Check size={14} className="ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* General RSVP options */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  {showRoleComposition
                    ? 'Or respond:'
                    : 'RSVP:'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {/* Only show attending without role if no roles are needed */}
                  {!showRoleComposition && (
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleRsvpClick('attending', null);
                      }}
                      disabled={(isFull && userRsvp?.status !== 'attending') || isRsvpLoading}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        userRsvp?.status === 'attending' && !userRsvp?.role
                          ? 'ring-2 ring-offset-2 ring-offset-slate-900 text-green-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      } ${(isFull && userRsvp?.status !== 'attending') || isRsvpLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={userRsvp?.status === 'attending' && !userRsvp?.role ? { 
                        backgroundColor: '#22c55e30'
                      } : undefined}
                    >
                      <Check size={14} />
                      {isRsvpLoading ? 'Updating...' : 'Attending'}
                      {isFull && userRsvp?.status !== 'attending' && ' (Full)'}
                    </button>
                  )}
                  
                  {/* Show attending with role button if roles are needed and a role is selected */}
                  {showRoleComposition && selectedRole && (
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleRsvpClick('attending', selectedRole);
                      }}
                      disabled={isRsvpLoading}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        userRsvp?.status === 'attending' && userRsvp?.role === selectedRole
                          ? 'ring-2 ring-offset-2 ring-offset-slate-900 text-green-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      } ${isRsvpLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={userRsvp?.status === 'attending' && userRsvp?.role === selectedRole ? { 
                        backgroundColor: '#22c55e30'
                      } : undefined}
                    >
                      <Check size={14} />
                      {isRsvpLoading ? 'Updating...' : 'Attending'}
                    </button>
                  )}
                  
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleRsvpClick('maybe', selectedRole);
                    }}
                    disabled={isRsvpLoading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      userRsvp?.status === 'maybe'
                        ? 'ring-2 ring-offset-2 ring-offset-slate-900 text-yellow-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    } ${isRsvpLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={userRsvp?.status === 'maybe' ? { 
                      backgroundColor: '#eab30830'
                    } : undefined}
                  >
                    <HelpCircle size={14} />
                    {isRsvpLoading ? 'Updating...' : 'Maybe'}
                  </button>
                  
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleRsvpClick('declined', null);
                    }}
                    disabled={isRsvpLoading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      userRsvp?.status === 'declined'
                        ? 'ring-2 ring-offset-2 ring-offset-slate-900 text-red-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    } ${isRsvpLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={userRsvp?.status === 'declined' ? { 
                      backgroundColor: '#ef444430'
                    } : undefined}
                  >
                    <X size={14} />
                    {isRsvpLoading ? 'Updating...' : 'Decline'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Event actions based on permissions */}
          {loading ? (
            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          ) : (canEditEvent || canDeleteEvent || (onCancel && !event.is_cancelled)) && (
            <div className="flex gap-2 pt-2 border-t border-slate-800">
              {canEditEvent && onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg cursor-pointer"
                >
                  {t('common.edit')}
                </button>
              )}
              {onCancel && !event.is_cancelled && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancel(); }}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg cursor-pointer"
                >
                  {t('event.cancelEvent')}
                </button>
              )}
              {canDeleteEvent && onDelete && (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setDeleteConfirmOpen(true);
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg cursor-pointer flex items-center gap-1"
                  title={t('event.deleteEvent')}
                >
                  <Trash2 size={14} />
                  {t('event.deleteEvent')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          if (onDelete) onDelete();
        }}
        title="Delete Event"
        message={t('event.confirmDeleteEvent', { title: event.title })}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
