import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Accessible modal dialog: focus trap on open, Escape to close, backdrop click
 * to dismiss, body scroll lock, and `aria-modal` labelling.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  className,
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && onClose) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      const target = panelRef.current?.querySelector('[data-autofocus]') || panelRef.current;
      target?.focus?.();
    }, 30);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
      <div
        className="fixed inset-0 bg-navy-950/50 animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={clsx(
          'relative z-10 w-full animate-slide-up rounded-t-2xl bg-white shadow-pop focus:outline-none dark:bg-navy-800 dark:shadow-pop-dark sm:rounded-card',
          SIZES[size] || SIZES.md,
          className
        )}
      >
        {title ? (
          <div className="flex items-start justify-between gap-4 border-b border-navy-100 p-5 dark:border-navy-700">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-navy-900 dark:text-white">{title}</h2>
              {description ? <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">{description}</p> : null}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="-m-1 rounded-control p-1 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 dark:hover:bg-navy-700 dark:hover:text-white"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-navy-100 bg-navy-50/60 p-4 dark:border-navy-700 dark:bg-navy-900/60 sm:rounded-b-card">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
