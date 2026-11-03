import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '../Modal';

// Jest uses the classic JSX transform; Modal relies on a global React.
(globalThis as { React?: typeof React }).React = React;

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key.split('.').pop() as string }),
}));

const tab = (shiftKey = false) => fireEvent.keyDown(document, { key: 'Tab', shiftKey });

function Harness({ onClose = () => {}, autoFocusInput = false, bare = false }: { onClose?: () => void; autoFocusInput?: boolean; bare?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>opener</button>
      <button onClick={() => setOpen(false)}>closer</button>
      <Modal isOpen={open} onClose={() => { onClose(); setOpen(false); }} title="T" showCloseButton={!bare}>
        {!bare && (
          <>
            <input aria-label="first" autoFocus={autoFocusInput} />
            <button disabled>disabled</button>
            <button tabIndex={-1}>skipped</button>
            <button>last</button>
          </>
        )}
      </Modal>
    </>
  );
}

describe('Modal focus management', () => {
  it('wraps Tab from the last focusable element to the first', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('opener'));
    const first = screen.getByLabelText('close');
    screen.getByText('last').focus();
    tab();
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first focusable element to the last', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('opener'));
    screen.getByLabelText('close').focus();
    tab(true);
    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('pulls focus back inside when it is outside the dialog', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('opener'));
    screen.getByText('closer').focus();
    tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('focuses the dialog container when nothing inside is focusable', () => {
    render(<Harness bare />);
    fireEvent.click(screen.getByText('opener'));
    tab();
    const container = document.activeElement as HTMLElement;
    expect(container.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('dialog').contains(container)).toBe(true);
  });

  it('restores focus to the opener, not the autofocused input', () => {
    render(<Harness autoFocusInput />);
    const opener = screen.getByText('opener');
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByLabelText('first'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
  });

  it('captures the opener once and keeps listeners stable across re-renders', () => {
    const add = jest.spyOn(document, 'addEventListener');
    const remove = jest.spyOn(document, 'removeEventListener');
    const { rerender } = render(<Modal isOpen onClose={() => {}} title="T"><input aria-label="x" autoFocus /></Modal>);
    const keydownAdds = () => add.mock.calls.filter(c => c[0] === 'keydown').length;
    const keydownRemoves = () => remove.mock.calls.filter(c => c[0] === 'keydown').length;
    const before = [keydownAdds(), keydownRemoves()];
    rerender(<Modal isOpen onClose={() => {}} title="T"><input aria-label="x" autoFocus /></Modal>);
    rerender(<Modal isOpen onClose={() => {}} title="T"><input aria-label="x" autoFocus /></Modal>);
    expect([keydownAdds(), keydownRemoves()]).toEqual(before);
    add.mockRestore();
    remove.mockRestore();
  });

  it('uses the latest onClose for Escape', () => {
    const a = jest.fn();
    const b = jest.fn();
    const { rerender } = render(<Modal isOpen onClose={a} title="T">x</Modal>);
    rerender(<Modal isOpen onClose={b} title="T">x</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and restores body scroll', () => {
    const onClose = jest.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText('opener'));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
  });
});
