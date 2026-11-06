import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ProfessionOverview } from '../ProfessionOverview';
import { CharacterForm } from '@/components/characters/CharacterForm';
import { CharacterEditModal } from '@/app/[group]/[game]/CharacterEditModal';
import { CharacterCard } from '@/components/characters/MemberCard';
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
        'wowSkills.unknown': '?',
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

  it('shows full character and owner names alongside coloured profession badges in rank order', () => {
    const rankedCharacters: CharacterWithProfessions[] = [
      { ...main, id: 'unrecorded', name: 'Unrecorded Crafter' },
      { ...main, id: 'apprentice', name: 'Apprentice Crafter', wow_profession_1_rank: 'apprentice' },
      { ...main, id: 'journeyman', name: 'Journeyman Crafter', wow_profession_1_rank: 'journeyman' },
      { ...main, id: 'expert', name: 'Expert Crafter', wow_profession_1_rank: 'expert' },
      { ...main, id: 'artisan', name: 'An Extremely Long Artisan Character Name', is_main: false,
        wow_profession_1_rank: 'artisan', owner: { display_name: 'An Extremely Long Owner Display Name', discord_username: null } },
    ];
    render(<ProfessionOverview characters={rankedCharacters} gameSlug="wowforever" groupSlug="guild" />);
    const card = within(screen.getAllByRole('article')[0]);
    expect(card.getAllByRole('link').map(link => link.textContent)).toEqual([
      'An Extremely Long Artisan Character Name', 'Expert Crafter', 'Journeyman Crafter',
      'Apprentice Crafter', 'Unrecorded Crafter',
    ]);
    expect(card.getByText('An Extremely Long Owner Display Name')).toBeInTheDocument();
    expect(card.getByText('wowForever.professionRanks.apprentice')).toHaveClass('text-green-400', 'border-green-500');
    expect(card.getByText('wowForever.professionRanks.journeyman')).toHaveClass('text-blue-400', 'border-blue-500');
    expect(card.getByText('wowForever.professionRanks.expert')).toHaveClass('text-purple-400', 'border-purple-500');
    expect(card.getByText('wowForever.professionRanks.artisan')).toHaveClass('text-orange-400', 'border-orange-500');
    expect(card.getByText('wowForever.rankNotRecorded')).toHaveClass('text-slate-400');
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
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getByText('Aster')).toBeInTheDocument();
    expect(screen.getByText('Briar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aster' })).toHaveAttribute('href', '/guild/wowforever/characters#character-main');
    expect(screen.getByRole('link', { name: 'Briar' })).toHaveAttribute('href', '/guild/wowforever/characters#character-alt');
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

  it('saves secondary and other skills from the real edit modal without losing either primary profession', async () => {
    const submit = jest.fn().mockResolvedValue(undefined);
    render(<CharacterEditModal editingCharacter={{ ...main, wow_main_spec: 'Fire', wow_profession_2: 'Mining', wow_skills: [
      { name: 'Cooking', category: 'secondary', rank: 'expert', current: 200, max: 225 },
      { name: 'Fishing', category: 'secondary', rank: null, current: 300, max: 300 },
      { name: 'Swords', category: 'weapon', rank: null, current: 70, max: 100 },
    ] }} gameSlug="wowforever" onSubmit={submit} onCancel={jest.fn()} />);
    expect(screen.getByLabelText('wowSkills.rank: wowSkills.cooking')).toHaveValue('expert');
    expect(screen.getByLabelText('wowSkills.rank: wowSkills.fishing')).toHaveValue('');
    fireEvent.click(screen.getByLabelText('wowSkills.firstAid'));
    fireEvent.change(screen.getByLabelText('wowSkills.rank: wowSkills.firstAid'), { target: { value: 'artisan' } });
    fireEvent.change(screen.getByLabelText('wowSkills.current: wowSkills.firstAid'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('wowSkills.max: wowSkills.firstAid'), { target: { value: '300' } });
    fireEvent.click(screen.getByLabelText('wowSkills.cooking'));
    fireEvent.click(screen.getByRole('button', { name: 'wowSkills.add' }));
    fireEvent.change(screen.getAllByLabelText('wowSkills.name')[1], { target: { value: ' Lockpicking ' } });
    fireEvent.change(screen.getByLabelText('Character Name *'), { target: { value: 'Renamed' } });
    fireEvent.submit(screen.getByRole('button', { name: /Save Changes/ }).closest('form')!);
    await waitFor(() => expect(submit).toHaveBeenCalledWith('main', expect.objectContaining({
      name: 'Renamed', wow_profession_1: 'Alchemy', wow_profession_2: 'Mining', wow_skills: [
        { name: 'Fishing', category: 'secondary', rank: null, current: 300, max: 300 },
        { name: 'Swords', category: 'weapon', rank: null, current: 70, max: 100 },
        { name: 'First Aid', category: 'secondary', rank: 'artisan', current: 250, max: 300 },
        { name: 'Lockpicking', category: 'class', rank: null, current: null, max: null },
      ],
    })));
  });

  it('rejects current skill above the maximum and shows a recoverable form error', async () => {
    const submit = jest.fn().mockResolvedValue(undefined);
    render(<CharacterForm initialData={{ name: 'Aster', wow_race: 'Human', wow_class: 'mage', wow_main_spec: 'Fire',
      wow_skills: [{ name: 'Fishing', category: 'secondary', rank: null, current: 301, max: 300 }] }}
      gameSlug="wowforever" onSubmit={submit} onCancel={jest.fn()} />);
    const form = screen.getByRole('button', { name: /Create Character/ }).closest('form')!;
    fireEvent.submit(form);
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText('wowSkills.invalid')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('wowSkills.current: wowSkills.fishing'), { target: { value: '' } });
    fireEvent.submit(form);
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      wow_skills: [{ name: 'Fishing', category: 'secondary', rank: null, current: null, max: 300 }],
    })));
  });

  it('shows skill progress and rank badges on character cards and secondary coverage', () => {
    const character: CharacterWithProfessions = { ...main, wow_skills: [
      { name: 'Cooking', category: 'secondary', rank: 'expert', current: 180, max: 225 },
      { name: 'Fishing', category: 'secondary', rank: null, current: 300, max: null },
      { name: 'Lockpicking', category: 'class', rank: 'Rank 2', current: 0, max: 150 },
    ] };
    const { unmount } = render(<CharacterCard character={character} gameSlug="wowforever"
      onUpdate={jest.fn()} onDelete={jest.fn()} onSetProfessionRank={jest.fn()} readOnly />);
    fireEvent.click(screen.getByText('Aster'));
    expect(screen.getByText('wowSkills.cooking')).toBeInTheDocument();
    expect(screen.getByText('Lockpicking')).toBeInTheDocument();
    expect(screen.getByText('Rank 2')).toHaveClass('text-slate-400');
    expect(screen.getByText('wowForever.professionRanks.expert')).toHaveClass('text-purple-400');
    expect(screen.getByText('180 / 225')).toBeInTheDocument();
    expect(screen.getByText('300 / ?')).toBeInTheDocument();
    expect(screen.getByText('0 / 150')).toBeInTheDocument();
    unmount();
    render(<ProfessionOverview characters={[character]} gameSlug="wowforever" groupSlug="guild" />);
    const card = within(screen.getByRole('heading', { name: /wowSkills.cooking/ }).closest('article')!);
    expect(card.getByText('180 / 225')).toBeInTheDocument();
    expect(card.getByText('wowForever.professionRanks.expert')).toHaveClass('text-purple-400');
    expect(card.getByRole('link', { name: 'Aster' })).toHaveAttribute('href', '/guild/wowforever/characters#character-main');
    expect(screen.queryByText('Lockpicking')).not.toBeInTheDocument();
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
