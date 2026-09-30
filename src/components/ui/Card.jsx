import clsx from 'clsx';
import { Link } from 'react-router-dom';

/** Card: the standard white surface used across every page. */
export function Card({ children, className, as: Tag = 'div', ...rest }) {
  return (
    <Tag className={clsx('rounded-card border border-navy-100 bg-white shadow-card', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ children, className, description, action }) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3 border-b border-navy-100 p-5', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-navy-900">{children}</h2>
        {description ? <p className="mt-1 text-sm text-navy-500">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className, ...rest }) {
  return (
    <div className={clsx('p-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-2 border-t border-navy-100 px-5 py-3', className)}>
      {children}
    </div>
  );
}

/** Summary card for the dashboard overview. */
export function StatCard({ label, value, icon: Icon, tone = 'primary', hint, to, action }) {
  const toneClasses = {
    primary: 'bg-primary-100 text-primary-700',
    info: 'bg-info-50 text-info-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    danger: 'bg-danger-50 text-danger-700',
    navy: 'bg-navy-100 text-navy-700',
  };

  const Wrapper = to ? Link : 'div';

  return (
    <Wrapper
      to={to}
      className={clsx(
        'flex items-start justify-between gap-3 rounded-card border border-navy-100 bg-white p-5 shadow-card',
        to && 'transition hover:border-primary-300 hover:shadow-card-hover'
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy-500">{label}</p>
        <p className="mt-2 text-2xl font-extrabold text-navy-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-navy-400">{hint}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
      {Icon ? (
        <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-control', toneClasses[tone] || toneClasses.primary)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}
    </Wrapper>
  );
}

export default Card;
