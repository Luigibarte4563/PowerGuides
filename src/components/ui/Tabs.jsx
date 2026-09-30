import clsx from 'clsx';

/**
 * Accessible tab strip. `tabs` = [{ value, label, count? }].
 * Roving focus is provided by real buttons with `role="tab"`.
 */
export default function Tabs({ tabs = [], value, onChange, className, size = 'md', ariaLabel = 'Sections' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        'flex w-full gap-1 overflow-x-auto rounded-card border border-navy-100 bg-white p-1 shadow-card',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={clsx(
              'flex shrink-0 items-center gap-2 rounded-control px-3.5 py-2 font-semibold transition',
              isActive
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-navy-600 hover:bg-navy-100 hover:text-navy-900'
            )}
          >
            {tab.icon ? <tab.icon className="h-4 w-4" aria-hidden="true" /> : null}
            {tab.label}
            {tab.count !== undefined && tab.count !== null ? (
              <span
                className={clsx(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                  isActive ? 'bg-white/20 text-white' : 'bg-navy-100 text-navy-600'
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
