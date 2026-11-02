'use client';

import { useState, useEffect } from 'react';
import { 
  Ship, Loader2, AlertCircle, Trash2,
  Sword, Shield, Package, Wrench, Search, Rocket, Heart,
  Zap, Users, Plane, Target, Radio, Pickaxe, Boxes, Truck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CharacterWithProfessions } from '@/lib/types';
import shipsData from '@/config/games/star-citizen-ships.json';
import { getManufacturerLogo } from '@/config/games/star-citizen-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUBSCRIBER_COLORS } from '@/games/starcitizen/config/subscriber-ships';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getClientAuthStack } from '@/lib/authStack';

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

interface ShipsViewProps {
  characters: CharacterWithProfessions[];
  userId: string;
  canManage: boolean;
  groupId: string;
  gameSlug?: string;
}

// Normalize and group ship roles into logical categories
function normalizeRole(role: string): string {
  const roleLower = role.toLowerCase();
  
  // Combat roles
  if (roleLower.includes('fighter')) return 'Fighter';
  if (roleLower.includes('bomber')) return 'Bomber';
  if (roleLower.includes('gunship') || roleLower.includes('gun ship')) return 'Gunship';
  if (roleLower.includes('interdiction') || roleLower.includes('interdictor')) return 'Interdiction';
  if (roleLower.includes('stealth')) return 'Stealth';
  if (roleLower.includes('assault') || roleLower.includes('boarding')) return 'Assault';
  if (roleLower.includes('patrol')) return 'Patrol';
  if (roleLower.includes('anti-air') || roleLower.includes('minelayer')) return 'Anti-Aircraft';
  
  // Capital ships
  if (roleLower.includes('carrier')) return 'Carrier';
  if (roleLower.includes('frigate')) return 'Frigate';
  if (roleLower.includes('destroyer')) return 'Destroyer';
  if (roleLower.includes('corvette')) return 'Corvette';
  
  // Industrial roles
  if (roleLower.includes('freight') || roleLower.includes('cargo')) return 'Cargo';
  if (roleLower.includes('mining') || roleLower.includes('prospecting')) return 'Mining';
  if (roleLower.includes('salvage')) return 'Salvage';
  if (roleLower.includes('refinery') || roleLower.includes('refining')) return 'Refinery';
  if (roleLower.includes('construction')) return 'Construction';
  
  // Support roles
  if (roleLower.includes('medical') || roleLower.includes('ambulance')) return 'Medical';
  if (roleLower.includes('repair')) return 'Repair';
  if (roleLower.includes('refuel')) return 'Refueling';
  if (roleLower.includes('recovery')) return 'Recovery';
  
  // Exploration & Science
  if (roleLower.includes('exploration') || roleLower.includes('pathfinder') || roleLower.includes('expedition')) return 'Exploration';
  if (roleLower.includes('recon') || roleLower.includes('reconnaissance')) return 'Reconnaissance';
  if (roleLower.includes('science')) return 'Science';
  if (roleLower.includes('data') || roleLower.includes('reporting')) return 'Data';
  
  // Civilian roles
  if (roleLower.includes('transport') || roleLower.includes('passenger') || roleLower.includes('dropship')) return 'Transport';
  if (roleLower.includes('touring') || roleLower.includes('luxury')) return 'Luxury';
  if (roleLower.includes('racing')) return 'Racing';
  if (roleLower.includes('starter') || roleLower.includes('generalist')) return 'Starter';
  
  // Vehicles
  if (roleLower.includes('military') && roleLower.includes('vehicle')) return 'Military Vehicle';
  if (roleLower.includes('combat') && roleLower.includes('vehicle')) return 'Combat Vehicle';
  if (roleLower.includes('vehicle')) return 'Ground Vehicle';
  
  // Multi-role or unclassified
  if (roleLower.includes('multi') || roleLower.includes('modular')) return 'Multi-Role';
  if (roleLower.includes('combat')) return 'Combat';
  
  // Return original if no match (with title casing)
  return role.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

// Get icon component for ship role
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

// Get color scheme for ship role
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

function getOwnershipBadge(ship: CharacterShip) {
  if (ship.ownership_type === 'subscriber') {
    const match = ship.notes?.match(/(centurion|imperator)\s+subscriber/i);
    if (match) {
      const tier = match[1].toLowerCase() as 'centurion' | 'imperator';
      const colors = SUBSCRIBER_COLORS[tier];
      return {
        label: tier.charAt(0).toUpperCase() + tier.slice(1),
        className: 'bg-amber-500/10',
        style: {
          backgroundColor: colors.bg,
          color: colors.primary,
        },
      };
    }

    return {
      label: 'Subscriber',
      className: 'bg-amber-500/20 text-amber-400',
      style: undefined,
    };
  }

  return {
    label:
      ship.ownership_type === 'pledged' ? 'Pledged' :
      ship.ownership_type === 'in-game' ? 'In-Game' :
      'Loaner',
    className:
      ship.ownership_type === 'pledged' ? 'bg-green-500/20 text-green-400' :
      ship.ownership_type === 'in-game' ? 'bg-cyan-500/20 text-cyan-400' :
      'bg-blue-500/20 text-blue-400',
    style: undefined,
  };
}

export function ShipsView({ characters, userId, canManage, groupId, gameSlug = 'aoc' }: ShipsViewProps) {  const { t } = useLanguage();  const [characterShips, setCharacterShips] = useState<Record<string, CharacterShip[]>>({});
  const [guildCharacters, setGuildCharacters] = useState<CharacterWithProfessions[]>(characters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shipIdToDelete, setShipIdToDelete] = useState<string | null>(null);

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
              throw new Error('Missing Supabase access token for ships overview');
            }
            headers = { authorization: `Bearer ${accessToken}` };
          }

          const response = await fetch(`/api/group/ships-overview?group_id=${groupId}&game_slug=${gameSlug}`, {
            headers,
            credentials: 'include',
          });

          if (response.ok) {
            const result = await response.json();
            const overviewCharacters = (result.characters || []) as CharacterWithProfessions[];
            const overviewShips = (result.ships || []) as CharacterShip[];

            const shipsByCharacter: Record<string, CharacterShip[]> = {};
            overviewCharacters.forEach(char => {
              shipsByCharacter[char.id] = [];
            });

            overviewShips.forEach(ship => {
              if (shipsByCharacter[ship.character_id]) {
                shipsByCharacter[ship.character_id].push(ship);
              }
            });

            setGuildCharacters(overviewCharacters);
            setCharacterShips(shipsByCharacter);
            setLoading(false);
            return;
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Ships overview API error:', response.status, errorData);
          }
        } catch (apiError) {
          console.error('Ships overview API fetch error:', apiError);
        }
      }

      // Fallback to client-side query if API is unavailable
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

      setGuildCharacters(characters);
      setCharacterShips(shipsByCharacter);
    } catch (err) {
      console.error('Failed to load ships:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ships');
    } finally {
      setLoading(false);
    }
  };

  // Load character ships
  useEffect(() => {
    const timerId = setTimeout(() => {
      void loadCharacterShips();
    }, 0);

    return () => clearTimeout(timerId);
  }, [groupId, characters, gameSlug]);

  const getShipData = (shipId: string): ShipData | undefined => {
    return shipsData.ships.find(s => s.id === shipId);
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

  // Show helpful message if there's an error (like table not existing yet)
  if (error && error.includes('relation') && error.includes('does not exist')) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ship className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white">{t('ships.overview')}</h2>
          </div>
        </div>
        <div className="flex items-start gap-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">{t('ships.migrationRequired')}</p>
            <p className="text-sm text-amber-300">
              {t('ships.migrationMessage')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ShipsView shows all guild ships grouped by ship type/role (ship-centric overview)
  // Collect all ships with their owner info
  const allShipsWithOwners = Object.values(characterShips).flat().map(ship => {
    const character = guildCharacters.find(c => c.id === ship.character_id);
    return {
      ...ship,
      characterName: character?.name || 'Unknown',
      userId: character?.user_id || 'unknown',
    };
  });

  // Group ships by type (ship vs vehicle) and role
  const shipsByRole: Record<string, typeof allShipsWithOwners> = {};
  const vehiclesByRole: Record<string, typeof allShipsWithOwners> = {};

  allShipsWithOwners.forEach(ship => {
    const shipData = getShipData(ship.ship_id);
    if (!shipData) return;

    const isVehicle = shipData.size === 'vehicle';
    const normalizedRole = normalizeRole(shipData.role);
    const targetObj = isVehicle ? vehiclesByRole : shipsByRole;

    if (!targetObj[normalizedRole]) {
      targetObj[normalizedRole] = [];
    }
    targetObj[normalizedRole].push(ship);
  });

  const allShips = allShipsWithOwners;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ship className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">{t('ships.overview')}</h2>
            <p className="text-sm text-slate-400">{t('ships.subtitle')}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-cyan-400">{allShips.length}</div>
          <div className="text-xs text-slate-400">{t('ships.totalShips')}</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Ships by Role */}
      {allShips.length === 0 ? (
        <div className="text-center py-12">
          <Ship className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No ships in the fleet yet</p>
          <p className="text-sm text-slate-500 mt-2">Ships will appear here once members add them to their characters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Ships Section */}
          {Object.keys(shipsByRole).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
                <Ship className="w-5 h-5" />
                Ships
              </h3>
              {Object.entries(shipsByRole).sort(([a], [b]) => a.localeCompare(b)).map(([role, roleShips]) => {
                const RoleIcon = getRoleIcon(role);
                const roleColor = getRoleColor(role);
                
                // Group by ship_id to show unique ships and their owners
                const shipGroups: Record<string, typeof roleShips> = {};
                roleShips.forEach(ship => {
                  if (!shipGroups[ship.ship_id]) {
                    shipGroups[ship.ship_id] = [];
                  }
                  shipGroups[ship.ship_id].push(ship);
                });

                return (
                  <div key={role} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded ${roleColor}`}>
                        <RoleIcon className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-semibold text-white">{role}</h4>
                      <span className="text-sm text-slate-500">({roleShips.length})</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(shipGroups).map(([shipId, ships]) => {
                        const shipData = getShipData(shipId);
                        if (!shipData) return null;

                        const isConcept = shipData.productionStatus !== 'flight-ready';
                        const manufacturerLogo = getManufacturerLogo(shipData.manufacturer);

                        return (
                          <div
                            key={shipId}
                            className="p-4 bg-slate-800 border border-slate-700 rounded-lg"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <h5 className="font-semibold text-white flex-1">{shipData.name}</h5>
                                {isConcept && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded">
                                    Concept
                                  </span>
                                )}
                              </div>
                              
                              {manufacturerLogo && (
                                <div className="flex w-full items-center justify-center py-2">
                                  <img src={manufacturerLogo} alt={shipData.manufacturer} className="h-16 w-auto object-contain brightness-0 invert opacity-100" title={shipData.manufacturer} />
                                </div>
                              )}

                              <div className="pt-2 border-t border-slate-700">
                                <p className="text-xs text-slate-400 mb-2">Owned by:</p>
                                <div className="space-y-1">
                                  {ships.map(ship => {
                                    const badge = getOwnershipBadge(ship);
                                    return (
                                    <div key={ship.id} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-300">{ship.characterName}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${badge.className}`} style={badge.style}>
                                        {badge.label}
                                      </span>
                                    </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ground Vehicles Section */}
          {Object.keys(vehiclesByRole).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Ground Vehicles
              </h3>
              {Object.entries(vehiclesByRole).sort(([a], [b]) => a.localeCompare(b)).map(([role, roleShips]) => {
                const RoleIcon = getRoleIcon(role);
                const roleColor = getRoleColor(role);
                
                // Group by ship_id to show unique vehicles and their owners
                const vehicleGroups: Record<string, typeof roleShips> = {};
                roleShips.forEach(ship => {
                  if (!vehicleGroups[ship.ship_id]) {
                    vehicleGroups[ship.ship_id] = [];
                  }
                  vehicleGroups[ship.ship_id].push(ship);
                });

                return (
                  <div key={role} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded ${roleColor}`}>
                        <RoleIcon className="w-4 h-4" />
                      </div>
                      <h4 className="text-lg font-semibold text-white">{role}</h4>
                      <span className="text-sm text-slate-500">({roleShips.length})</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(vehicleGroups).map(([shipId, ships]) => {
                        const shipData = getShipData(shipId);
                        if (!shipData) return null;

                        const isConcept = shipData.productionStatus !== 'flight-ready';
                        const manufacturerLogo = getManufacturerLogo(shipData.manufacturer);

                        return (
                          <div
                            key={shipId}
                            className="p-4 bg-slate-800 border border-slate-700 rounded-lg"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <h5 className="font-semibold text-white flex-1">{shipData.name}</h5>
                                {isConcept && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded">
                                    Concept
                                  </span>
                                )}
                              </div>
                              
                              {manufacturerLogo && (
                                <div className="flex w-full items-center justify-center py-2">
                                  <img src={manufacturerLogo} alt={shipData.manufacturer} className="h-16 w-auto object-contain brightness-0 invert opacity-100" title={shipData.manufacturer} />
                                </div>
                              )}

                              <div className="pt-2 border-t border-slate-700">
                                <p className="text-xs text-slate-400 mb-2">Owned by:</p>
                                <div className="space-y-1">
                                  {ships.map(ship => {
                                    const badge = getOwnershipBadge(ship);
                                    return (
                                    <div key={ship.id} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-300">{ship.characterName}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${badge.className}`} style={badge.style}>
                                        {badge.label}
                                      </span>
                                    </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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


