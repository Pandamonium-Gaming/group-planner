import { CharacterWithProfessions, Clan } from '@/lib/types';
import { CharacterForm, type CharacterFormData } from '@/components/characters/CharacterForm';
import React from 'react';

interface CharacterEditModalProps {
  editingCharacter: CharacterWithProfessions | null;
  onSubmit: (id: string, data: CharacterFormData) => Promise<void>;
  onCancel: () => void;
  gameSlug?: string;
  group?: Clan | null;
}

export function CharacterEditModal({ editingCharacter, onSubmit, onCancel, gameSlug = 'aoc', group = null }: CharacterEditModalProps) {
  if (!editingCharacter) return null;
  return (
    <CharacterForm
      initialData={{
        name: editingCharacter.name,
        race: editingCharacter.race,
        primary_archetype: editingCharacter.primary_archetype,
        secondary_archetype: editingCharacter.secondary_archetype,
        level: editingCharacter.level,
        is_main: editingCharacter.is_main,
        preferred_role: editingCharacter.preferred_role || [],
        rank: editingCharacter.rank,
        subscriber_tier: editingCharacter.subscriber_tier || null,
        subscriber_since: editingCharacter.subscriber_since || null,
        subscriber_ships_month: editingCharacter.subscriber_ships_month || null,
        ror_faction: editingCharacter.ror_faction || null,
        ror_class: editingCharacter.ror_class || null,
        wow_race: editingCharacter.wow_race || null,
        wow_faction: editingCharacter.wow_faction || null,
        wow_class: editingCharacter.wow_class || null,
        wow_main_spec: editingCharacter.wow_main_spec || null,
        wow_secondary_spec: editingCharacter.wow_secondary_spec || null,
        wow_profession_1: editingCharacter.wow_profession_1 || null,
        wow_profession_2: editingCharacter.wow_profession_2 || null,
        wow_profession_1_rank: editingCharacter.wow_profession_1_rank || null,
        wow_profession_2_rank: editingCharacter.wow_profession_2_rank || null,
        wow_skills: editingCharacter.wow_skills || [],
      }}
      onSubmit={async (data) => {
        await onSubmit(editingCharacter.id, data);
      }}
      onCancel={onCancel}
      isEditing
      gameSlug={gameSlug}
      characterId={editingCharacter.id}
      group={group}
    />
  );
}
