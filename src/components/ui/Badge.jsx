import clsx from 'clsx';

const TONES = {
  neutral: 'bg-navy-100 text-navy-700 ring-navy-200',
  info: 'bg-info-50 text-info-700 ring-info-200',
  success: 'bg-success-50 text-success-700 ring-success-200',
  warning: 'bg-warning-50 text-warning-700 ring-warning-200',
  danger: 'bg-danger-50 text-danger-700 ring-danger-200',
  primary: 'bg-primary-100 text-primary-800 ring-primary-200',
  navy: 'bg-navy-800 text-white ring-navy-800',
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
