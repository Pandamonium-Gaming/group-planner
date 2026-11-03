import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { EventClassRoster } from '../EventClassRoster';
import type { EventCharacter, EventRsvp, GuestEventRsvp } from '@/lib/events';
import en from '../../../../public/locales/en-GB.json';
import { GuildRankProvider } from '@/contexts/GuildRankContext';
import type { Clan } from '@/lib/types';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => {
    const entries = en.eventRoster;
    return entries[key.split('.')[1] as keyof typeof entries] || key;
  } }),
}));

function signup(id: string, status: EventRsvp['status'], character: EventCharacter | null): EventRsvp {
  return {
    id, event_id: 'event', user_id: `owner-${id}`, character_id: character?.id || null, status,
    role: null, note: null, responded_at: '2026-11-03T20:00:00Z', character,
    user: { id: `owner-${id}`, display_name: `Owner ${id}` },
  };
}
function guest(id: string, status: GuestEventRsvp['status'], classId: string | null): GuestEventRsvp {
  return {
    id, event_id: 'event', allied_group_id: null, guest_name: `Guest ${id}`, class_id: classId,
    role: 'ranged_dps', status, created_at: '2026-11-03T20:00:00Z', updated_at: '2026-11-03T20:00:00Z',
  };
}
function expectTotals(name: string, attending: number, maybe: number) {
  const table = screen.getByRole('table', { name: 'Class totals by attendance' });
  const row = within(table).getByRole('rowheader', { name }).closest('tr')!;
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual([`${attending}`, `${maybe}`]);
}

it('counts member and guest classes separately for Attending and Maybe, excluding declined signups', () => {
  render(<EventClassRoster event={{
    game_slug: 'wowforever',
    rsvps: [
      signup('1', 'attending', { id: 'alt', name: 'Fire Alt', wow_class: 'mage', wow_main_spec: 'Fire' }),
      signup('2', 'maybe', { id: 'priest', name: 'Healer', wow_class: 'priest', wow_main_spec: 'Holy' }),
      signup('3', 'declined', { id: 'rogue', name: 'Absent Rogue', wow_class: 'rogue' }),
      signup('4', 'maybe', { id: 'mage', name: 'Frost Mage', wow_class: 'mage', wow_main_spec: 'Frost' }),
    ],
    guest_rsvps: [guest('1', 'attending', 'mage'), guest('2', 'maybe', 'priest'), guest('3', 'declined', 'warrior')],
  }} />);
  expectTotals('Mage', 2, 1);
  expectTotals('Priest', 0, 2);
  expect(screen.queryByText('Rogue', { selector: 'th' })).not.toBeInTheDocument();
  expect(screen.queryByText('Warrior', { selector: 'th' })).not.toBeInTheDocument();
  expect(screen.queryByText('Absent Rogue')).not.toBeInTheDocument();
  const attending = screen.getByRole('region', { name: 'Attending' });
  expect(within(attending).getByText('Fire Alt (Owner 1)')).toBeInTheDocument();
  expect(within(attending).getByText('Mage · Fire')).toBeInTheDocument();
  const maybe = screen.getByRole('region', { name: 'Maybe' });
  expect(within(maybe).getByText('Priest · Holy')).toBeInTheDocument();
  expect(within(maybe).getByText('Mage · Frost')).toBeInTheDocument();
});

it('uses the exact RSVP character, never a main fallback, and preserves unknown records', () => {
  render(<EventClassRoster event={{
    game_slug: 'wowforever', rsvps: [
      signup('1', 'attending', null),
      signup('2', 'maybe', { id: 'incomplete', name: 'Incomplete', wow_class: 'deleted-class', wow_main_spec: 'Fire' }),
      signup('3', 'attending', { id: 'bad-spec', name: 'Bad Spec', wow_class: 'warrior', wow_main_spec: 'Fire' }),
    ], guest_rsvps: [guest('1', 'attending', null)],
  }} />);
  expectTotals('Class not recorded', 2, 1);
  expectTotals('Warrior', 1, 0);
  expect(screen.getByText('Owner 1')).toBeInTheDocument();
  expect(screen.getByText(/No character selected/)).toBeInTheDocument();
  expect(screen.getByText('Warrior · Main spec not recorded')).toBeInTheDocument();
  expect(screen.queryByText('Warrior · Fire')).not.toBeInTheDocument();
});

