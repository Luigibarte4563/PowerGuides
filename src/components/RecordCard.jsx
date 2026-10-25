import clsx from 'clsx';
import { Link } from 'react-router-dom';
import Badge from './ui/Badge';

/**
 * Card used for every record in the responsive lists (mobile cards /
 * desktop table rows share the same data).
 */
export default function RecordCard({
  title,
  subtitle,
  icon: Icon,
  iconTone = 'primary',
  badges = [],
  description,
  meta = [],
  actions,
  footer,
  to,
  className,
  children,
}) {
  const iconTones = {
    primary: 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
    info: 'bg-info-50 text-info-700 dark:bg-info-500/15 dark:text-info-200',
    success: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-200',
    warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-200',
    danger: 'bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-200',
    navy: 'bg-navy-100 text-navy-700 dark:bg-navy-700 dark:text-navy-200',
  };

  // A card that renders its own actions stays a <div>: nesting buttons inside a
  // link is invalid HTML. Callers pass an explicit "View" action instead.
  const Wrapper = to && !actions ? Link : 'div';

  return (
    <Wrapper
      to={to}
      className={clsx(
        'block rounded-card border border-navy-100 bg-white p-4 shadow-card dark:border-navy-700 dark:bg-navy-800 dark:shadow-card-dark',
        to &&
          'transition hover:border-primary-200 hover:shadow-card-hover dark:hover:border-primary-500/40',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-control', iconTones[iconTone] || iconTones.primary)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-navy-900 dark:text-white">{title}</h3>
              {subtitle ? <p className="mt-0.5 truncate text-xs text-navy-500 dark:text-navy-400">{subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {badges.filter(Boolean).map((badge, index) => (
                <Badge key={badge.key || badge.label || index} tone={badge.tone} icon={badge.icon} size="sm">
                  {badge.label}
                </Badge>
              ))}
            </div>
          </div>

          {description ? (
            <p className="mt-2 line-clamp-2 text-sm text-navy-600 dark:text-navy-300">{description}</p>
          ) : null}

          {meta.length ? (
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-500 dark:text-navy-400">
              {meta.map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  {item.icon ? <item.icon className="h-3.5 w-3.5 text-navy-400 dark:text-navy-500" aria-hidden="true" /> : null}
                  <dt className="sr-only">{item.label}</dt>
                  <dd className="font-medium text-navy-600 dark:text-navy-300">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {children}

          {actions ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}

          {footer ? (
            <div className="mt-3 border-t border-navy-100 pt-3 text-xs text-navy-500 dark:border-navy-700 dark:text-navy-400">{footer}</div>
          ) : null}
        </div>
      </div>
    </Wrapper>
  );
}
