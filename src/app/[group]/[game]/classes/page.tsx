'use client';

import { useGameLayoutContext } from '@/contexts/GameLayoutContext';
import { ClassOverview } from '@/components/views/ClassOverview';

export default function ClassesPage() {
  const { characters, gameSlug, groupSlug } = useGameLayoutContext();
  return <ClassOverview characters={characters} gameSlug={gameSlug} groupSlug={groupSlug} />;
}
