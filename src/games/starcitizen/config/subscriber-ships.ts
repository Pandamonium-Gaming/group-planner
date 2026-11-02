/**
 * Star Citizen Subscriber Ship Promotions
 *
 * These are the ships granted to subscribers each month based on their subscription tier.
 * Updated monthly from https://robertsspaceindustries.com/en/comm-link/
 *
 * ⚠️  IMPORTANT: After updating this file, the app must be rebuilt/redeployed to reflect changes.
 * The config is cached at build time. Simply pushing changes won't update the running app.
 *
 * For local development: `yarn dev` (Next.js watch mode auto-rebuilds)
 * For production: Deployment/rebuild required (see CI/CD pipeline)
 *
 * Tiers:
 * - centurion: Base subscription ($10/month) - Gold/Bronze branding
 * - imperator: Premium subscription ($20/month) - Platinum/Silver branding
 *
 * Source: https://robertsspaceindustries.com/pledge/subscriptions
 * Comm-Link Pattern: https://robertsspaceindustries.com/comm-link/transmission/[ID]-[Month]-[Year]-Subscriber-Promotions
 */

/**
 * Subscriber tier branding colors
 * Based on RSI's official subscriber page styling
 */
export const SUBSCRIBER_COLORS = {
  centurion: {
    primary: '#54ADF7',   // Centurion blue (rgb(84, 173, 247))
    secondary: '#3A7FBC', // Darker blue
    bg: '#152332',        // Dark blue tint
    border: '#2E5B7E',    // Steel blue
  },
  imperator: {
    primary: '#DBAF70',   // Imperator gold (rgb(219, 175, 112))
    secondary: '#B98E57', // Darker gold
    bg: '#2B2014',        // Dark gold tint
    border: '#7A5A2F',    // Bronze
  },
} as const;

/**
 * Official RSI subscriber icon (path data)
 */
