"use client";
import { AddCharacterButton } from "@/components/characters/AddCharacterButton";
import { CharacterFiltersBar, filterCharacters, CharacterFilters } from "@/components/characters/CharacterFilters";
import { CharacterCard } from "@/components/characters/MemberCard";
import { useLanguage } from '@/contexts/LanguageContext';
import { useGroupMembership } from '@/hooks/useGroupMembership';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useArchiveStatus } from '@/contexts/ArchiveStatusContext';
import { GroupRole } from '@/lib/permissions';
import { canEditCharacter, canDeleteCharacter, canOfficerManageUser } from '@/lib/character-permissions';
import { CharacterWithProfessions, RankLevel, Clan } from "@/lib/types";
import { CharacterData } from '@/hooks/useGroupData';

interface CharactersTabProps {
  groupId: string;
  group: Clan;
  characters: CharacterWithProfessions[];
  addCharacter: (data: CharacterData) => Promise<void>;
  updateMember: (id: string, name: string) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  setProfessionRank: (characterId: string, professionId: string, rank: RankLevel | null, level?: number, quality?: number) => Promise<void>;
  setEditingCharacter: (character: CharacterWithProfessions) => void;
  characterFilters: CharacterFilters;
  setCharacterFilters: (filters: CharacterFilters) => void;
  gameSlug?: string;
}

export function CharactersTab({
  groupId,
  group,
  characters,
  addCharacter,
  updateMember,
  deleteMember,
  setProfessionRank,
  setEditingCharacter,
  characterFilters,
  setCharacterFilters,
  gameSlug = 'aoc',
}: CharactersTabProps) {
  const { user } = useAuthContext();
  const { isGameArchived } = useArchiveStatus();
  const { t } = useLanguage();
  const clanMembership = useGroupMembership(groupId, user?.id || null);
  const userRole = clanMembership.membership?.role || 'pending';

  // Helper to check if user can edit a specific character
  const getUserCanEditCharacter = (character: CharacterWithProfessions): boolean => {
    if (!user) return false;

    // First check basic permission
    if (!canEditCharacter(userRole as GroupRole, character.user_id, user.id)) {
      return false;
    }

    // If officer editing another user's character, check that target user is a member
    if (userRole === 'officer' && character.user_id !== user.id) {
      const targetUser = clanMembership.members.find(m => m.id === character.user_id);
      
      if (targetUser && !canOfficerManageUser(userRole as GroupRole, targetUser.role as GroupRole)) {
        return false;
      }
    }

    return true;
  };

  // Helper to check if user can delete a specific character
  const getUserCanDeleteCharacter = (character: CharacterWithProfessions): boolean => {
    if (!user) return false;

    // First check basic permission
    if (!canDeleteCharacter(userRole as GroupRole, character.user_id, user.id)) {
      return false;
    }

    // If officer deleting another user's character, check that target user is a member
    if (userRole === 'officer' && character.user_id !== user.id) {
      const targetUser = clanMembership.members.find(m => m.id === character.user_id);
      
      if (targetUser && !canOfficerManageUser(userRole as GroupRole, targetUser.role as GroupRole)) {
        return false;
      }
    }

    return true;
  };

  // Stub function for disabled update
  const handleUpdateStub = async (_id: string, _name: string) => {
    throw new Error('You do not have permission to edit this character');
  };

  // Stub function for disabled delete
  const handleDeleteStub = async (_id: string) => {
    throw new Error('You do not have permission to delete this character');
  };

  return (
    <div className="space-y-4">
      <AddCharacterButton 
        onAdd={addCharacter} 
        gameSlug={gameSlug}
        group={group}
        disabled={isGameArchived}
        disabledReason="Cannot add characters to an archived game"
      />
      {characters.length > 0 && (
        <CharacterFiltersBar
          filters={characterFilters}
          onChange={setCharacterFilters}
          characterCount={characters.length}
          filteredCount={filterCharacters(characters, characterFilters).length}
          gameSlug={gameSlug}
        />
      )}
      {characters.length === 0 ? (
        <div className="text-slate-400 text-center py-8">{t('clan.noCharacters')}</div>
      ) : filterCharacters(characters, characterFilters).length === 0 ? (
        <div className="text-slate-400 text-center py-8">{t('clan.noCharactersMatch')}</div>
      ) : (
        filterCharacters(characters, characterFilters).map((character) => {
          // Check if user can edit this character
          const canEdit = getUserCanEditCharacter(character) && !isGameArchived;
          const canDelete = getUserCanDeleteCharacter(character) && !isGameArchived;
          
          // Get main character name if this is an alt
          const mainCharacter = character.is_main || !character.user_id ? null : characters.find(c => c.user_id === character.user_id && c.is_main);
          // Get alt characters if this is a main
          const alts = character.is_main && character.user_id ? characters.filter(c => c.user_id === character.user_id && !c.is_main) : [];
          
          return (
            <CharacterCard
              key={character.id}
              character={character}
              onUpdate={canEdit ? updateMember : handleUpdateStub}
              onDelete={canDelete ? deleteMember : handleDeleteStub}
              onSetProfessionRank={setProfessionRank}
              onEdit={canEdit ? () => setEditingCharacter(character) : undefined}
              readOnly={!canEdit}
              mainCharacterName={mainCharacter?.name}
              altCharacters={alts}
              gameSlug={gameSlug}
              group={group}
            />
          );
        })
      )}
    </div>
  );
}
