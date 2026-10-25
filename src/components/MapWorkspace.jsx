import clsx from 'clsx';
import { Clock3, MapPin, Search, X } from 'lucide-react';

/**
 * Two-pane map workspace, cloned 1:1 from the Outages page layout:
 *
 *   [ action button(s) … search ]   <- FeedActions, rendered by the page
 *   [ map (flex-1) ][ feed aside (420px) ]
 *
 * The map holds still on the left while the feed on the right scrolls inside a
 * fixed-height panel, exactly like the Outages workspace. Glass overlays sit on
 * the map ("N plotted" top-left, an empty-feed toast top-centre) and the aside
 * header carries the LIVE badge, scope toggle, stat tiles, filter pills and any
 * compact selects above the scrolling feed.
 *
 * Below `xl` the two panes stack (map first), so the page scrolls normally on a
 * phone. When `map` is falsy the children render full width instead of leaving
 * an empty column.
 */
export default function MapWorkspace({
  map,
  mapTitle,
  mapSubtitle,
  mapLabel,
  live = true,
  toggle,
  stats = [],
  pills,
  filters,
  plottedCount,
  mapEmpty = false,
  mapEmptyLabel = 'No mapped reports yet',
  children,
  className,
}) {
  if (!map) return <div className={className}>{children}</div>;

  const hasHeader = Boolean(mapTitle || mapSubtitle || live || toggle || stats.length || pills || filters);

  return (
    <div className={clsx('mt-5 flex flex-col gap-6 xl:flex-row xl:items-stretch', className)}>
      <section
        className="relative h-[440px] min-w-0 overflow-hidden rounded-2xl border border-white/5 bg-[#31324C]/20 shadow-[0_20px_50px_rgba(0,0,0,0.25)] lg:h-[550px] xl:flex-1"
        aria-label={mapLabel || mapTitle || 'Map'}
      >
        <div className="h-full w-full">{map}</div>

        {Number.isFinite(plottedCount) ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full border border-white/10 bg-[#0B0D20]/80 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/60 shadow-xl backdrop-blur-md">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#34FB34]" aria-hidden="true" />
            {plottedCount} plotted
          </div>
        ) : null}

        {mapEmpty ? (
          <div className="pointer-events-none absolute inset-x-3 top-14 z-[450] flex justify-center">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-[#0B0D20]/80 px-3.5 py-2 text-[10px] font-semibold text-white/65 shadow-lg backdrop-blur-md">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FFBB02]" aria-hidden="true" />
              <span className="truncate">{mapEmptyLabel}</span>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="flex h-[440px] w-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#31324C]/20 shadow-[0_20px_50px_rgba(0,0,0,0.25)] lg:h-[550px] xl:w-[420px] xl:shrink-0">
        {hasHeader ? (
          <div className="border-b border-white/5 p-3">
            {mapTitle || live ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {mapTitle ? (
                    <h2 className="text-base font-extrabold tracking-tight text-white">{mapTitle}</h2>
                  ) : null}
                  {mapSubtitle ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-white/40">
                      <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{mapSubtitle}</span>
                    </p>
                  ) : null}
                </div>
                {live ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#34FB34]/20 bg-[#34FB34]/10 px-2 py-1 text-[8px] font-extrabold tracking-[0.16em] text-[#34FB34]">
                    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34FB34] opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#34FB34]" />
                    </span>
                    LIVE
                  </span>
                ) : null}
              </div>
            ) : null}
            {toggle}
            <FeedStatTiles stats={stats} />
            {pills}
            {filters}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </aside>
    </div>
  );
}

const normaliseOption = (option) => {
  if (option === null || option === undefined) return null;
  if (typeof option === 'string' || typeof option === 'number') {
    return { value: String(option), label: String(option) };
  }
  const value = option.value ?? option.id;
  const label = option.label ?? option.name;
  if (value === undefined || value === null || !label) return null;
  return { value: String(value), label: String(label) };
};

/**
 * Top row of the Outages layout: action button(s) on the left of a right-aligned
 * search field. Rendered by the page above `<MapWorkspace>`.
 */
export function FeedActions({
  actions,
  search,
  onSearchChange,
  onClearSearch,
  searchId,
  searchLabel = 'Search',
  searchPlaceholder = 'Search…',
}) {
  if (!actions && search === undefined) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions}
      {search !== undefined ? (
        <div className="relative w-full sm:w-[260px] xl:w-[280px]">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
            aria-hidden="true"
          />
          <label htmlFor={searchId} className="sr-only">
            {searchLabel}
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-xl border border-white/10 bg-[#1C1D30]/60 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:border-[#FFBB02] focus:outline-none focus:ring-2 focus:ring-[#FFBB02]/25 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search ? (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Outages-style scope toggle (amber active pill on a dark inset track). */
export function FeedToggle({ options, value, onChange, ariaLabel = 'Feed scope' }) {
  const normalised = options.map(normaliseOption).filter(Boolean);
  if (!normalised.length) return null;

  return (
    <div
      className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#03041A]/60 p-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      {normalised.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg px-1 text-[11px] font-bold transition ${
              active
                ? 'bg-[#FFBB02] text-[#191400] shadow-[0_4px_16px_rgba(255,187,2,0.16)]'
                : 'text-white/45 hover:bg-white/5 hover:text-white/75'
            }`}
          >
            <span className="truncate">{option.label}</span>
            {option.count !== undefined && option.count !== null ? (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold ${
                  active ? 'bg-[#191400]/15 text-[#191400]' : 'bg-white/10 text-white/40'
                }`}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Outages-style stat tiles (icon + label + big number), three across. */
export function FeedStatTiles({ stats = [] }) {
  if (!stats.length) return null;

  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {stats.map((tile) => {
        const Icon = tile.icon;
        return (
          <div key={tile.label} className="rounded-xl border border-white/5 bg-[#1C1D30]/40 px-2 py-1.5">
            <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white/40">
              {Icon ? (
                <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: tile.color }} aria-hidden="true" />
              ) : null}
              <span className="truncate">{tile.label}</span>
            </div>
            <p className="mt-0.5 truncate text-base font-black leading-none text-white">
              {typeof tile.value === 'number' ? tile.value.toLocaleString('en-PH') : (tile.value ?? '—')}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Outages-style filter pills (single-select row). */
export function FeedPills({ options, value, onChange, ariaLabel = 'Filter' }) {
  const normalised = options.map(normaliseOption).filter(Boolean);
  if (!normalised.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label={ariaLabel}>
      {normalised.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`h-7 rounded-full border px-2.5 text-[9px] font-bold transition ${
            value === option.value
              ? 'border-[#FFBB02]/40 bg-[#FFBB02]/15 text-[#FFBB02]'
              : 'border-white/10 bg-transparent text-white/45 hover:border-white/20 hover:text-white/70'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
