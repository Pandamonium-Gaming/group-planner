'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Clan, CharacterWithProfessions, RankLevel, Race, Archetype } from '@/lib/types';
import { CharacterData } from '@/hooks/useGroupData';

interface GameLayoutContextValue {
  // Group data
  group: Clan | null;
  characters: CharacterWithProfessions[];
  groupSlug: string;
  gameSlug: string;
  
  // Character actions
  addCharacter: (data: CharacterData) => Promise<void>;
  updateCharacter: (id: string, data: Partial<CharacterData>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  setProfessionRank: (characterId: string, professionId: string, rank: RankLevel | null, level?: number, quality?: number) => Promise<void>;
  refreshGroupData: () => Promise<void>;
  refreshMembership: () => Promise<void>;
  
  // Legacy aliases
  updateMember: (id: string, name: string) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  
  // Membership data
  membership: { role: string | null } | null;
  canManageMembers: boolean;
  
  // Permissions
  hasPermission: (permission: string) => boolean;
  
  // User info
  userId: string | null;
  userTimezone: string;
}

const GameLayoutContext = createContext<GameLayoutContextValue | null>(null);

export function GameLayoutProvider({ 
  children,
  value 
}: { 
  children: ReactNode;
  value: GameLayoutContextValue;
}) {
  return (
    <GameLayoutContext.Provider value={value}>
      {children}
    </GameLayoutContext.Provider>
  );
}

export function useGameLayoutContext() {
  const context = useContext(GameLayoutContext);
  if (!context) {
    throw new Error('useGameLayoutContext must be used within a GameLayoutProvider');
  }
  return context;
}

// Optional hook that returns null if not in context (for pages that might be used outside layout)
export function useGameLayoutContextOptional() {
  return useContext(GameLayoutContext);
}