export const SUBSCRIBER_ICON = {
  viewBox: '0 0 160 40',
  path: 'M32.527 31.958h.365l-.521 1.873H32zM40.099 27.465l.521-1.873h-.34l-.526 1.873zM39.922 25.592l-.521 1.873h-.346l.526-1.873zM43.384 26.09c0-.343.166-.5.531-.5.366 0 .532.157.532.5s-.166.499-.532.499c-.365 0-.532-.157-.532-.5m.983 0c0-.293-.142-.425-.453-.425-.31 0-.452.132-.452.424 0 .293.141.425.452.425s.453-.133.453-.425m-.237-.085c0 .098-.028.138-.108.152l.12.18c.006.004.003.01-.006.01h-.1c-.012 0-.016-.003-.021-.012l-.118-.17h-.06v.172q.002.01-.008.009h-.096q-.012.001-.01-.01v-.485q0-.008.009-.008a2 2 0 0 1 .193-.006c.152 0 .205.038.205.168m-.292-.076v.155h.075c.076 0 .099-.013.099-.076 0-.064-.023-.079-.1-.079zM49.796 24.717h.668v9.988h-.668zM59.427 26.343l1.544.326c.253.065.253.4 0 .465l-1.544.326a.36.36 0 0 0-.267.222l-.424 1.54c-.07.236-.429.236-.498 0l-.425-1.54a.36.36 0 0 0-.267-.222l-1.544-.326a.238.238 0 0 1 0-.465l1.544-.326a.36.36 0 0 0 .267-.221l.425-1.54c.07-.236.428-.236.498 0l.424 1.54a.36.36 0 0 0 .267.221M67.722 28.282l3.087.651c.507.13.507.8 0 .931l-3.087.652c-.26.059-.463.227-.534.443l-.849 3.079c-.139.473-.858.473-.996 0l-.849-3.08c-.071-.215-.274-.383-.534-.442l-3.088-.652a.475.475 0 0 1 0-.93l3.088-.652c.26-.06.463-.228.534-.443l.849-3.08c.138-.473.857-.473.996 0l.849 3.08c.071.215.274.384.534.443M77.308 25.453c.887 0 1.305.05 2.15.17.128.02.17.07.17.16v.62c0 .11-.053.17-.16.17h-2.47c-.803 0-1.199.239-1.199.768v.16c0 .42.15.67.717.889l2.172.809c1.005.38 1.347.899 1.347 1.868v.31c0 1.497-1.262 1.817-2.941 1.817-.835 0-1.68-.05-2.632-.18-.107-.02-.15-.07-.15-.18v-.599c0-.11.054-.16.172-.16h2.984c.792 0 .1.188-.22 1.188-.749v-.17c0-.459-.182-.729-.792-.958l-2.31-.85c-.867-.299-1.134-.898-1.134-1.857v-.23c0-1.498 1.187-1.808 2.888-1.808M85.012 27.62h.984q.161 0 .161.15v5.095c0 .13-.053.14-.16.16-.792.15-1.744.17-2.386.17-1.979 0-2.535-2.378v-3.046c0-.1.075-.15.182-.15h.963c.106 0 .15.05.15.15v2.826c0 1.478.245 1.548 1.25 1.548h1.231v-4.374q0-.15.16-.15M87.682 25.513h.984c.108 0 .161.04.161.15v1.968c.353-.04.813-.06 1.37-.06 1.978 0 2.438.6 2.438 2.816 0 2.228-.46 2.807-2.62 2.807-.77 0-1.38-.04-2.29-.18-.128-.02-.203-.07-.203-.21v-7.14c0-.11.053-.15.16-.15m2.31 3.107h-1.165v3.445c.374.05.856.08 1.198.08 1.198 0 1.316-.4 1.316-1.758 0-1.438-.15-1.767-1.348-1.767M95.96 27.57c.46 0 1.049.02 1.669.11.107.02.16.07.16.16v.59c0 .1-.053.15-.17.15H95.65c-.45 0-.706.13-.706.44v.119c0 .24.14.43.588.59l1.402.479c.941.33 1.09.839 1.09 1.458v.13c0 1.138-.812 1.398-2.213 1.398-.931 0-1.733-.06-2.086-.09-.129-.01-.16-.06-.16-.15v-.619c0-.11.042-.16.17-.16h2.076c.716 0 .94-.08.94-.43v-.099c0-.24-.127-.4-.609-.57l-1.412-.499c-.834-.28-1.07-.879-1.07-1.468v-.2c0-1.088.963-1.338 2.3-1.338M101.535 27.57c.428 0 1.123.02 1.69.11.107.02.16.07.16.18v.61c0 .1-.053.15-.171.15h-1.679c-1.145 0-1.294.35-1.294 1.758s.149 1.767 1.294 1.767h1.679c.118 0 .171.05.171.15v.61c0 .11-.053.16-.16.18-.567.09-1.262.11-1.69.11-2.172 0-2.6-.56-2.6-2.817 0-2.248.428-2.807 2.6-2.807M106.231 27.57c.278 0 1.016.03 1.305.11.107.03.171.07.171.18v.61c0 .11-.064.16-.181.15h-.974c-.642 0-.834.1-.834.539v3.835q0 .15-.161.15h-.973q-.16 0-.161-.150V28.85c0-1.188 1.017-1.278 1.808-1.278M109.203 25.354c.502 0 .77.25.77.689 0 .44-.268.689-.77.689-.503 0-.781-.25-.781-.69s.278-.688.781-.688m-.492 2.267h.973q.16 0 .16.15v5.223q0 .15-.16.15h-.973q-.16 0-.161-.150v-5.223q0-.15.161-.15M111.385 25.513h.984c.107 0 .16.04.16.15v1.968c.353-.04.813-.06 1.369-.06 1.979 0 2.439.6 2.439 2.816 0 2.228-.46 2.807-2.621 2.807-.77 0-1.379-.04-2.289-.18-.128-.02-.203-.07-.203-.210v-7.14c0-.11.054-.15.161-.15m2.31 3.107h-1.166v3.445c.375.05.856.08 1.198.08 1.198 0 1.316-.4 1.316-1.758 0-1.438-.15-1.767-1.348-1.767M119.898 27.57c2.011 0 2.481.54 2.503 2.708v.3c0 .189-.064.269-.364.269h-3.391c.032 1.059.289 1.298 1.327 1.298h1.829q.16 0 .16.15v.62c0 .11-.053.15-.149.17-.567.08-1.231.11-1.915.11-2.086 0-2.557-.56-2.557-2.808 0-2.257.471-2.816 2.557-2.816m0 1.05c-.995 0-1.241.28-1.252 1.358h2.45c-.011-1.079-.246-1.358-1.198-1.358M125.285 27.57c.278 0 1.016.03 1.305.11.107.03.171.07.171.18v.61c0 .11-.064.16-.182.15h-.973c-.642 0-.835.1-.835.539v3.835q0 .15-.16.15h-.973q-.16 0-.161-.150V28.85c0-1.188 1.016-1.278 1.808-1.278M129.732 27.57c.46 0 1.049.02 1.669.11.107.02.161.07.161.16v.59c0 .1-.054.15-.172.15h-1.968c-.449 0-.706.13-.706.44v.119c0 .24.139.43.589.59l1.401.479c.941.33 1.091.839 1.091 1.458v.13c0 1.138-.813 1.398-2.214 1.398-.931 0-1.733-.06-2.086-.09-.129-.01-.161-.060-.161-.15v-.619c0-.11.043-.16.172-.16h2.075c.716 0 .941-.08.941-.43v-.099c0-.24-.128-.4-.61-.57l-1.412-.499c-.834-.280-1.069-.879-1.069-1.468v-.2c0-1.088.962-1.338 2.299-1.338'
} as const;

