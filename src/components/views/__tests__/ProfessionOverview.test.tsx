import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ProfessionOverview } from '../ProfessionOverview';
import { CharacterForm } from '@/components/characters/CharacterForm';
import type { CharacterWithProfessions } from '@/lib/types';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        'professionOverview.title': 'Professions',
        'professionOverview.filter': 'Characters',
        'professionOverview.all': 'All characters',
        'professionOverview.main': 'Mains only',
        'professionOverview.alt': 'Alts only',
        'professionOverview.mainLabel': 'Main',
        'professionOverview.altLabel': 'Alt',
        'professionOverview.faction': 'Faction',
        'professionOverview.factionRequired': 'Choose a faction',
      };
      return values ? `${key} ${JSON.stringify(values)}` : labels[key] || key;
    },
  }),
}));
jest.mock('@/lib/subscriberShips', () => ({ syncSubscriberShips: jest.fn() }));

const main: CharacterWithProfessions = {
  id: 'main', group_id: 'group', user_id: 'user', name: 'Aster',
  race: null, primary_archetype: null, secondary_archetype: null, level: 1,
  is_main: true, created_at: '', professions: [],
  game_slug: 'wowforever', wow_race: 'Human', wow_class: 'mage', wow_profession_1: 'Alchemy',
};
const alt = { ...main, id: 'alt', name: 'Briar', is_main: false, wow_race: 'Skyborne',
  wow_class: 'warrior', wow_faction: 'Horde' as const, wow_profession_1: 'Tailoring' };

describe('profession and faction UI', () => {
  it('displays trained ranks in coverage without guessing unrecorded ranks', () => {
    render(<ProfessionOverview characters={[{ ...main, wow_profession_1_rank: 'expert' }, alt]}
      gameSlug="wowforever" groupSlug="guild" />);
    expect(screen.getByText('wowForever.professionRanks.expert')).toBeInTheDocument();
    expect(screen.getByText('wowForever.rankNotRecorded')).toBeInTheDocument();
    expect(screen.queryByText(/225|300/)).not.toBeInTheDocument();
  });

  it('saves ranks independently and clears old ranks when changing professions', async () => {
    const submit = jest.fn().mockResolvedValue(undefined);
    render(<CharacterForm initialData={{ name: 'Aster', wow_race: 'Human', wow_class: 'mage', wow_main_spec: 'Fire',
      wow_profession_1: 'Alchemy', wow_profession_1_rank: 'expert',
      wow_profession_2: 'Tailoring', wow_profession_2_rank: 'artisan' }}
      gameSlug="wowforever" onSubmit={submit} onCancel={jest.fn()} />);
    expect(screen.getByLabelText('wowForever.firstProfessionRank')).toHaveValue('expert');
    expect(screen.getByLabelText('wowForever.secondProfessionRank')).toHaveValue('artisan');
    fireEvent.change(screen.getByLabelText('wowForever.firstProfession'), { target: { value: 'Mining' } });
    expect(screen.getByLabelText('wowForever.firstProfessionRank')).toHaveValue('');
    expect(screen.getByLabelText('wowForever.secondProfessionRank')).toHaveValue('artisan');
    fireEvent.change(screen.getByLabelText('wowForever.firstProfessionRank'), { target: { value: 'journeyman' } });
    fireEvent.change(screen.getByLabelText('wowForever.secondProfession'), { target: { value: '' } });
    expect(screen.queryByLabelText('wowForever.secondProfessionRank')).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: /Create Character/ }).closest('form')!);
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      wow_profession_1: 'Mining', wow_profession_1_rank: 'journeyman',
      wow_profession_2: null, wow_profession_2_rank: null,
    })));
  });
  it('shows counts, character labels and icons and updates coverage when filtering', () => {
    render(<ProfessionOverview characters={[main, alt]} gameSlug="wowforever" groupSlug="guild" />);
    expect(screen.getAllByRole('article')).toHaveLength(9);
    expect(screen.getByText('Aster')).toBeInTheDocument();
    expect(screen.getByText('Briar')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mage' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alliance' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Horde' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Characters'), { target: { value: 'main' } });
    expect(screen.queryByText('Briar')).not.toBeInTheDocument();
    expect(screen.getByText('Aster')).toBeInTheDocument();
    const summary = screen.getByText(/professionOverview.contributors/);
    expect(summary.textContent).toContain('"count":1');
    fireEvent.change(screen.getByLabelText('Characters'), { target: { value: 'alt' } });
    expect(screen.queryByText('Aster')).not.toBeInTheDocument();
    expect(screen.getByText('Briar')).toBeInTheDocument();
    expect(within(screen.getAllByRole('article')[0]).getByText('0')).toBeInTheDocument();
  });

  it('saves a chosen faction for unrestricted Skyborne and resets it for fixed classes', async () => {
    const submit = jest.fn().mockResolvedValue(undefined);
    render(<CharacterForm initialData={{ name: 'Briar', wow_race: 'Skyborne', wow_class: 'warrior', wow_main_spec: 'Arms' }}
      gameSlug="wowforever" onSubmit={submit} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Faction *'), { target: { value: 'Horde' } });
    fireEvent.submit(screen.getByRole('button', { name: /Create Character/ }).closest('form')!);
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ wow_faction: 'Horde' })));
    fireEvent.change(screen.getByLabelText('wowForever.class *'), { target: { value: 'mage' } });
    expect(screen.queryByLabelText('Faction *')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alliance' })).toBeInTheDocument();
  });

  it('requires a choice for legacy unrestricted Skyborne without inventing a faction', () => {
    const submit = jest.fn();
    render(<CharacterForm initialData={{ name: 'Briar', wow_race: 'Skyborne', wow_class: 'warrior', wow_main_spec: 'Arms' }}
      gameSlug="wowforever" onSubmit={submit} onCancel={jest.fn()} />);
    expect(screen.queryByRole('img', { name: 'Alliance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Horde' })).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: /Create Character/ }).closest('form')!);
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText('Choose a faction')).toBeInTheDocument();
  });
});
