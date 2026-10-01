import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const TONE_STYLES = {
  success: {
    icon: CheckCircle2,
    wrapper:
      'border-success-200 bg-success-50 dark:border-success-500/40 dark:bg-success-500/15',
    iconColor: 'text-success-600 dark:text-success-200',
    titleColor: 'text-success-700 dark:text-success-200',
  },
  error: {
    icon: XCircle,
    wrapper: 'border-danger-200 bg-danger-50 dark:border-danger-500/40 dark:bg-danger-500/15',
    iconColor: 'text-danger-600 dark:text-danger-200',
    titleColor: 'text-danger-700 dark:text-danger-200',
  },
  warning: {
    icon: TriangleAlert,
    wrapper:
      'border-warning-200 bg-warning-50 dark:border-warning-500/40 dark:bg-warning-500/15',
    iconColor: 'text-warning-600 dark:text-warning-200',
    titleColor: 'text-warning-700 dark:text-warning-200',
  },
  info: {
    icon: Info,
    wrapper: 'border-info-200 bg-info-50 dark:border-info-500/40 dark:bg-info-500/15',
    iconColor: 'text-info-600 dark:text-info-200',
    titleColor: 'text-info-700 dark:text-info-200',
  },
};


/**
 * Lightweight toast provider: `useToast()` -> `{ success, error, warning, info }`.
 * Messages are plain text so raw server payloads are never shown.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, { tone = 'info', title = '', duration = 5000 } = {}) => {
      if (!message) return null;
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { id, message: String(message), tone, title }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message, options) => push(message, { ...options, tone: 'success' }),
      error: (message, options) => push(message, { ...options, tone: 'error', duration: 7000 }),
      warning: (message, options) => push(message, { ...options, tone: 'warning' }),
      info: (message, options) => push(message, { ...options, tone: 'info' }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[1000] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const style = TONE_STYLES[toast.tone] || TONE_STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            role="status"
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-card border p-4 shadow-pop dark:shadow-pop-dark ${style.wrapper}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {toast.title ? (
                <p className={`text-sm font-semibold ${style.titleColor}`}>{toast.title}</p>
              ) : null}
              <p className="text-sm text-navy-700 dark:text-navy-100">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded-control p-1 text-navy-400 transition hover:bg-white/60 hover:text-navy-700 dark:text-navy-300 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a <ToastProvider>');
  return context;
}
