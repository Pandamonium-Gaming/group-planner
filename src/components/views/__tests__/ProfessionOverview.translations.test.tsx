import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ProfessionOverview } from '../ProfessionOverview';
import en from '../../../../public/locales/en-GB.json';
import es from '../../../../public/locales/es.json';
import nl from '../../../../public/locales/nl.json';
import type { CharacterWithProfessions } from '@/lib/types';

const character: CharacterWithProfessions = {
  id: 'main', group_id: 'group', user_id: 'user', name: 'Aster', race: null,
  primary_archetype: null, secondary_archetype: null, level: 1, is_main: true,
  created_at: '', professions: [], game_slug: 'wowforever', wow_profession_1: 'Alchemy',
};

describe('profession summary localization', () => {
  const previousFetch = global.fetch;
  afterEach(() => { global.fetch = previousFetch; localStorage.clear(); });

  it.each([['en-GB', en], ['es', es], ['nl', nl]] as const)('interpolates real %s locale counts and updates them', async (language, locale) => {
    localStorage.setItem('language', language);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => locale });
    render(<LanguageProvider><ProfessionOverview characters={[character,
      { ...character, id: 'alt', name: 'Briar', is_main: false, wow_profession_1: 'Tailoring' }]}
      gameSlug="wowforever" groupSlug="guild" /></LanguageProvider>);
    const contributors = locale.professionOverview.contributors.replace('{{count}}', '2');
    await waitFor(() => expect(screen.getByText(contributors)).toBeInTheDocument());
    expect(screen.getByText(locale.professionOverview.covered.replace('{{covered}}', '2').replace('{{total}}', '9')))
      .toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(locale.professionOverview.filter), { target: { value: 'main' } });
    expect(screen.getByText(locale.professionOverview.contributors.replace('{{count}}', '1'))).toBeInTheDocument();
    expect(screen.queryByText(/\{count\}/)).not.toBeInTheDocument();
  });
});
