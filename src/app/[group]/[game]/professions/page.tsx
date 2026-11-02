'use client';

import { useGameLayoutContext } from '@/contexts/GameLayoutContext';
import { ProfessionOverview } from '@/components/views/ProfessionOverview';

export default function ProfessionsPage() {
  const { characters, gameSlug, groupSlug } = useGameLayoutContext();
  return <ProfessionOverview characters={characters} gameSlug={gameSlug} groupSlug={groupSlug} />;
}
