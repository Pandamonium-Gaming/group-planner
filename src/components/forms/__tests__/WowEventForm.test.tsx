import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventForm } from '../EventForm';

jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
const initial = { title: 'Dungeon night', starts_at: '2026-11-04T19:00:00Z' };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
    this.querySelector<HTMLElement>('button')?.focus();
  });
  HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

it('portals the dialog outside page stacking contexts and keeps actions outside the scrolling fields', () => {
  const { container } = render(<div style={{ transform: 'translateZ(0)' }}>
    <EventForm groupId="group" userId="user" gameSlug="wowforever"
      onSubmit={jest.fn()} onCancel={jest.fn()} />
  </div>);
  const dialog = screen.getByRole('dialog', { name: 'Create Event' });
  expect(container).not.toContainElement(dialog);
  expect(dialog.parentElement).toBe(document.body);
  const actions = screen.getByRole('button', { name: 'Create Event' }).parentElement!.parentElement!;
  expect(actions.previousElementSibling).toHaveClass('overflow-y-auto', 'min-h-0');
  expect(actions).toHaveClass('shrink-0');
});

it('opens natively as a modal, handles Escape and restores the opener on unmount', () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const cancel = jest.fn();
  const { unmount } = render(<EventForm groupId="group" userId="user" onSubmit={jest.fn()} onCancel={cancel} />);
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(cancel).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(cancel).toHaveBeenCalledTimes(2);
  unmount();
  expect(opener).toHaveFocus();
  opener.remove();
});

it('responds to visual viewport resize and pan, with whole-dialog scrolling at short heights', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const viewport = Object.assign(new EventTarget(), { height: 500, width: 390, offsetTop: 80, offsetLeft: 10 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  const { unmount } = render(<EventForm groupId="group" userId="user" onSubmit={jest.fn()} onCancel={jest.fn()} />);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveStyle({ top: '330px', left: '205px', maxHeight: '468px' });
  viewport.height = 120;
  viewport.offsetTop = 200;
  fireEvent(viewport, new Event('resize'));
  expect(dialog).toHaveStyle({ top: '260px', maxHeight: '88px' });
  expect(dialog).toHaveClass('overflow-y-auto', 'block');
  viewport.offsetTop = 250;
  fireEvent(viewport, new Event('scroll'));
  expect(dialog).toHaveStyle({ top: '310px' });
  unmount();
  if (original) Object.defineProperty(window, 'visualViewport', original);
  else Reflect.deleteProperty(window, 'visualViewport');
});

it('announces validation and save errors next to the action buttons', async () => {
  const submit = jest.fn().mockRejectedValue(new Error('Save failed'));
  const { rerender } = render(<EventForm groupId="group" userId="user" onSubmit={submit} onCancel={jest.fn()} />);
  const button = screen.getByRole('button', { name: 'Create Event' });
  fireEvent.submit(button.closest('form')!);
  expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
  expect(screen.getByRole('alert').parentElement).toContainElement(button);
  rerender(<EventForm key="save" groupId="group" userId="user" initialData={initial} onSubmit={submit} onCancel={jest.fn()} />);
  fireEvent.submit(screen.getByRole('button', { name: 'Create Event' }).closest('form')!);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Save failed'));
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

it('allows whole-dialog scrolling for an untruncated long save error at the 280px boundary', async () => {
  const originalHeight = window.innerHeight;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 280 });
  const message = 'The server could not save this event. '.repeat(100);
  const { unmount } = render(<EventForm groupId="group" userId="user" initialData={initial}
    onSubmit={jest.fn().mockRejectedValue(new Error(message))} onCancel={jest.fn()} />);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveClass('overflow-hidden');
  const button = screen.getByRole('button', { name: 'Create Event' });
  fireEvent.submit(button.closest('form')!);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message.trim()));
  expect(dialog).toHaveClass('block', 'overflow-y-auto');
  expect(dialog).not.toHaveClass('overflow-hidden');
  expect(screen.getByRole('alert')).toHaveClass('break-words');
  expect(button.closest('form')).toHaveClass('block');
  unmount();
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
});

it('turns a legacy WoW siege into Dungeon when explicitly saving an edit', async () => {
  const submit = jest.fn().mockResolvedValue(undefined);
  render(<EventForm groupId="group" userId="user" gameSlug="wowforever" isEditing
    initialData={{ ...initial, event_type: 'siege' }} onSubmit={submit} onCancel={jest.fn()} />);
  fireEvent.submit(screen.getByRole('button', { name: /Save/ }).closest('form')!);
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'dungeon' }), true));
});
