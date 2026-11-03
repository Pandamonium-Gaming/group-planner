import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { ClassOverview } from '../ClassOverview';
import en from '../../../../public/locales/en-GB.json';
import es from '../../../../public/locales/es.json';
import nl from '../../../../public/locales/nl.json';
import type { CharacterWithProfessions, Clan } from '@/lib/types';
import { GuildRankProvider } from '@/contexts/GuildRankContext';

const character: CharacterWithProfessions = {
  id: 'main', group_id: 'group', user_id: 'user', name: 'Aster', race: null,
  primary_archetype: null, secondary_archetype: null, level: 1, is_main: true,
  created_at: '', professions: [], game_slug: 'wowforever', wow_class: 'mage', wow_race: 'Human',
  wow_main_spec: 'Fire', owner: { display_name: 'Owner', discord_username: 'Discord owner' },
};

function LoadedOverview(props: React.ComponentProps<typeof ClassOverview>) {
  const { isLoading } = useLanguage();
  return isLoading ? null : <ClassOverview {...props} />;
}

const previousFetch = global.fetch;
afterEach(() => {
  global.fetch = previousFetch;
  localStorage.clear();
});

function renderOverview(characters: CharacterWithProfessions[], gameSlug = 'wowforever', locale = en, language = 'en-GB') {
  localStorage.setItem('language', language);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => locale });
  return render(<LanguageProvider><LoadedOverview characters={characters} gameSlug={gameSlug} groupSlug="guild" /></LanguageProvider>);
}

it.each([['en-GB', en], ['es', es], ['nl', nl]] as const)(
  'renders and updates counts, percentages and roster filters in %s',
  async (language, locale) => {
    renderOverview([
      character,
      { ...character, id: 'alt', name: 'Briar', is_main: false, wow_class: 'warrior', wow_main_spec: 'Arms' },
    ], 'wowforever', locale, language);
    await screen.findByRole('heading', { name: locale.classOverview.title, level: 1 });
    expect(screen.getAllByRole('article')).toHaveLength(9);
    expect(screen.getByText(locale.classOverview.covered.replace('{{covered}}', '2').replace('{{total}}', '9')))
      .toBeInTheDocument();
    expect(screen.getByText(locale.classOverview.characters.replace('{{count}}', '2'))).toBeInTheDocument();
    expect(screen.getAllByText(`1 (${new Intl.NumberFormat(language, { style: 'percent' }).format(0.5)})`,
      { normalizer: text => text })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Aster' })).toHaveAttribute('href', '/guild/wowforever/characters');
    expect(screen.getByText('Fire')).toBeInTheDocument();
    expect(screen.getAllByText('Owner')).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Alliance' })).toHaveLength(2);

    fireEvent.change(screen.getByLabelText(locale.professionOverview.filter), { target: { value: 'main' } });
    expect(screen.queryByText('Briar')).not.toBeInTheDocument();
    expect(screen.getByText(`1 (${new Intl.NumberFormat(language, { style: 'percent' }).format(1)})`,
      { normalizer: text => text })).toBeInTheDocument();
    expect(screen.getByText(locale.classOverview.covered.replace('{{covered}}', '1').replace('{{total}}', '9')))
      .toBeInTheDocument();
    expect(screen.getByText(locale.classOverview.characters.replace('{{count}}', '1'))).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(locale.professionOverview.filter), { target: { value: 'alt' } });
    expect(screen.queryByText('Aster')).not.toBeInTheDocument();
    expect(screen.getByText('Briar')).toBeInTheDocument();
  }
);

it('includes unknown classes in the denominator without counting them as represented classes', async () => {
  renderOverview([character, { ...character, id: 'unknown', name: 'Lost', user_id: null, wow_class: 'removed' }]);
  await screen.findByRole('heading', { name: 'Classes', level: 1 });
  const unknown = screen.getByRole('heading', { name: en.eventRoster.unknownClass }).closest('article')!;
  expect(within(unknown).getByText('1 (50%)')).toBeInTheDocument();
  expect(within(unknown).getByRole('link', { name: 'Lost' })).toBeInTheDocument();
  expect(within(unknown).getByText(en.character.unclaimed)).toBeInTheDocument();
  expect(screen.getByText('1 / 9 classes represented')).toBeInTheDocument();
  expect(screen.getByText('2 characters')).toBeInTheDocument();
});

it('groups Ashes by primary archetype and displays the combined class', async () => {
  renderOverview([{ ...character, game_slug: 'aoc', primary_archetype: 'mage', secondary_archetype: 'mage' }], 'aoc');
  await screen.findByRole('heading', { name: 'Classes', level: 1 });
  const mage = screen.getByRole('heading', { name: en.archetypes.mage }).closest('article')!;
  expect(within(mage).getByText('Archwizard')).toBeInTheDocument();
  expect(within(mage).getByRole('link', { name: 'Aster' })).toBeInTheDocument();
  expect(screen.getByText('1 / 8 classes represented')).toBeInTheDocument();
});

it('shows missing coverage and finite percentages for an empty roster', async () => {
  renderOverview([]);
  await screen.findByRole('heading', { name: 'Classes', level: 1 });
  expect(screen.getAllByText(en.classOverview.noCoverage)).toHaveLength(9);
  expect(screen.getAllByText('0 (0%)')).toHaveLength(9);
  expect(screen.getByText('0 characters')).toBeInTheDocument();
});

it('shows an explicit unsupported state for games without classes', async () => {
  renderOverview([character], 'starcitizen');
  expect(await screen.findByText(en.classOverview.unsupported)).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('keeps player rank badges with characters when filtering mains and alts', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => en });
  const characters = [character, { ...character, id: 'alt', name: 'Briar', is_main: false }];
  const group: Clan = {
    id: 'group', name: 'Guild', slug: 'guild', created_at: '',
    wowforever_ranks_enabled: true,
    wowforever_custom_ranks: [{ id: 'captain', name: 'Captain', hierarchy: 1 }],
  };
  render(<LanguageProvider>
    <GuildRankProvider group={group} gameSlug="wowforever" characters={characters}
      members={[{ user_id: 'user', guild_rank: 'captain' }]}>
      <LoadedOverview characters={characters} gameSlug="wowforever" groupSlug="guild" />
    </GuildRankProvider>
  </LanguageProvider>);
  await screen.findByRole('heading', { name: 'Classes', level: 1 });
  expect(screen.getAllByLabelText('Guild rank: Captain')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText(en.professionOverview.filter), { target: { value: 'alt' } });
  expect(screen.queryByText('Aster')).not.toBeInTheDocument();
  const alt = screen.getByRole('link', { name: 'Briar' }).closest('li')!;
  expect(within(alt).getByLabelText('Guild rank: Captain')).toBeInTheDocument();
});
