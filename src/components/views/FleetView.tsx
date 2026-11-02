'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Ship, Plus, Trash2, Loader2, AlertCircle,
  Sword, Shield, Package, Wrench, Search, Rocket, Heart,
  Zap, Users, Plane, Target, Radio, Pickaxe, Boxes, Truck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CharacterWithProfessions } from '@/lib/types';
import { getClientAuthStack } from '@/lib/authStack';
import shipsData from '@/config/games/star-citizen-ships.json';
import { getManufacturerLogo } from '@/config/games/star-citizen-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUBSCRIBER_COLORS } from '@/games/starcitizen/config/subscriber-ships';
import { CenturionStarSVG, ImperatorStarSVG } from '@/components/game-specific/SubscriberIcons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ShipData {
  id: string;
  name: string;
  manufacturer: string;
  role: string;
  size: string;
  cargo: number;
  crew: {
    min: number;
    max: number;
  };
  productionStatus: string;
  image?: string;
}

interface CharacterShip {
  id: string;
  character_id: string;
  ship_id: string;
  ownership_type: 'pledged' | 'in-game' | 'loaner' | 'subscriber';
  notes?: string | null;
  created_at: string;
}

interface FleetViewProps {
  characters: CharacterWithProfessions[];
  userId: string;
  canManage: boolean;
  groupId: string;
}

// Helper functions for role categorization
function normalizeRole(role: string): string {
  const roleLower = role.toLowerCase();
  
  if (roleLower.includes('fighter')) return 'Fighter';
  if (roleLower.includes('bomber')) return 'Bomber';
  if (roleLower.includes('gunship') || roleLower.includes('gun ship')) return 'Gunship';
  if (roleLower.includes('interdiction') || roleLower.includes('interdictor')) return 'Interdiction';
  if (roleLower.includes('stealth')) return 'Stealth';
  if (roleLower.includes('assault') || roleLower.includes('boarding')) return 'Assault';
  if (roleLower.includes('patrol')) return 'Patrol';
  if (roleLower.includes('carrier')) return 'Carrier';
  if (roleLower.includes('frigate')) return 'Frigate';
  if (roleLower.includes('destroyer')) return 'Destroyer';
  if (roleLower.includes('corvette')) return 'Corvette';
  if (roleLower.includes('freight') || roleLower.includes('cargo')) return 'Cargo';
  if (roleLower.includes('mining') || roleLower.includes('prospecting')) return 'Mining';
  if (roleLower.includes('salvage')) return 'Salvage';
  if (roleLower.includes('refinery') || roleLower.includes('refining')) return 'Refinery';
  if (roleLower.includes('construction')) return 'Construction';
  if (roleLower.includes('medical') || roleLower.includes('ambulance')) return 'Medical';
  if (roleLower.includes('repair')) return 'Repair';
  if (roleLower.includes('refuel')) return 'Refueling';
  if (roleLower.includes('recovery')) return 'Recovery';
  if (roleLower.includes('exploration') || roleLower.includes('pathfinder') || roleLower.includes('expedition')) return 'Exploration';
  if (roleLower.includes('recon') || roleLower.includes('reconnaissance')) return 'Reconnaissance';
  if (roleLower.includes('science')) return 'Science';
  if (roleLower.includes('data') || roleLower.includes('reporting')) return 'Data';
  if (roleLower.includes('transport') || roleLower.includes('passenger') || roleLower.includes('dropship')) return 'Transport';
  if (roleLower.includes('touring') || roleLower.includes('luxury')) return 'Luxury';
  if (roleLower.includes('racing')) return 'Racing';
  if (roleLower.includes('starter') || roleLower.includes('generalist')) return 'Starter';
  if (roleLower.includes('military') && roleLower.includes('vehicle')) return 'Military Vehicle';
  if (roleLower.includes('combat') && roleLower.includes('vehicle')) return 'Combat Vehicle';
  if (roleLower.includes('vehicle')) return 'Ground Vehicle';
  if (roleLower.includes('multi') || roleLower.includes('modular')) return 'Multi-Role';
  if (roleLower.includes('combat')) return 'Combat';
  
  return role.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function formatSize(size: string): string {
  if (size === 'vehicle') return 'Vehicle';
  return size.charAt(0).toUpperCase() + size.slice(1);
}

function getRoleIcon(role: string) {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('fighter') || roleLower.includes('combat') || roleLower.includes('gun')) return Sword;
  if (roleLower.includes('bomber') || roleLower.includes('assault')) return Rocket;
  if (roleLower.includes('freight') || roleLower.includes('cargo')) return Package;
  if (roleLower.includes('mining') || roleLower.includes('prospecting')) return Pickaxe;
  if (roleLower.includes('medical') || roleLower.includes('ambulance')) return Heart;
  if (roleLower.includes('repair') || roleLower.includes('construction')) return Wrench;
  if (roleLower.includes('salvage') || roleLower.includes('recovery')) return Boxes;
  if (roleLower.includes('exploration') || roleLower.includes('pathfinder') || roleLower.includes('recon')) return Search;
  if (roleLower.includes('transport') || roleLower.includes('passenger') || roleLower.includes('dropship')) return Users;
  if (roleLower.includes('refuel') || roleLower.includes('refining')) return Zap;
  if (roleLower.includes('stealth') || roleLower.includes('interdiction')) return Target;
  if (roleLower.includes('racing')) return Plane;
  if (roleLower.includes('data') || roleLower.includes('reporting')) return Radio;
  if (roleLower.includes('capital') || roleLower.includes('carrier') || roleLower.includes('frigate') || roleLower.includes('destroyer') || roleLower.includes('corvette')) return Shield;
  if (roleLower.includes('starter') || roleLower.includes('generalist')) return Ship;
  if (roleLower.includes('military') || roleLower.includes('vehicle')) return Truck;
  return Ship;
}

