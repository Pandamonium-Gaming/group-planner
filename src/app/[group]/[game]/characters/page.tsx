'use client';

import { useState } from 'react';
import { CharactersTab } from '../tabs/CharactersTab';
import { useGameLayoutContext } from '@/contexts/GameLayoutContext';
import { CharacterEditModal } from '../CharacterEditModal';
import { CharacterWithProfessions } from '@/lib/types';
import { DEFAULT_FILTERS, CharacterFilters } from '@/components/characters/CharacterFilters';
import { CharacterTransferControls } from '@/components/characters/CharacterTransferControls';
import { useArchiveStatus } from '@/contexts/ArchiveStatusContext';

export default function CharactersPage() {
  const {
    group,
    characters,
    gameSlug,
    addCharacter,
    updateMember,
    deleteMember,
    updateCharacter,
    setProfessionRank,
    membership,
    refreshGroupData,
  } = useGameLayoutContext();
  const { isGameArchived } = useArchiveStatus();
  
  const [editingCharacter, setEditingCharacter] = useState<CharacterWithProfessions | null>(null);
  const [characterFilters, setCharacterFilters] = useState<CharacterFilters>(DEFAULT_FILTERS);

  if (!group) {
    return null;
  }

  return (
    <>
      {membership?.role === 'admin' && <div className="mb-4">
        <CharacterTransferControls key={`${group.id}:${gameSlug}`} groupId={group.id} gameSlug={gameSlug}
          archived={isGameArchived} onImported={refreshGroupData} />
      </div>}
      <CharactersTab
        groupId={group.id}
        group={group}
        characters={characters}
        addCharacter={addCharacter}
        updateMember={updateMember}
        deleteMember={deleteMember}
        setProfessionRank={setProfessionRank}
        setEditingCharacter={setEditingCharacter}
        characterFilters={characterFilters}
        setCharacterFilters={setCharacterFilters}
        gameSlug={gameSlug}
      />

      <CharacterEditModal
        editingCharacter={editingCharacter}
        onSubmit={async (id, data) => {
          await updateCharacter(id, data);
          setEditingCharacter(null);
        }}
        onCancel={() => setEditingCharacter(null)}
        gameSlug={gameSlug}
        group={group}
      />
    </>
  );
}