it.each([
  ['aoc', { id: '1', name: 'Ashes character', primary_archetype: 'mage', secondary_archetype: 'mage' }, 'Archwizard'],
  ['ror', { id: '1', name: 'RoR character', ror_class: 'ironbreaker' }, 'Ironbreaker'],
] as const)('uses existing %s class definitions without inventing a main spec', (game, character, className) => {
  render(<EventClassRoster event={{ game_slug: game, rsvps: [signup('1', 'attending', character)] }} />);
  expectTotals(className, 1, 0);
  expect(screen.queryByText(/Main spec not recorded/)).not.toBeInTheDocument();
  expect(screen.getByText(character.name + ' (Owner 1)')).toBeInTheDocument();
});

it('uses primary Ashes archetype when no secondary archetype is selected', () => {
  render(<EventClassRoster event={{ game_slug: 'aoc',
    rsvps: [signup('1', 'attending', { id: '1', name: 'Tank', primary_archetype: 'tank' })],
    guest_rsvps: [guest('1', 'maybe', 'mage')],
  }} />);
  expectTotals('Tank', 1, 0);
  expectTotals('Mage', 0, 1);
});

it.each(['wowforever', 'aoc', 'ror'])('preserves legacy UUID guest classes as unknown under %s', game => {
  render(<EventClassRoster event={{
    game_slug: game, rsvps: [],
    guest_rsvps: [
      guest('1', 'attending', '00000000-0000-4000-8000-000000000001'),
      guest('2', 'maybe', null),
    ],
  }} />);
  expectTotals('Class not recorded', 1, 1);
  expect(screen.getByText('Guest 1')).toBeInTheDocument();
  expect(screen.getByText('Guest 2')).toBeInTheDocument();
});

it('resolves persisted RoR registry IDs for guest classes', () => {
  render(<EventClassRoster event={{
    game_slug: 'ror', rsvps: [],
    guest_rsvps: [guest('1', 'attending', 'ironbreaker'), guest('2', 'maybe', 'archmage')],
  }} />);
  expectTotals('Ironbreaker', 1, 0);
  expectTotals('Archmage', 0, 1);
});

it.each(['starcitizen', 'sc', 'unsupported'])('does not render a class panel for %s', game => {
  const { container } = render(<EventClassRoster event={{ game_slug: game, rsvps: [] }} />);
  expect(container).toBeEmptyDOMElement();
});

it('shows an explicit empty state', () => {
  render(<EventClassRoster event={{ game_slug: 'wowforever', rsvps: [signup('1', 'declined', null)] }} />);
  expect(screen.getByText('No attending or tentative signups yet.')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('shows a linked alt owner rank without assigning a rank to guests or unlinked attendees', () => {
  const group: Clan = {
    id: 'group', name: 'Guild', slug: 'guild', created_at: '',
    wowforever_ranks_enabled: true,
    wowforever_custom_ranks: [{ id: 'captain', name: 'Captain', hierarchy: 1 }],
  };
  render(<GuildRankProvider group={group} gameSlug="wowforever"
    characters={[{ id: 'alt', user_id: 'owner-1' }]}
    members={[{ user_id: 'owner-1', guild_rank: 'captain' }]}>
    <EventClassRoster event={{
      game_slug: 'wowforever',
      rsvps: [
        signup('1', 'attending', { id: 'alt', name: 'Fire Alt', wow_class: 'mage' }),
        signup('2', 'attending', null),
      ],
      guest_rsvps: [guest('1', 'attending', 'mage')],
    }} />
  </GuildRankProvider>);
  const row = screen.getByText('Fire Alt (Owner 1)').closest('li')!;
  expect(within(row).getByText('Captain')).toBeInTheDocument();
  expect(screen.getAllByText('Captain')).toHaveLength(1);
});
