'use client';

import { useState } from 'react';
import shipData from '@/config/games/star-citizen-ships.json';
import { getShipRoleConfig, ownershipTypes, productionStatuses } from '@/config/games/star-citizen-config';
import { Search, X, Info } from 'lucide-react';

interface Ship {
  id: string;
  name: string;
  manufacturer: string;
  manufacturerCode: string;
  role: string;
  size: string;
  cargo: number;
  crew: { min: number; max: number };
  productionStatus: string;
  description: string | null;
  image: string | null;
  length: number | null;
  beam: number | null;
  height: number | null;
  speed: { scm: number | null; afterburner: number | null };
}

interface CharacterShip {
  ship_id: string;
  ownership_type: 'owned-pledge' | 'owned-auec' | 'concept-pledge' | 'loaner';
  notes?: string;
}

interface ShipSelectorProps {
  selectedShips: CharacterShip[];
  onChange: (ships: CharacterShip[]) => void;
  includeVehicles?: boolean;
}

export default function ShipSelector({ selectedShips, onChange, includeVehicles = false }: ShipSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [showFlightReadyOnly, setShowFlightReadyOnly] = useState(false);
  const [hoveredShip, setHoveredShip] = useState<Ship | null>(null);

  const ships = shipData.ships as Ship[];
  
  // Filter ships/vehicles
  const filteredShips = ships.filter(ship => {
    if (!includeVehicles && ship.size === 'vehicle') return false;
    if (includeVehicles && ship.size !== 'vehicle') return false;
    
    const matchesSearch = ship.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ship.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = selectedManufacturer === 'all' || ship.manufacturerCode === selectedManufacturer;
    const matchesRole = selectedRole === 'all' || ship.role.toLowerCase().replace(/\s+/g, '-') === selectedRole;
    const matchesSize = selectedSize === 'all' || ship.size === selectedSize;
    const matchesStatus = !showFlightReadyOnly || ship.productionStatus === 'flight-ready';
    
    return matchesSearch && matchesManufacturer && matchesRole && matchesSize && matchesStatus;
  });

  // Get unique values for filters
  const manufacturers = [...new Set(ships.map(s => s.manufacturerCode))].sort();
  const roles = [...new Set(ships.map(s => s.role.toLowerCase().replace(/\s+/g, '-')))].sort();
  const sizes = ['snub', 'vehicle', 'small', 'medium', 'large', 'capital'];

  const handleAddShip = (shipId: string, ownershipType: CharacterShip['ownership_type']) => {
    const ship = ships.find(s => s.id === shipId);
    if (!ship) return;

    const ownershipConfig = ownershipTypes[ownershipType];
    
    // Check if flight-ready required
    if (ownershipConfig.requiresFlightReady && ship.productionStatus !== 'flight-ready') {
      alert('This ship is not flight-ready. You can only add it as "Concept (Pledge)".');
      return;
    }

    // Check if already exists with this ownership type
    const exists = selectedShips.some(s => s.ship_id === shipId && s.ownership_type === ownershipType);
    if (exists) {
      // Remove it
      onChange(selectedShips.filter(s => !(s.ship_id === shipId && s.ownership_type === ownershipType)));
    } else {
      // Add it
      onChange([...selectedShips, { ship_id: shipId, ownership_type: ownershipType }]);
    }
  };

  const isShipSelected = (shipId: string, ownershipType: CharacterShip['ownership_type']) => {
    return selectedShips.some(s => s.ship_id === shipId && s.ownership_type === ownershipType);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${includeVehicles ? 'vehicles' : 'ships'}...`}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select
            value={selectedManufacturer}
            onChange={(e) => setSelectedManufacturer(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Manufacturers</option>
            {manufacturers.map(mfr => (
              <option key={mfr} value={mfr}>{mfr}</option>
            ))}
          </select>

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            {roles.map(role => {
              const config = getShipRoleConfig(role);
              return (
                <option key={role} value={role}>{config.name}</option>
              );
            })}
          </select>

          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sizes</option>
            {sizes.map(size => (
              <option key={size} value={size}>{size.charAt(0).toUpperCase() + size.slice(1)}</option>
            ))}
          </select>

          <label className="flex items-center px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm cursor-pointer hover:bg-gray-700">
            <input
              type="checkbox"
              checked={showFlightReadyOnly}
              onChange={(e) => setShowFlightReadyOnly(e.target.checked)}
              className="mr-2"
            />
            Flight Ready Only
          </label>
        </div>
      </div>

      {/* Ship Grid */}
      <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
        {filteredShips.map(ship => {
          const roleConfig = getShipRoleConfig(ship.role);
          const statusConfig = productionStatuses[ship.productionStatus] || productionStatuses['flight-ready'];
          const RoleIcon = roleConfig.icon;

          return (
            <div
              key={ship.id}
              className="relative border border-gray-700 rounded-lg p-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
              onMouseEnter={() => setHoveredShip(ship)}
              onMouseLeave={() => setHoveredShip(null)}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Ship Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1.5 rounded ${roleConfig.bgColor} ${roleConfig.borderColor} border`}>
                      <RoleIcon className={`w-4 h-4 ${roleConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{ship.name}</h3>
                      <p className="text-xs text-gray-400">{ship.manufacturer}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${statusConfig.bgColor} ${statusConfig.color}`}>
                      {statusConfig.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className={`px-2 py-0.5 rounded ${roleConfig.bgColor} ${roleConfig.color}`}>
                      {roleConfig.name}
                    </span>
                    <span className="capitalize">{ship.size}</span>
                    <span>•</span>
                    <span>{ship.cargo} SCU</span>
                    <span>•</span>
                    <span>Crew: {ship.crew.min}-{ship.crew.max}</span>
                  </div>
                </div>

                {/* Ownership Type Buttons */}
                <div className="flex gap-1">
                  {Object.values(ownershipTypes).map(ownershipType => {
                    const isSelected = isShipSelected(ship.id, ownershipType.id);
                    const isDisabled = ownershipType.requiresFlightReady && ship.productionStatus !== 'flight-ready';
                    
                    return (
                      <button
                        key={ownershipType.id}
                        onClick={() => handleAddShip(ship.id, ownershipType.id)}
                        disabled={isDisabled}
                        title={ownershipType.description}
                        className={`
                          px-2 py-1 rounded text-xs font-medium transition-colors
                          ${isSelected
                            ? `${ownershipType.bgColor} ${ownershipType.color} border border-current`
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }
                          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {ownershipType.name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hover Info Card */}
              {hoveredShip?.id === ship.id && ship.description && (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
                  <div className="flex items-start gap-2 mb-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-300 leading-relaxed">{ship.description}</p>
                  </div>
                  {ship.length && (
                    <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">
                      Dimensions: {ship.length}m × {ship.beam}m × {ship.height}m
                      {ship.speed.scm && ` • SCM: ${ship.speed.scm} m/s`}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredShips.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No {includeVehicles ? 'vehicles' : 'ships'} found matching your filters.
          </div>
        )}
      </div>

      {/* Selected Count */}
      {selectedShips.length > 0 && (
        <div className="text-sm text-gray-400">
          {selectedShips.length} {includeVehicles ? 'vehicle' : 'ship'}{selectedShips.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}

