import clsx from 'clsx';

/** Responsive table wrapper (horizontal scroll on small screens). */
export function Table({ children, className }) {
  return (
    <div className={clsx('-mx-px overflow-x-auto', className)}>
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className="border-b border-navy-100 bg-navy-50/70 text-xs uppercase tracking-wide text-navy-500 dark:border-navy-700 dark:bg-navy-900/70 dark:text-navy-400">
      {children}
    </thead>
  );
}

export function TH({ children, className, align = 'left', ...rest }) {
  return (
    <th
      scope="col"
      className={clsx(
        'whitespace-nowrap px-4 py-3 font-semibold',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-navy-100 dark:divide-navy-700">{children}</tbody>;
}

export function TR({ children, className, ...rest }) {
  return (
    <tr className={clsx('transition hover:bg-navy-50/60 dark:hover:bg-navy-700/40', className)} {...rest}>
      {children}
    </tr>
  );
}

export function TD({ children, className, align = 'left', ...rest }) {
  return (
    <td
      className={clsx(
        'px-4 py-3 align-middle text-navy-700 dark:text-navy-200',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export default Table;
