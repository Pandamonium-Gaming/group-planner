"use client";
import { AddCharacterButton } from "@/components/characters/AddCharacterButton";
import { CharacterFiltersBar, filterCharacters, CharacterFilters } from "@/components/characters/CharacterFilters";
import { CharacterCard } from "@/components/characters/MemberCard";
import { useGroupMembership } from '@/hooks/useGroupMembership';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { roleHasPermission } from '@/lib/permissions';
import { CharacterWithProfessions, RankLevel, Clan } from "@/lib/types";
import { CharacterData } from "@/hooks/useGroupData";

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
}: CharactersTabProps) {
  const { user } = useAuthContext();
  const { t } = useLanguage();
  const clanMembership = useGroupMembership(groupId, user?.id || null);
  const userRole = clanMembership.membership?.role || 'pending';

  return (
    <div className="space-y-4">
      <AddCharacterButton onAdd={addCharacter} group={group} />
      {characters.length > 0 && (
        <CharacterFiltersBar
          filters={characterFilters}
          onChange={setCharacterFilters}
          characterCount={characters.length}
          filteredCount={filterCharacters(characters, characterFilters).length}
        />
      )}
      {characters.length === 0 ? (
        <div className="text-slate-400 text-center py-8">{t('characters.noCharactersFound') || 'No characters found.'}</div>
      ) : filterCharacters(characters, characterFilters).length === 0 ? (
        <div className="text-slate-400 text-center py-8">{t('characters.noCharactersMatch') || 'No characters match the filters.'}</div>
      ) : (
        filterCharacters(characters, characterFilters).map((character) => {
          // Only allow edit if user owns character AND has 'characters_edit_own', or has 'characters_edit_any' permission
          const isAdmin = userRole === 'admin';
          const canEdit = isAdmin ? true : (
            (user?.id && character.user_id === user.id && roleHasPermission(userRole, 'characters_edit_own'))
            || roleHasPermission(userRole, 'characters_edit_any')
          );
          
          // Get main character name if this is an alt
          const mainCharacter = character.is_main ? null : characters.find(c => c.user_id === character.user_id && c.is_main);
          // Get alt characters if this is a main
          const alts = character.is_main ? characters.filter(c => c.user_id === character.user_id && !c.is_main) : [];
          
          return (
            <CharacterCard
              key={character.id}
              character={character}
              onUpdate={updateMember}
              onDelete={deleteMember}
              onSetProfessionRank={setProfessionRank}
              onEdit={canEdit ? () => setEditingCharacter(character) : undefined}
              readOnly={!canEdit}
              mainCharacterName={mainCharacter?.name}
              altCharacters={alts}
              group={group}
            />
          );
        })
      )}
    </div>
  );
}

