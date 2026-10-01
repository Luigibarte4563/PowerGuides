/**
 * Page header used by every dashboard page: title, description, actions.
 */
export default function PageHeader({ title, description, actions, breadcrumbs, className }) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className || ''}`}>
      <div className="min-w-0">
        {breadcrumbs ? <div className="mb-1">{breadcrumbs}</div> : null}
        <h1 className="text-xl font-extrabold text-navy-900 dark:text-white sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-navy-500 dark:text-navy-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
