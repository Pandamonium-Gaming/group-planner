import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { GroupSettingsTabs } from '../GroupSettingsTabs';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
const panels = {
  general: 'General content', members: 'Member content', permissions: 'Permission content',
  discord: 'Discord content', admin: 'Admin content', recruitment: 'Recruitment content', games: 'Games content',
};
beforeEach(() => { window.history.replaceState(null, '', '/guild/settings'); });

it('opens directly linked tabs and supports hash navigation', () => {
  window.history.replaceState(null, '', '/guild/settings#members');
  render(<GroupSettingsTabs panels={panels} />);
  expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('groupSettingsTabs.members');
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Member content');
  act(() => {
    window.location.hash = 'permissions';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Permission content');
});

it('supports keyboard navigation, focus and a safe default for unknown links', () => {
  window.history.replaceState(null, '', '/guild/settings#unknown');
  render(<GroupSettingsTabs panels={panels} />);
  const first = screen.getByRole('tab', { name: 'groupSettingsTabs.general' });
  expect(first).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(first, { key: 'End' });
  act(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  const last = screen.getByRole('tab', { name: 'groupSettingsTabs.games' });
  expect(last).toHaveFocus();
  expect(last).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(last, { key: 'ArrowRight' });
  act(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  expect(first).toHaveFocus();
});
