import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { Button } from './Button';

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <Loader2 className={clsx('h-5 w-5 animate-spin text-primary-500', className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Full-block loading state for a panel or page section. */
export function LoadingState({ label = 'Loading…', className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3 px-4 py-12 text-center', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary-500" aria-hidden="true" />
      <p className="text-sm font-medium text-navy-500" role="status" aria-live="polite">
        {label}
      </p>
    </div>
  );
}

/** Skeleton placeholder block used while lists load. */
export function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-control bg-navy-100', className)} aria-hidden="true" />;
}

export function SkeletonList({ rows = 3, className }) {
  return (
    <div className={clsx('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-card border border-navy-100 bg-white p-4 shadow-card">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Empty state with an optional call to action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-navy-200 bg-white/60 text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className
      )}
    >
      {Icon ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      ) : null}
      <div>
        <p className="text-base font-bold text-navy-800">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-md text-sm text-navy-500">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/**
 * Error state with a retry action. Messages passed in are already
 * human-readable (see `toUserMessage`) - raw payloads are never rendered.
 */
export function ErrorState({ message, onRetry, className, compact = false, title = 'We could not load this' }) {
  return (
    <div
      role="alert"
      className={clsx(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-danger-200 bg-danger-50 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-danger-600">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-bold text-danger-700">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-navy-700">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Renders the right state for a query result in one place, so every module
 * handles loading / empty / error consistently.
 */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  errorMessage,
  onRetry,
  loadingLabel,
  empty,
  children,
}) {
  if (isLoading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState message={errorMessage} onRetry={onRetry} />;
  if (isEmpty) return empty || null;
  return children;
}

export default LoadingState;
