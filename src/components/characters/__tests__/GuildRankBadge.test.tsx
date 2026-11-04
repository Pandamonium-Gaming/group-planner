import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { GuildRankProvider } from '@/contexts/GuildRankContext';
import { GuildRankBadge, GuildRankText } from '../GuildRankBadge';
import { CharacterCard } from '../MemberCard';
import type { CharacterWithProfessions, Clan } from '@/lib/types';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => 'Guild rank' }),
}));

const ranks = [
  { id: 'recruit', name: 'Recruit', hierarchy: 1 },
  { id: 'captain', name: 'Captain', hierarchy: 2 },
  { id: 'admiral', name: 'Admiral', hierarchy: 3 },
];
const group: Clan = {
  id: 'group', name: 'Guild', slug: 'guild', created_at: '',
  wowforever_ranks_enabled: true, wowforever_custom_ranks: ranks,
};
const characters = [
  { id: 'main', user_id: 'player', rank: 'recruit' },
  { id: 'alt', user_id: 'player', rank: null },
  { id: 'other', user_id: 'other-player', rank: 'admiral' },
  { id: 'unclaimed', user_id: null, rank: 'admiral' },
];
const members = [
  { user_id: 'player', guild_rank: 'captain' },
  { user_id: 'other-player', guild_rank: null },
];

function Display({ currentGroup = group, currentMembers = members, gameSlug = 'wowforever' }: {
  currentGroup?: Clan;
  currentMembers?: typeof members;
  gameSlug?: string;
}) {
  return <GuildRankProvider group={currentGroup} gameSlug={gameSlug} characters={characters} members={currentMembers}>
    {characters.map(character => <div key={character.id} data-testid={character.id}>
      <GuildRankBadge characterId={character.id} />
    </div>)}
    <select aria-label="Character" defaultValue="alt">
      <option value="main">Main<GuildRankText characterId="main" /></option>
      <option value="alt">Alt<GuildRankText characterId="alt" /></option>
    </select>
    <GuildRankBadge characterId="missing-character" />
  </GuildRankProvider>;
}

it('shows the player membership rank on mains and alts, not stale character or profession ranks', () => {
  render(<Display />);
  for (const id of ['main', 'alt']) {
    const badge = within(screen.getByTestId(id)).getByLabelText('Guild rank: Captain');
    expect(badge).toHaveTextContent('Captain');
    expect(badge).toHaveAttribute('title', 'Guild rank: Captain');
    expect(badge).toHaveClass('text-blue-300');
  }
  expect(screen.getByTestId('other')).toBeEmptyDOMElement();
  expect(screen.getByTestId('unclaimed')).toBeEmptyDOMElement();
  expect(screen.queryByText('Recruit')).not.toBeInTheDocument();
  expect(screen.queryByText('Admiral')).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Alt (Captain)' })).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('alt');
});

it('updates every character after a promotion, rank rename, reordering and removal', () => {
  const { rerender } = render(<Display />);
  rerender(<Display currentMembers={[{ user_id: 'player', guild_rank: 'admiral' }]} />);
  expect(within(screen.getByTestId('alt')).getByLabelText('Guild rank: Admiral')).toHaveClass('text-amber-300');
  rerender(<Display currentGroup={{ ...group, wowforever_custom_ranks: [
    { ...ranks[1], name: 'Commander', hierarchy: 10 },
    { ...ranks[0], hierarchy: 20 },
  ] }} />);
  expect(within(screen.getByTestId('main')).getByLabelText('Guild rank: Commander')).toHaveClass('text-slate-300');
  rerender(<Display currentMembers={[{ user_id: 'player', guild_rank: null }]} />);
  expect(screen.getByTestId('main')).toBeEmptyDOMElement();
  expect(screen.getByRole('option', { name: 'Alt' })).toBeInTheDocument();
});

it('does not render disabled ranks or a rank from another game', () => {
  const { rerender } = render(<Display currentGroup={{ ...group, wowforever_ranks_enabled: false }} />);
  expect(screen.getByTestId('main')).toBeEmptyDOMElement();
  rerender(<Display gameSlug="ror" />);
  expect(screen.getByTestId('main')).toBeEmptyDOMElement();
});

it('uses the assigned rank ID for colour even when two configured ranks share a name', () => {
  render(<Display currentGroup={{ ...group, wowforever_custom_ranks: [
    { id: 'captain', name: 'Officer', hierarchy: 1 },
    { id: 'admiral', name: 'Officer', hierarchy: 2 },
  ] }} currentMembers={[{ user_id: 'player', guild_rank: 'admiral' }]} />);
  expect(within(screen.getByTestId('main')).getByLabelText('Guild rank: Officer')).toHaveClass('text-amber-300');
});

it.each(['starcitizen', 'star-citizen', 'sc'])('resolves %s settings and case-insensitive stored names', gameSlug => {
  render(<Display gameSlug={gameSlug}
    currentGroup={{ ...group, sc_ranks_enabled: true, sc_custom_ranks: ranks }}
    currentMembers={[{ user_id: 'player', guild_rank: 'CAPTAIN' }]} />);
  expect(within(screen.getByTestId('main')).getByLabelText('Guild rank: Captain')).toBeInTheDocument();
});

it('hides unknown rank tokens but preserves readable legacy labels without inventing a hierarchy', () => {
  const { rerender } = render(<Display currentMembers={[{ user_id: 'player', guild_rank: 'removed-rank' }]} />);
  expect(screen.getByTestId('main')).toBeEmptyDOMElement();
  rerender(<Display currentMembers={[{ user_id: 'player', guild_rank: 'Legacy Officer' }]} />);
  expect(within(screen.getByTestId('main')).getByLabelText('Guild rank: Legacy Officer')).toHaveClass('text-slate-300');
});

it('does not invent or fetch ranks outside the member layout', () => {
  const { container } = render(<><GuildRankBadge characterId="main" /><GuildRankText characterId="main" /></>);
  expect(container).toBeEmptyDOMElement();
});

it.each(['main', 'alt'] as const)('shows rank once on a %s card without repeating it beside related characters', kind => {
  const character: CharacterWithProfessions = {
    ...(kind === 'main' ? characters[0] : characters[1]),
    name: kind === 'main' ? 'Starfall' : 'Moonfall',
    group_id: group.id,
    race: null,
    primary_archetype: null,
    secondary_archetype: null,
    level: 1,
    is_main: kind === 'main',
    created_at: '',
    professions: [],
  };
  render(
    <GuildRankProvider group={group} gameSlug="wowforever" members={members}
      characters={[...characters, { id: 'second-alt', user_id: 'player', rank: null }]}>
      <CharacterCard character={character} gameSlug="wowforever" readOnly
        onUpdate={jest.fn()} onDelete={jest.fn()} onSetProfessionRank={jest.fn()}
        mainCharacterName={kind === 'alt' ? 'Starfall' : undefined}
        altCharacters={kind === 'main' ? [
          { id: 'alt', name: 'Moonfall' }, { id: 'second-alt', name: 'Stardust' },
        ] : []} />
    </GuildRankProvider>
  );
  expect(screen.getByRole('heading', { name: character.name })).toBeInTheDocument();
  expect(screen.getAllByLabelText('Guild rank: Captain')).toHaveLength(1);
  if (kind === 'main') {
    expect(screen.getByText('Alts:').parentElement).toHaveTextContent('Moonfall, Stardust');
  } else {
    expect(screen.getByText('Alt of').parentElement).toHaveTextContent('Starfall');
  }
});