function getRoleColor(role: string) {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('fighter') || roleLower.includes('combat') || roleLower.includes('gun')) return 'text-red-400 bg-red-500/10';
  if (roleLower.includes('bomber') || roleLower.includes('assault')) return 'text-orange-400 bg-orange-500/10';
  if (roleLower.includes('freight') || roleLower.includes('cargo')) return 'text-yellow-400 bg-yellow-500/10';
  if (roleLower.includes('mining') || roleLower.includes('prospecting')) return 'text-amber-400 bg-amber-500/10';
  if (roleLower.includes('medical') || roleLower.includes('ambulance')) return 'text-pink-400 bg-pink-500/10';
  if (roleLower.includes('repair') || roleLower.includes('construction')) return 'text-blue-400 bg-blue-500/10';
  if (roleLower.includes('salvage') || roleLower.includes('recovery')) return 'text-slate-400 bg-slate-500/10';
  if (roleLower.includes('exploration') || roleLower.includes('pathfinder') || roleLower.includes('recon')) return 'text-teal-400 bg-teal-500/10';
  if (roleLower.includes('transport') || roleLower.includes('passenger') || roleLower.includes('dropship')) return 'text-indigo-400 bg-indigo-500/10';
  if (roleLower.includes('refuel') || roleLower.includes('refining')) return 'text-violet-400 bg-violet-500/10';
  if (roleLower.includes('stealth') || roleLower.includes('interdiction')) return 'text-purple-400 bg-purple-500/10';
  if (roleLower.includes('racing')) return 'text-fuchsia-400 bg-fuchsia-500/10';
  if (roleLower.includes('data') || roleLower.includes('reporting')) return 'text-sky-400 bg-sky-500/10';
  if (roleLower.includes('capital') || roleLower.includes('carrier') || roleLower.includes('frigate') || roleLower.includes('destroyer') || roleLower.includes('corvette')) return 'text-emerald-400 bg-emerald-500/10';
  if (roleLower.includes('starter') || roleLower.includes('generalist')) return 'text-cyan-400 bg-cyan-500/10';
  if (roleLower.includes('military') || roleLower.includes('vehicle')) return 'text-lime-400 bg-lime-500/10';
  return 'text-slate-400 bg-slate-500/10';
}

