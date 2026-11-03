'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { splitWowCopper } from '@/games/wowforever/currency';

export function BankMoney({ amount, gameSlug }: { amount: number; gameSlug: string }) {
  const { t, language } = useLanguage();
  if (gameSlug !== 'wowforever') return <>{amount.toLocaleString(language)}</>;

  const coins = splitWowCopper(amount);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {amount < 0 && <span>-</span>}
      {(['gold', 'silver', 'copper'] as const).map(coin => (
        <span key={coin} className={coin === 'gold' ? 'text-yellow-400' : coin === 'silver' ? 'text-slate-300' : 'text-orange-400'}
          title={t(`bank.${coin}`)}>
          {coins[coin].toLocaleString(language)}
          <span aria-hidden="true">{t(`bank.${coin}Short`)}</span>
          <span className="sr-only"> {t(`bank.${coin}`)}</span>
        </span>
      ))}
    </span>
  );
}
