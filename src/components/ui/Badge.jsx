import clsx from 'clsx';

const TONES = {
  neutral: 'bg-navy-100 text-navy-700 ring-navy-200 dark:bg-navy-700 dark:text-navy-100 dark:ring-navy-600',
  info: 'bg-info-50 text-info-700 ring-info-200 dark:bg-info-500/20 dark:text-info-200 dark:ring-info-500/40',
  success: 'bg-success-50 text-success-700 ring-success-200 dark:bg-success-500/20 dark:text-success-200 dark:ring-success-500/40',
  warning: 'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-500/20 dark:text-warning-200 dark:ring-warning-500/40',
  danger: 'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-500/20 dark:text-danger-200 dark:ring-danger-500/40',
  primary: 'bg-primary-100 text-primary-800 ring-primary-200 dark:bg-primary-500/20 dark:text-primary-200 dark:ring-primary-500/40',
  navy: 'bg-navy-800 text-white ring-navy-800 dark:bg-navy-700 dark:text-white dark:ring-navy-600',
};

/**
 * Badge for severity, status and any other short label.
 * Status is always colour + text (never colour alone).
 */
export default function Badge({
  children,
  tone = 'neutral',
  icon: Icon,
  size = 'md',
  className,
  title,
}) {
  if (children === undefined || children === null || children === '') return null;

  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {Icon ? <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export { TONES as BADGE_TONES };
