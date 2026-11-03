'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

/**
 * Responsive Modal Component
 * - Full-screen on mobile (< 640px)
 * - Centered overlay on desktop
 * - Closes with ESC key or clicking outside
 * - Traps Tab focus inside and restores focus to the opener on close
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  const { t } = useLanguage();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Size classes for desktop
  const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
  };

  // Keep the latest onClose without re-running the lifecycle effect when its identity changes
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Capture the opener during render: React autofocuses children in the commit phase,
  // before any effect runs, so reading it later could pick up the dialog's own input.
  const openerCaptured = useRef(false);
  if (isOpen && !openerCaptured.current && typeof document !== 'undefined') {
    openerCaptured.current = true;
    previousActiveElement.current = document.activeElement as HTMLElement | null;
  }

  // Escape, focus trap, scroll lock and focus restoration for the open lifecycle
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const container = modalRef.current;
      if (!container) return;
      // Query at key-press time so dynamic content is respected
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(el => el.tabIndex >= 0);

      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Lock body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      // Restore focus to the opener when the modal closes
      const opener = previousActiveElement.current;
      if (opener && document.contains(opener)) {
        opener.focus();
      }
      previousActiveElement.current = null;
      openerCaptured.current = false;
    };
  }, [isOpen]);

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`
          relative w-full outline-none bg-slate-900 border border-slate-700 shadow-xl
          h-full sm:h-auto sm:rounded-xl sm:mx-4 ${sizeClasses[size]}
          flex flex-col max-h-screen sm:max-h-[90vh]
          animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in duration-200
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 shrink-0">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-white"
          >
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 -m-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ModalFooterProps {
  children: ReactNode;
}

/**
 * Modal Footer - sticky at bottom
 * Use inside Modal children for action buttons
 */
export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-slate-800">
      {children}
    </div>
  );
}

