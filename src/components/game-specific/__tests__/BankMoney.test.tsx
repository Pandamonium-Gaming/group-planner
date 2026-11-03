import React from 'react';
import { render, screen } from '@testing-library/react';
import { BankMoney } from '../BankMoney';
import en from '../../../../public/locales/en-GB.json';
import es from '../../../../public/locales/es.json';
import nl from '../../../../public/locales/nl.json';

let mockLanguage = 'en-GB';
let mockBankLabels = en.bank;
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: mockLanguage,
    t: (key: string) => mockBankLabels[key.split('.')[1] as keyof typeof mockBankLabels],
  }),
}));

it.each([['en-GB', en.bank], ['es', es.bank], ['nl', nl.bank]] as const)(
  'displays copper balances and signed history amounts with localised denominations in %s',
  (language, labels) => {
    mockLanguage = language;
    mockBankLabels = labels;
    const { rerender, container } = render(<BankMoney amount={123456} gameSlug="wowforever" />);
    expect(screen.getByTitle(labels.gold)).toHaveTextContent(`12${labels.goldShort}`);
    expect(screen.getByTitle(labels.silver)).toHaveTextContent(`34${labels.silverShort}`);
    expect(screen.getByTitle(labels.copper)).toHaveTextContent(`56${labels.copperShort}`);
    rerender(<BankMoney amount={-1} gameSlug="wowforever" />);
    expect(container.textContent).toMatch(/^-/);
    expect(screen.getByTitle(labels.gold)).toHaveTextContent(`0${labels.goldShort}`);
    expect(screen.getByTitle(labels.silver)).toHaveTextContent(`0${labels.silverShort}`);
    expect(screen.getByTitle(labels.copper)).toHaveTextContent(`1${labels.copperShort}`);
    rerender(<BankMoney amount={0} gameSlug="wowforever" />);
    expect(container.textContent).not.toMatch(/^-/);
    expect(screen.getByTitle(labels.copper)).toHaveTextContent(`0${labels.copperShort}`);
  }
);

it('preserves whole-gold display for Ashes', () => {
  mockLanguage = 'en-GB';
  const { container } = render(<BankMoney amount={123456} gameSlug="aoc" />);
  expect(container).toHaveTextContent('123,456');
  expect(container.querySelector('[title]')).toBeNull();
});
