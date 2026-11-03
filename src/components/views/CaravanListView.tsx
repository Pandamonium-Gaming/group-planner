'use client';

import { useState } from 'react';
import { Truck, MapPin, Users, Clock, Coins, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { CaravanEventWithDetails, CaravanStatus } from '@/lib/types';
import { CaravanData } from '@/hooks/useCaravans';
import { CaravanForm } from '@/components/forms/CaravanForm';
import { GuildRankBadge } from '@/components/characters/GuildRankBadge';

interface CaravanListViewProps {
  caravans: CaravanEventWithDetails[];
  onCreateCaravan?: (data: CaravanData) => Promise<string>;
  onSignUp: (caravanId: string, characterId: string, role?: string) => Promise<void>;
  onWithdraw: (caravanId: string, characterId: string) => Promise<void>;
  isOfficer: boolean;
}

const STATUS_COLORS: Record<CaravanStatus, string> = {
  planning: 'bg-blue-500/20 text-blue-400',
  recruiting: 'bg-green-500/20 text-green-400',
  ready: 'bg-yellow-500/20 text-yellow-400',
  in_transit: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-slate-500/20 text-slate-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-slate-500/20 text-slate-500',
};

export function CaravanListView({
  caravans,
  onCreateCaravan,
  onSignUp,
  onWithdraw,
  isOfficer,
}: CaravanListViewProps) {
  const { t } = useLanguage();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCreateCaravan = async (data: CaravanData) => {
    if (!onCreateCaravan) return;
    await onCreateCaravan(data);
    setShowCreateForm(false);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" />
            {t('caravan.title')}
          </h2>
          {onCreateCaravan && isOfficer && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + {t('caravan.createCaravan')}
            </button>
          )}
        </div>

      {/* Caravan List */}
      {caravans.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-8 text-center">
          <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            {t('caravan.noCaravans')}
          </h3>
          <p className="text-sm text-slate-500">
            {t('caravan.noCaravansDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {caravans.map((caravan) => (
            <div
              key={caravan.id}
              className="bg-slate-800/80 border border-slate-700 rounded-xl p-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white text-lg">{caravan.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(caravan.departure_at)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[caravan.status]}`}>
                      {t(`caravan.statuses.${caravan.status}`)}
                    </span>
                  </div>
                </div>
                {caravan.cargo_value > 0 && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-yellow-400 font-medium">
                      <Coins className="w-4 h-4" />
                      {caravan.cargo_value.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">{t('caravan.cargoValue')}</div>
                  </div>
                )}
              </div>

              {/* Route */}
              <div className="flex items-center gap-2 text-sm mb-3">
                <div className="flex items-center gap-1 text-green-400">
                  <MapPin className="w-4 h-4" />
                  {caravan.origin_node}
                </div>
                <span className="text-slate-600">→</span>
                <div className="flex items-center gap-1 text-red-400">
                  <MapPin className="w-4 h-4" />
                  {caravan.destination_node}
                </div>
              </div>

              {/* Waypoints with danger zones */}
              {caravan.waypoints.some(w => w.is_danger_zone) && (
                <div className="flex items-center gap-2 text-xs text-amber-400 mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  {caravan.waypoints.filter(w => w.is_danger_zone).length} {t('caravan.dangerZone')}
                </div>
              )}

              {/* Escort Progress */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-400">{t('siege.signedUp')}</span>
                  <span className="text-white">
                    {caravan.escorts.length} / {caravan.max_escorts}
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      caravan.escorts.length >= caravan.min_escorts
                        ? 'bg-green-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, (caravan.escorts.length / caravan.max_escorts) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {t('caravan.minEscorts')}: {caravan.min_escorts}
                </div>
              </div>

              {/* Escorts */}
              {caravan.escorts.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {caravan.escorts.slice(0, 8).map((escort) => (
                    <span
                      key={escort.id}
                      className={`px-2 py-1 text-xs rounded ${
                        escort.confirmed ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {escort.character?.name || 'Unknown'}
                      {' '}<GuildRankBadge characterId={escort.character_id} />
                    </span>
                  ))}
                  {caravan.escorts.length > 8 && (
                    <span className="px-2 py-1 text-xs text-slate-500">
                      +{caravan.escorts.length - 8} more
                    </span>
                  )}
                </div>
              )}

              {/* Rewards */}
              {(caravan.escort_reward_gold > 0 || caravan.escort_reward_dkp > 0) && (
                <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-4 text-sm">
                  <span className="text-slate-400">{t('caravan.escortReward')}:</span>
                  {caravan.escort_reward_gold > 0 && (
                    <span className="text-yellow-400">{caravan.escort_reward_gold} Gold</span>
                  )}
                  {caravan.escort_reward_dkp > 0 && (
                    <span className="text-purple-400">{caravan.escort_reward_dkp} DKP</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Create Caravan Modal */}
      <CaravanForm
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={handleCreateCaravan}
      />
    </>
  );
}
