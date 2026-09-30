import clsx from 'clsx';

/**
 * Two-pane map workspace: the map is pinned on the left and holds still while the
 * filters, actions and lists on the right scroll.
 *
 * The map is `sticky` rather than a viewport-locked panel with its own scrollbar.
 * An inner scroll region has to be told exactly how tall it is so it lines up
 * under the sticky top bar - a magic number that breaks as soon as a page header
 * wraps or the bar changes height - and nested scroll areas are hostile on touch
 * (momentum scrolling traps, double scrollbars on desktop). Sticky gets the same
 * result with no magic numbers.
 *
 * Below `lg` this is just a stacked block with the map first, so the page scrolls
 * normally on a phone and in a narrow window.
 */
export default function MapWorkspace({
  map,
  mapTitle,
  mapDescription,
  mapAction,
  mapFooter,
  mapHeight = 'h-[24rem] sm:h-[28rem] lg:h-[calc(100dvh-7rem)]',
  children,
  className,
  panelClassName,
}) {
  // Nothing to pin on the left (e.g. the page found no mappable rows) - render the
  // panel full width rather than leaving an empty column.
  if (!map) return <div className={className}>{children}</div>;

  return (
    <div
      className={clsx(
        'grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-6',
        className
      )}
    >
      <div className={clsx('lg:sticky lg:top-20', mapHeight)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-navy-200 bg-white shadow-card">
          {mapTitle || mapDescription || mapAction ? (
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-navy-100 px-4 py-3">
              <div className="min-w-0">
                {mapTitle ? (
                  <p className="text-sm font-bold text-navy-900">{mapTitle}</p>
                ) : null}
                {mapDescription ? (
                  <p className="mt-0.5 text-xs text-navy-500">{mapDescription}</p>
                ) : null}
              </div>
              {mapAction ? <div className="shrink-0">{mapAction}</div> : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1">{map}</div>

          {mapFooter ? (
            <div className="shrink-0 border-t border-navy-100 px-4 py-2.5">{mapFooter}</div>
          ) : null}
        </div>
      </div>

      <div className={clsx('min-w-0 space-y-4', panelClassName)}>{children}</div>
    </div>
  );
}