/**
 * Subscriber tier metadata
 */
export const SUBSCRIBER_TIERS = {
  centurion: {
    label: 'Centurion',
    price: '$10/month',
    shipsPerMonth: 1,
    flairPerMonth: 1,
    insurance: '12 months',
    svgViewBox: '0 0 156 78',
    svgColor: '#54ADF7',
  },
  imperator: {
    label: 'Imperator',
    price: '$20/month',
    shipsPerMonth: 2,
    flairPerMonth: 2,
    insurance: '24 months',
    svgViewBox: '0 0 156 78',
    svgColor: '#DBAF70',
  },
} as const;

export interface SubscriberShipMonth {
  label: string; // e.g., "January 2026"
  centurion: string[]; // Ship IDs for base subscribers (from star-citizen-ships.json)
  imperator: string[]; // Ship IDs for premium subscribers (from star-citizen-ships.json)
  flair?: string; // Monthly cosmetic item
  notes?: string;
}

export const SUBSCRIBER_SHIPS: Record<string, SubscriberShipMonth> = {
  '2026-01': {
    label: 'January 2026',
    centurion: ['sabre'],
    imperator: ['sabre', 'sabre-firebird', 'sabre-peregrine'],
    flair: "CC's Conversions Azreal Helmet",
    notes: 'Sabre (12m insurance for Centurion, 24m for Imperator)',
  },
  '2026-02': {
    label: 'February 2026',
    centurion: ['starlancer-max'],
    imperator: ['starlancer-max', 'starlancer-tac'],
    flair: 'Coramor Décor Collection (Pink Heart Lamp, Carmilla Nightstand)',
    notes: 'Starlancer MAX (12m insurance for Centurion, 24m for Imperator)',
  },
  // Add more months as they're announced
  // '2026-03': { ... }

  '2026-03': {
    label: 'March 2026',
    centurion: ["apollo-medivac"],
    imperator: ["apollo-medivac", "ursa-medivac"],
    flair: 'Medical themed cosmetics and vehicles',
    notes: 'Auto-fetched from RSI comm-link. Ships have 12m insurance for Centurion, 24m for Imperator.',
  },
  '2026-05': {
    label: 'May 2026',
    centurion: ['dragonfly-black'],
    imperator: ['cutlass-black', 'dragonfly-black'],
    flair: "R6 Pro Yaeger Aviator Glasses, Behring P8-AR 'Dominion Camo' Rifle, Top Gunner's Kit",
    notes: 'Drake Dragonfly Black for Centurion (12m insurance), Drake Cutlass Black + Drake Dragonfly Black for Imperator (24m insurance).',
  },
};

/**
 * Get all ships a subscriber should have for a given month
 */
export function getSubscriberShips(
  tier: 'centurion' | 'imperator' | null | undefined,
  month?: string
): string[] {
  if (!tier) return [];

  const key = month || getCurrentMonthKey();
  const monthData = SUBSCRIBER_SHIPS[key];

  console.log('[getSubscriberShips]', { tier, month, key, monthData: monthData ? monthData.label : 'NOT FOUND', available: Object.keys(SUBSCRIBER_SHIPS) });

  if (!monthData) {
    console.log('[Subscriber Ships] No data found for month:', key, 'Available months:', Object.keys(SUBSCRIBER_SHIPS));
    return [];
  }

  const ships = tier === 'imperator' ? monthData.imperator : monthData.centurion;
  console.log(`[Subscriber Ships] Loading ships for ${tier} (${key}):`, ships);

  return ships;
}

/**
 * Get the current month key (YYYY-MM)
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const key = `${year}-${month}`;
  if (typeof window !== 'undefined') {
    console.log('[Subscriber Ships] Current month detected:', key, '(date:', now.toISOString(), ')');
  }
  return key;
}

/**
 * Get subscriber info for display
 */
export function getSubscriberMonthInfo(month?: string): SubscriberShipMonth | null {
  const key = month || getCurrentMonthKey();
  return SUBSCRIBER_SHIPS[key] || null;
}

/**
 * Check if a character has the current month's subscriber ships
 * (useful for detecting if ships need to be re-synced when tier changes)
 */
export function hasCurrentSubscriberShips(
  characterShips: string[],
  subscriberTier: string | null | undefined,
  month?: string
): boolean {
  if (!subscriberTier) return false;

  const shouldHave = getSubscriberShips(subscriberTier as any, month);
  return shouldHave.every(ship => characterShips.includes(ship));
}
