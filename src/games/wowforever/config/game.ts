import { GameConfig } from '@/lib/games';
import { WOW_FOREVER_DATA } from './index';

export const WOW_FOREVER_CONFIG: GameConfig & {
  data: typeof WOW_FOREVER_DATA;
  ranks: never[];
  roles: never[];
} = {
  id: 'wowforever',
  name: 'WoW Forever',
  description: 'Character, event, and party planning for World of Warcraft: Forever',
  icon: '⚔️',
  features: {
    characters: true,
    events: true,
    parties: true,
    alliances: true,
    manage: true,
    professions: true,
    economy: false,
    achievements: false,
    siege: false,
    ships: false,
    matrix: false,
  },
  data: WOW_FOREVER_DATA,
  ranks: [],
  roles: [],
};
