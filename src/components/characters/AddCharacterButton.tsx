'use client';

import { useState } from 'react';
import { Plus, Sword } from 'lucide-react';
import { CharacterForm } from '@/components/characters/CharacterForm';
import { CharacterData } from '@/hooks/useGroupData';
import { useLanguage } from '@/contexts/LanguageContext';
import { Clan } from '@/lib/types';

interface AddCharacterButtonProps {
  onAdd: (data: CharacterData) => Promise<void>;
  gameSlug?: string;
  disabled?: boolean;
  disabledReason?: string;
  group?: Clan | null;
}

export function AddCharacterButton({ onAdd, gameSlug = 'aoc', disabled = false, disabledReason, group = null }: AddCharacterButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (data: CharacterData) => {
    await onAdd(data);
    setIsModalOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        title={disabledReason}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all cursor-pointer group ${
          disabled
            ? 'bg-slate-800/30 border border-dashed border-slate-600/50 text-slate-500 cursor-not-allowed'
            : 'bg-slate-800/50 hover:bg-slate-700/50 border border-dashed border-slate-600 hover:border-orange-500/50 text-slate-300 hover:text-white'
        }`}
      >
        <div className={`p-1.5 rounded-lg transition-colors ${
          disabled 
            ? 'bg-slate-700/20'
            : 'bg-orange-500/20 group-hover:bg-orange-500/30'
        }`}>
          <Plus size={18} className={disabled ? 'text-slate-600' : 'text-orange-400'} />
        </div>
        <span className="font-medium">{t('character.addCharacter')}</span>
        <Sword size={16} className={disabled ? 'text-slate-600' : 'text-slate-500 group-hover:text-orange-400 transition-colors'} />
      </button>

      {isModalOpen && !disabled && (
        <CharacterForm
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          gameSlug={gameSlug}
          group={group}
        />
      )}
    </>
  );
}

// Legacy export for backward compatibility
export { AddCharacterButton as AddMemberButton };

