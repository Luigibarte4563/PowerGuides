import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

/**
 * Client-side pagination.
 *
 * Needed because every staff list endpoint (`outage_report_electric_com/get.php`,
 * `outage/get.php`, `maintenance/get.php`, `cluster/get.php`) returns the full set
 * with no LIMIT, so the table has to page it (NFR-4). It is deliberately presentational
 * - the caller owns `page` and the total count.
 */
export default function Pagination({ page, pageCount, total, pageSize, onChange, className }) {
  const pages = Math.max(1, Number(pageCount) || 1);
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  if (pages <= 1) return null;

  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <nav
      className={clsx(
        'flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 px-4 py-3',
        className
      )}
      aria-label="Pagination"
    >
      <p className="text-xs text-navy-500" aria-live="polite">
        Showing <span className="font-semibold text-navy-700">{from}</span>–
        <span className="font-semibold text-navy-700">{to}</span> of{' '}
        <span className="font-semibold text-navy-700">{total}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(current - 1)}
          disabled={current <= 1}
          className="inline-flex h-9 items-center gap-1 rounded-control border border-navy-200 bg-white px-2.5 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </button>
        <span className="px-1 text-xs font-semibold text-navy-600" aria-current="page">
          Page {current} of {pages}
        </span>
        <button
          type="button"
          onClick={() => onChange(current + 1)}
          disabled={current >= pages}
          className="inline-flex h-9 items-center gap-1 rounded-control border border-navy-200 bg-white px-2.5 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
