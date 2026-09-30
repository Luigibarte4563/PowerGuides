import clsx from 'clsx';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

/** Inline form-level error banner. Always human-readable text. */
export function AuthAlert({ children, className }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-2.5 rounded-control border border-danger-200 bg-danger-50 p-3.5 text-sm font-medium text-danger-700',
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Inline success banner (registration confirmations, saved settings). */
export function AuthSuccess({ children, className }) {
  if (!children) return null;
  return (
    <div
      role="status"
      className={clsx(
        'flex items-start gap-2.5 rounded-control border border-success-200 bg-success-50 p-3.5 text-sm font-medium text-success-700',
        className
      )}
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Neutral inline notice (tips, hints, permission messages). */
export function InfoNote({ children, className }) {
  if (!children) return null;
  return (
    <p className={clsx('rounded-control bg-navy-50 p-3 text-xs text-navy-600', className)}>{children}</p>
  );
}
