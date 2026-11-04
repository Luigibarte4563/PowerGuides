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
  variant = 'default',
}) {
  const iconTones = {
    primary: 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
    info: 'bg-info-50 text-info-700 dark:bg-info-500/15 dark:text-info-200',
    success: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-200',
    warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-200',
    danger: 'bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-200',
    navy: 'bg-navy-100 text-navy-700 dark:bg-navy-700 dark:text-navy-200',
  };

  // The compact dark row used inside MapWorkspace asides — same recipe as the
  // Outages feed rows: 10px padding, 13px title, 11px description, 9px meta.
  const feed = variant === 'feed';

  // A card that renders its own actions stays a <div>: nesting buttons inside a
  // link is invalid HTML. Callers pass an explicit "View" action instead.
  const Wrapper = to && !actions ? Link : 'div';

  return (
    <Wrapper
      to={to}
      className={clsx(
        'block',
        feed
          ? 'rounded-xl border border-white/5 bg-[#1C1D30]/35 p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-white/15'
          : 'rounded-card border border-navy-100 bg-white p-4 shadow-card dark:border-navy-700 dark:bg-navy-800 dark:shadow-card-dark',
        to &&
          !feed &&
          'transition hover:border-primary-200 hover:shadow-card-hover dark:hover:border-primary-500/40',
        className
      )}
    >
      {!feed && (
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-control', iconTones[iconTone] || iconTones.primary)}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}

          <div className="min-w-0 flex-1">
            <DefaultCardBody
              title={title}
              subtitle={subtitle}
              badges={badges}
              description={description}
              meta={meta}
              actions={actions}
              footer={footer}
            >
              {children}
            </DefaultCardBody>
          </div>
        </div>
      )}

      {feed && (
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {badges.filter(Boolean).map((badge, index) => (
                <Badge key={badge.key || badge.label || index} tone={badge.tone} icon={badge.icon} size="xs">
                  {badge.label}
                </Badge>
              ))}
            </div>
            {subtitle ? (
              <span className="shrink-0 truncate text-[8.5px] font-medium text-white/35">{subtitle}</span>
            ) : null}
          </div>

          <h3 className="mt-1 truncate text-[13px] font-bold leading-tight text-white">{title}</h3>

          {description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-white/50">{description}</p>
          ) : null}

          {meta.length || actions ? (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {meta.length ? (
                <dl className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/40">
                  {meta.map((item) => (
                    <span key={item.label} className="flex min-w-0 items-center gap-1">
                      {item.icon ? (
                        <item.icon className="h-2.5 w-2.5 shrink-0 text-[#FFBB02]/60" aria-hidden="true" />
                      ) : null}
                      <dt className="sr-only">{item.label}</dt>
                      <dd className="truncate">{item.value}</dd>
                    </span>
                  ))}
                </dl>
              ) : (
                <span />
              )}
              {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
            </div>
          ) : null}

          {children}

          {footer ? (
            <div className="mt-2 border-t border-white/5 pt-2 text-[9px] text-white/40">{footer}</div>
          ) : null}
        </div>
      )}
    </Wrapper>
  );
}

/** The body layout of the roomy card variant (shared markup, dark-aware). */
function DefaultCardBody({ title, subtitle, badges, description, meta, actions, footer, children }) {
  return (
    <>
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
    </>
  );
}
