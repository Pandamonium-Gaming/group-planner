import React from 'react';
import { render, screen } from '@testing-library/react';
import { PermissionsSettings } from '../PermissionsSettings';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ session: null }) }));
jest.mock('@/lib/authStack', () => ({ getClientAuthStack: () => 'v1' }));

it('renders Pending only once as immutable while preserving editable roles', () => {
  render(<PermissionsSettings groupId="group-1" userRole="admin" />);
  const pending = screen.getAllByRole('button', { name: /Pending/ });
  expect(pending).toHaveLength(1);
  expect(pending[0]).toBeDisabled();
  expect(screen.getByRole('button', { name: /Admin.*immutable/ })).toBeDisabled();
  for (const role of ['Officer', 'Member', 'Trial']) {
    expect(screen.getByRole('button', { name: new RegExp(role) })).toBeEnabled();
  }
});
