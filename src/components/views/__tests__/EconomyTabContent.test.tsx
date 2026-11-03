import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EconomyTabContent } from '../EconomyTabContent';
import EconomyPage from '@/app/[group]/[game]/economy/page';
import type { GuildBank, ResourceCatalog } from '@/lib/types';

(globalThis as { React?: typeof React }).React = React;

const bank: GuildBank = {
  id: 'wow-bank', group_id: 'group', game_slug: 'wowforever', name: 'WoW Bank',
  deposit_min_role: 'member', withdraw_min_role: 'officer', gold_balance: 0,
  created_at: '', updated_at: '',
};
const resource: ResourceCatalog = {
  id: 'wow-cloth', game_slug: 'wowforever', name: 'Runecloth', category: 'raw_material',
  rarity: 'common', base_value: 0, is_craftable: false, created_at: '',
};
const mockUseGuildBank = jest.fn();
const mockUseFreeholds = jest.fn();
const mockUseCaravans = jest.fn();
const mockHasPermission = jest.fn();
let mockGameSlug = 'wowforever';
const deposit = jest.fn();
const withdraw = jest.fn();
const initializeBank = jest.fn();
const bankState = () => ({
  bank: bank as GuildBank | null, inventory: [], transactions: [], resourceCatalog: [resource],
  loading: false, error: null as string | null, deposit, withdraw, initializeBank,
});

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
jest.mock('@/contexts/GameLayoutContext', () => ({
  useGameLayoutContext: () => ({
    group: { id: 'group' }, userId: 'user', gameSlug: mockGameSlug,
    canManageMembers: true, hasPermission: mockHasPermission,
  }),
}));
jest.mock('@/hooks/useGuildBank', () => ({
  useGuildBank: (...args: unknown[]) => mockUseGuildBank(...args),
}));
jest.mock('@/hooks/useFreeholds', () => ({
  useFreeholds: (...args: unknown[]) => mockUseFreeholds(...args),
}));
jest.mock('@/hooks/useCaravans', () => ({
  useCaravans: (...args: unknown[]) => mockUseCaravans(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGameSlug = 'wowforever';
  deposit.mockResolvedValue(undefined);
  withdraw.mockResolvedValue(undefined);
  initializeBank.mockResolvedValue(bank);
  mockUseGuildBank.mockReturnValue(bankState());
  mockUseFreeholds.mockReturnValue({ freeholds: [], loading: false });
  mockUseCaravans.mockReturnValue({ upcomingCaravans: [], loading: false, createCaravan: jest.fn() });
  mockHasPermission.mockReturnValue(true);
});

it('opens only the WoW bank and submits a selected WoW item deposit', async () => {
  render(<EconomyPage />);
  expect(mockUseGuildBank).toHaveBeenCalledWith('group', 'wowforever');
  expect(mockUseFreeholds).toHaveBeenCalledWith(null);
  expect(mockUseCaravans).toHaveBeenCalledWith(null);
  expect(screen.queryByRole('button', { name: 'freehold.title' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'caravan.title' })).not.toBeInTheDocument();
  expect(screen.getByText('WoW Bank')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'bank.deposit' }));
  const dialog = screen.getByRole('dialog');
  const item = within(dialog).getByRole('button', { name: /Runecloth/ });
  await waitFor(() => expect(item).toBeInTheDocument());
  fireEvent.click(item);
  fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '12' } });
  fireEvent.submit(within(dialog).getByRole('button', { name: 'bank.deposit' }).closest('form')!);
  await waitFor(() => expect(deposit).toHaveBeenCalledWith({
    resource_id: 'wow-cloth', quantity: 12, notes: undefined,
  }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('retains the Ashes economy sections and defaults bank queries to Ashes', () => {
  render(<EconomyTabContent groupId="group" isOfficer canManageBank />);
  expect(mockUseGuildBank).toHaveBeenCalledWith('group', 'aoc');
  expect(mockUseFreeholds).toHaveBeenCalledWith('group');
  expect(mockUseCaravans).toHaveBeenCalledWith('group');
  expect(screen.getByRole('button', { name: 'freehold.title' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'caravan.title' })).toBeInTheDocument();
});

it('honours the existing deposit, withdrawal and management permissions', () => {
  mockHasPermission.mockReturnValue(false);
  mockGameSlug = 'aoc';
  render(<EconomyPage />);
  expect(screen.queryByRole('button', { name: 'bank.deposit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'bank.withdraw' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'caravan.title' }));
  expect(screen.getByRole('button', { name: /caravan.createCaravan/ })).toBeInTheDocument();
});

it('uses bank-management permission separately from officer status when initializing a bank', () => {
  mockHasPermission.mockReturnValue(false);
  mockUseGuildBank.mockReturnValue({ ...bankState(), bank: null });
  render(<EconomyPage />);
  expect(screen.getAllByRole('button', { name: 'bank.title' })).toHaveLength(1);
});

it('initializes the selected bank and displays creation failures instead of rejecting silently', async () => {
  mockUseGuildBank.mockReturnValue({ ...bankState(), bank: null });
  initializeBank.mockRejectedValue(new Error('Bank creation failed'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<EconomyPage />);
    const buttons = screen.getAllByRole('button', { name: 'bank.title' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(initializeBank).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bank creation failed');
  } finally {
    log.mockRestore();
  }
});

it('does not present a bank creation button when loading failed', () => {
  mockUseGuildBank.mockReturnValue({ ...bankState(), bank: null, error: 'Apply migration 024' });
  render(<EconomyPage />);
  expect(screen.getByRole('alert')).toHaveTextContent('Apply migration 024');
  expect(screen.getAllByRole('button', { name: 'bank.title' })).toHaveLength(1);
});
