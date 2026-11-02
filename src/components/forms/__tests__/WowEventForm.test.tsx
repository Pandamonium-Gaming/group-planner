import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventForm } from '../EventForm';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
const initial = { title: 'Dungeon night', starts_at: '2026-11-04T19:00:00Z' };

it('portals the dialog outside page stacking contexts and keeps actions outside the scrolling fields', () => {
  const { container } = render(<div style={{ transform: 'translateZ(0)' }}>
    <EventForm groupId="group" userId="user" gameSlug="wowforever"
      onSubmit={jest.fn()} onCancel={jest.fn()} />
  </div>);
  const dialog = screen.getByRole('dialog', { name: 'Create Event' });
  expect(container).not.toContainElement(dialog);
  expect(dialog.parentElement?.parentElement).toBe(document.body);
  const actions = screen.getByRole('button', { name: 'Create Event' }).parentElement!;
  expect(actions.previousElementSibling).toHaveClass('overflow-y-auto', 'min-h-0');
  expect(actions).toHaveClass('shrink-0');
});

it('offers only WoW types and submits the selected new type', async () => {
  const submit = jest.fn().mockResolvedValue(undefined);
  render(<EventForm groupId="group" userId="user" gameSlug="wowforever"
    initialData={initial} onSubmit={submit} onCancel={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'wowForever.eventTypes.dungeon' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'wowForever.eventTypes.leveling' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Farming|Siege/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'wowForever.eventTypes.battleground_pvp' }));
  fireEvent.submit(screen.getByRole('button', { name: /Create Event/ }).closest('form')!);
  await waitFor(() => expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({ event_type: 'battleground_pvp' }), true));
});

it('turns a legacy WoW siege into Dungeon when explicitly saving an edit', async () => {
  const submit = jest.fn().mockResolvedValue(undefined);
  render(<EventForm groupId="group" userId="user" gameSlug="wowforever" isEditing
    initialData={{ ...initial, event_type: 'siege' }} onSubmit={submit} onCancel={jest.fn()} />);
  fireEvent.submit(screen.getByRole('button', { name: /Save/ }).closest('form')!);
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'dungeon' }), true));
});