// Detect if ship is a subscriber perk based on ownership type or notes
function getOwnershipBadge(ship: CharacterShip) {
  // Handle new subscriber ownership type
  if (ship.ownership_type === 'subscriber') {
    // Extract tier from notes like "centurion subscriber perk (2026-01)"
    const match = ship.notes?.match(/(centurion|imperator)\s+subscriber/i);
    if (match) {
      const tier = match[1].toLowerCase() as 'centurion' | 'imperator';
      const colors = SUBSCRIBER_COLORS[tier];
      return {
        label: tier.charAt(0).toUpperCase() + tier.slice(1),
        bgColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.primary,
        isBadge: true,
      };
    }
    // Fallback if notes don't match expected format
    return {
      label: 'Subscriber',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-400',
      isBadge: false,
    };
  }
  
  // Also check for legacy loaner ships with subscriber notes
  if (ship.ownership_type === 'loaner' && ship.notes?.includes('subscriber')) {
    const match = ship.notes.match(/(centurion|imperator)\s+subscriber/i);
    if (match) {
      const tier = match[1].toLowerCase() as 'centurion' | 'imperator';
      const colors = SUBSCRIBER_COLORS[tier];
      return {
        label: tier.charAt(0).toUpperCase() + tier.slice(1),
        bgColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.primary,
        isBadge: true,
      };
    }
  }

  const ownershipColor = {
    'pledged': { bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', textColor: 'text-green-400' },
    'in-game': { bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', textColor: 'text-cyan-400' },
    'loaner': { bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', textColor: 'text-blue-400' },
  }[ship.ownership_type];

  const ownershipLabel = {
    'pledged': 'Pledged',
    'in-game': 'In-Game',
    'loaner': 'Loaner',
  }[ship.ownership_type];

  return {
    label: ownershipLabel,
    bgColor: ownershipColor.bgColor,
    borderColor: ownershipColor.borderColor,
    textColor: ownershipColor.textColor,
    isBadge: false,
  };
}

export function FleetView({ characters, userId, canManage, groupId }: FleetViewProps) {
  const { t } = useLanguage();
  const [characterShips, setCharacterShips] = useState<Record<string, CharacterShip[]>>({});
  const [fleetCharacters, setFleetCharacters] = useState<CharacterWithProfessions[]>(characters);
  const [ownCharacterIds, setOwnCharacterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedShip, setSelectedShip] = useState<string | null>(null);
  const [ownershipType, setOwnershipType] = useState<'pledged' | 'in-game' | 'loaner' | 'subscriber'>('pledged');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shipIdToDelete, setShipIdToDelete] = useState<string | null>(null);
  const characterIdsKey = useMemo(() => characters.map((char) => char.id).join('|'), [characters]);

  const playerCharacters = ownCharacterIds.length > 0
    ? fleetCharacters.filter((c) => ownCharacterIds.includes(c.id))
    : fleetCharacters.filter((c) => c.user_id === userId);
  const hasAnyShipsInDataset = Object.values(characterShips).some((ships) => ships.length > 0);
  const visibleCharacters = playerCharacters.length > 0
    ? playerCharacters
    : fleetCharacters.filter((char) => (characterShips[char.id] || []).length > 0);
  const usingOwnershipFallback = playerCharacters.length === 0 && visibleCharacters.length > 0;

  const loadCharacterShips = async () => {
    setLoading(true);
    setError(null);
    try {
      if (groupId) {
        try {
          let headers: HeadersInit | undefined;
          if (getClientAuthStack() !== 'v2') {
            const session = await supabase.auth.getSession();
            const accessToken = session.data.session?.access_token;
            if (!accessToken) {
              throw new Error('Missing Supabase access token for fleet overview');
            }
            headers = { authorization: `Bearer ${accessToken}` };
          }

          const response = await fetch(`/api/group/ships-overview?group_id=${groupId}`, {
            headers,
            credentials: 'include',
          });

          if (response.ok) {
            const result = await response.json();
            const overviewCharacters = (result.characters || []) as CharacterWithProfessions[];
            const overviewShips = (result.ships || []) as CharacterShip[];
            const overviewOwnCharacterIds = (result.ownCharacterIds || []) as string[];
            const sourceCharacters = overviewCharacters.length > 0 ? overviewCharacters : characters;

            const shipsByCharacter: Record<string, CharacterShip[]> = {};
            sourceCharacters.forEach(char => {
              shipsByCharacter[char.id] = [];
            });

            overviewShips.forEach(ship => {
              if (shipsByCharacter[ship.character_id]) {
                shipsByCharacter[ship.character_id].push(ship);
              }
            });

            setFleetCharacters(sourceCharacters);
            setOwnCharacterIds(overviewOwnCharacterIds);
            setCharacterShips(shipsByCharacter);
            setLoading(false);
            return;
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Fleet ships overview API error:', response.status, errorData);
          }
        } catch (apiError) {
          console.error('Fleet ships overview API fetch error:', apiError);
        }
      }

      const shipsByCharacter: Record<string, CharacterShip[]> = {};
      characters.forEach(char => {
        shipsByCharacter[char.id] = [];
      });

      if (characters.length > 0) {
        const { data, error: fetchError } = await supabase
          .from('character_ships')
          .select('*')
          .in('character_id', characters.map(c => c.id));

        if (fetchError) {
          console.error('Error loading ships:', fetchError);
          throw fetchError;
        }

        if (data) {
          data.forEach(ship => {
            if (shipsByCharacter[ship.character_id]) {
              shipsByCharacter[ship.character_id].push(ship);
            }
          });
        }
      }
      setFleetCharacters(characters);
      setOwnCharacterIds([]);
      setCharacterShips(shipsByCharacter);
    } catch (err) {
      console.error('Failed to load ships:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ships');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timerId = setTimeout(() => {
      void loadCharacterShips();
    }, 0);

    return () => clearTimeout(timerId);
  }, [groupId, characterIdsKey]);

  const openAddShipForm = () => {
    if (!selectedCharacter && playerCharacters.length > 0) {
      const mainCharacter = playerCharacters.find(c => c.is_main);
      if (mainCharacter) {
        setSelectedCharacter(mainCharacter.id);
      } else if (playerCharacters.length === 1) {
        setSelectedCharacter(playerCharacters[0].id);
      }
    }
    setShowAddForm(true);
  };

  const getShipData = (shipId: string): ShipData | undefined => {
    return shipsData.ships.find(s => s.id === shipId);
  };

  const handleAddShip = async () => {
    if (!selectedCharacter || !selectedShip) {
      setError('Please select a character and ship');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (getClientAuthStack() === 'v2') {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        const response = await fetch('/api/group/ships', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            group_id: groupId,
            character_id: selectedCharacter,
            ship_id: selectedShip,
            ownership_type: ownershipType,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          throw new Error(payload.details || payload.error || `Failed to add ship (${response.status})`);
        }
      } else {
        const { error: insertError } = await supabase
          .from('character_ships')
          .insert({
            character_id: selectedCharacter,
            ship_id: selectedShip,
            ownership_type: ownershipType,
          });

        if (insertError) throw insertError;
      }

      await loadCharacterShips();
      setShowAddForm(false);
      setSelectedCharacter(null);
      setSelectedShip(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add ship');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShip = async (shipId: string) => {
    setShipIdToDelete(shipId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!shipIdToDelete) return;

    setDeleteConfirmOpen(false);
    setError(null);
    try {
      if (getClientAuthStack() === 'v2') {
        const response = await fetch('/api/group/ships', {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            group_id: groupId,
            ship_record_id: shipIdToDelete,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          throw new Error(payload.details || payload.error || `Failed to delete ship (${response.status})`);
        }
      } else {
        const { error: deleteError } = await supabase
          .from('character_ships')
          .delete()
          .eq('id', shipIdToDelete);

        if (deleteError) {
          console.error('Error deleting ship:', deleteError);
          throw deleteError;
        }
      }

      await loadCharacterShips();
    } catch (err) {
      console.error('Failed to delete ship:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete ship');
    } finally {
      setShipIdToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error && error.includes('relation') && error.includes('does not exist')) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ship className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white">Fleet Management</h2>
          </div>
        </div>
        <div className="flex items-start gap-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
          <p className="font-medium mb-1">{t('fleet.migrationRequired')}</p>
          <p className="text-sm text-amber-300">
            {t('fleet.migrationMessage')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // FleetView shows only the current user's characters (personal fleet management)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ship className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">
              {visibleCharacters.length > 1 ? t('fleet.titlePlural') : t('fleet.title')}
            </h2>
            <p className="text-sm text-slate-400">{t('fleet.subtitle')}</p>
          </div>
        </div>
        {canManage && !showAddForm && (
          <button
            onClick={openAddShipForm}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            {t('fleet.addShip')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {usingOwnershipFallback && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-sm">
            Showing ship-owning characters because personal ownership matching did not resolve for this session.
          </span>
        </div>
      )}

      {/* Add Ship Form */}
      {showAddForm && canManage && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">{t('fleet.addShip')}</h3>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('fleet.character')}
            </label>
            <select
              value={selectedCharacter || ''}
              onChange={(e) => setSelectedCharacter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">{t('fleet.selectCharacter')}</option>
              {playerCharacters.map(char => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('fleet.ship')}
            </label>
            <select
              value={selectedShip || ''}
              onChange={(e) => setSelectedShip(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">{t('fleet.selectShip')}</option>
              {shipsData.ships.filter(ship => {
                // Filter out ships already added for the selected character with the same ownership type
                if (!selectedCharacter) return true;
                const existingShips = characterShips[selectedCharacter] || [];
                return !existingShips.some(cs => cs.ship_id === ship.id && cs.ownership_type === ownershipType);
              }).map(ship => (
                <option key={ship.id} value={ship.id}>
                  {ship.name} ({ship.manufacturer}) - {ship.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('fleet.ownershipType')}
            </label>
            <select
              value={ownershipType}
              onChange={(e) => setOwnershipType(e.target.value as 'pledged' | 'in-game' | 'loaner')}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="pledged">{t('fleet.pledged')}</option>
              <option value="in-game">{t('fleet.inGame')}</option>
              <option value="loaner">{t('fleet.loaner')}</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAddShip}
              disabled={saving || !selectedCharacter || !selectedShip}
              className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                'Add Ship'
              )}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setSelectedCharacter(null);
                setSelectedShip(null);
              }}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Ships by Character */}
      <div className="space-y-4">
        {visibleCharacters.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No characters found. Add a character to start managing your fleet.</p>
          </div>
        ) : (
          visibleCharacters.map(char => {
                const ships = characterShips[char.id] || [];
                return (
                  <div key={char.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                    <h4 className="font-semibold text-white mb-4">{char.name}</h4>
                    
                    {ships.length === 0 ? (
                      <p className="text-slate-400 text-sm">{t('fleet.noShipsYet')}</p>
                    ) : (
                      <div className="space-y-6">
                        {/* Ships Section */}
                        {ships.filter(s => {
                          const shipData = getShipData(s.ship_id);
                          return shipData && shipData.size !== 'vehicle';
                        }).length > 0 && (
                          <div className="space-y-3">
                            <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('fleet.shipsSection')}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {ships.filter(s => {
                                const shipData = getShipData(s.ship_id);
                                return shipData && shipData.size !== 'vehicle';
                              }).sort((a, b) => {
                                const shipA = getShipData(a.ship_id);
                                const shipB = getShipData(b.ship_id);
                                return (shipA?.name || '').localeCompare(shipB?.name || '');
                              }).map(ship => {
                                const shipData = getShipData(ship.ship_id);
                                if (!shipData) return null;

                                const badge = getOwnershipBadge(ship);
                                const isConcept = shipData.productionStatus !== 'flight-ready';
                                const RoleIcon = getRoleIcon(shipData.role);
                                const roleColor = getRoleColor(shipData.role);
                                const manufacturerLogo = getManufacturerLogo(shipData.manufacturer);
                                const isSubscriber = ship.ownership_type === 'subscriber';

                                return (
                                  <div 
                                    key={ship.id} 
                                    className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                                      isSubscriber 
                                        ? 'border-2 border-amber-500/60 bg-slate-800/70 shadow-lg shadow-amber-500/20' 
                                        : 'border border-slate-700 bg-slate-800/50'
                                    }`}
                                  >
                                    <div className={`p-2 rounded-lg ${roleColor} flex-shrink-0`}>
                                      <RoleIcon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <h5 className="font-semibold text-white truncate">{shipData.name}</h5>
                                          {isConcept && (
                                            <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded flex-shrink-0">Concept</span>
                                          )}
                                        </div>
                                        <span 
                                          className={`text-xs px-3 py-1.5 rounded border whitespace-nowrap flex items-center gap-1.5 font-semibold flex-shrink-0 ${badge.textColor} border-current ${
                                            badge.isBadge ? 'shadow-lg shadow-yellow-500/20 ring-1 ring-offset-0 ring-current' : ''
                                          }`}
                                          style={badge.isBadge ? {
                                            backgroundColor: badge.bgColor,
                                            borderColor: badge.borderColor,
                                            color: badge.textColor,
                                          } : undefined}
                                          title={ship.ownership_type === 'loaner' && ship.notes ? ship.notes : undefined}
                                        >
                                          {(badge.label === 'Centurion' || badge.label === 'Imperator') && (
                                            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                              {badge.label === 'Centurion' ? <CenturionStarSVG /> : <ImperatorStarSVG />}
                                            </div>
                                          )}
                                          <span className="leading-none">{badge.label}</span>
                                        </span>
                                      </div>
                                      {manufacturerLogo && (
                                        <div className="mb-2 flex items-center justify-center">
                                          <img 
                                            src={manufacturerLogo} 
                                            alt={shipData.manufacturer}
                                            className="h-16 w-auto object-contain brightness-0 invert opacity-100"
                                            title={shipData.manufacturer}
                                          />
                                        </div>
                                      )}
                                    
                                      <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">{t('fleet.role')}:</span>
                                          <span className="text-white">{normalizeRole(shipData.role)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">{t('fleet.size')}:</span>
                                          <span className="text-white">{formatSize(shipData.size)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">{t('fleet.crew')}:</span>
                                          <span className="text-white">{shipData.crew.min}-{shipData.crew.max}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">{t('fleet.cargo')}:</span>
                                          <span className="text-white">{shipData.cargo} SCU</span>
                                        </div>
                                      </div>
                                    </div>
                                  {canManage && (
                                      <button
                                        onClick={() => handleDeleteShip(ship.id)}
                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                        title="Remove ship"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Ground Vehicles Section */}
                        {ships.filter(s => {
                          const shipData = getShipData(s.ship_id);
                          return shipData && shipData.size === 'vehicle';
                        }).length > 0 && (
                          <div className="space-y-3">
                            <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('fleet.vehiclesSection')}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {ships.filter(s => {
                                const shipData = getShipData(s.ship_id);
                                return shipData && shipData.size === 'vehicle';                              }).sort((a, b) => {
                                const shipA = getShipData(a.ship_id);
                                const shipB = getShipData(b.ship_id);
                                return (shipA?.name || '').localeCompare(shipB?.name || '');                              }).map((ship) => {
                                const shipData = getShipData(ship.ship_id);
                                if (!shipData) return null;

                                const badge = getOwnershipBadge(ship);
                                const isConcept = shipData.productionStatus !== 'flight-ready';
                                const RoleIcon = getRoleIcon(shipData.role);
                                const roleColor = getRoleColor(shipData.role);
                                const manufacturerLogo = getManufacturerLogo(shipData.manufacturer);
                                const isSubscriber = ship.ownership_type === 'subscriber';

                                return (
                                  <div
                                    key={ship.id}
                                    className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                                      isSubscriber 
                                        ? 'border-2 border-amber-500/60 bg-slate-800/70 shadow-lg shadow-amber-500/20' 
                                        : 'border border-slate-700 bg-slate-800/50'
                                    }`}
                                  >
                                    <div className={`p-2 rounded-lg ${roleColor} flex-shrink-0`}>
                                      <RoleIcon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <h5 className="font-semibold text-white truncate">{shipData.name}</h5>
                                          {isConcept && (
                                            <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded flex-shrink-0">Concept</span>
                                          )}
                                        </div>
                                        <span 
                                          className={`text-xs px-3 py-1.5 rounded border whitespace-nowrap flex items-center gap-1.5 font-semibold flex-shrink-0 ${badge.textColor} border-current ${
                                            badge.isBadge ? 'shadow-lg shadow-yellow-500/20 ring-1 ring-offset-0 ring-current' : ''
                                          }`}
                                          style={badge.isBadge ? {
                                            backgroundColor: badge.bgColor,
                                            borderColor: badge.borderColor,
                                            color: badge.textColor,
                                          } : undefined}
                                          title={ship.ownership_type === 'loaner' && ship.notes ? ship.notes : undefined}
                                        >
                                          {(badge.label === 'Centurion' || badge.label === 'Imperator') && (
                                            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                              {badge.label === 'Centurion' ? <CenturionStarSVG /> : <ImperatorStarSVG />}
                                            </div>
                                          )}
                                          <span className="leading-none">{badge.label}</span>
                                        </span>
                                      </div>
                                      {manufacturerLogo && (
                                        <div className="mb-2 flex items-center justify-center">
                                          <img 
                                            src={manufacturerLogo} 
                                            alt={shipData.manufacturer}
                                            className="h-16 w-auto object-contain brightness-0 invert opacity-100"
                                            title={shipData.manufacturer}
                                          />
                                        </div>
                                      )}
                                      <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">{t('fleet.role')}:</span>
                                          <span className="text-white">{normalizeRole(shipData.role)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">{t('fleet.crew')}:</span>
                                          <span className="text-white">
                                            {shipData.crew.min === shipData.crew.max
                                              ? shipData.crew.min
                                              : `${shipData.crew.min}-${shipData.crew.max}`}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {canManage && (
                                      <button
                                        onClick={() => handleDeleteShip(ship.id)}
                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                        title="Remove vehicle"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
          })
        )}
      </div>

      {/* Empty State */}
      {!hasAnyShipsInDataset && !showAddForm && (
        <div className="text-center py-12">
          <Ship className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">{t('fleet.noShips')}</p>
          {canManage && (
            <button
              onClick={openAddShipForm}
              className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors cursor-pointer"
            >
              Add the first ship
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setShipIdToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Remove Ship"
        message="Are you sure you want to remove this ship? This action cannot be undone."
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
