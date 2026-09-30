import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Long user-submitted text in a dense layout: clipped to a fixed number of lines with an
 * ellipsis, plus a "See all" toggle that appears only when the text is genuinely clipped.
 *
 * Why not just `truncate`: `truncate` hides the rest of the string with no way back. In a
 * report list the location is the one field staff actually need in full ("pantal" is fine,
 * a 90-character barangay-and-street description is not), so clipping it away entirely
 * would remove information rather than just tidying the layout.
 *
 * Two details that matter:
 *
 *   - The toggle is a sibling of the text, NEVER a child of `to`'s <Link>. Nesting a
 *     <button> inside an <a> is invalid HTML and breaks keyboard and screen-reader
 *     behaviour, so when `to` is given the link wraps only the clipped text.
 *   - Whether the text overflows depends on the column width, which changes with the
 *     viewport and with the sidebar collapse, so it is measured (and re-measured via
 *     ResizeObserver) instead of guessed from character count.
 *
 * Measurement note: single-line clipping uses `truncate` (`overflow:hidden` +
 * `text-overflow:ellipsis`), which produces REAL scroll overflow, so
 * `scrollWidth > clientWidth` is reliable. Multi-line `-webkit-line-clamp` is a paint-level
 * effect whose `scrollHeight` some engines report as the clamped height, so `lines > 1`
 * can under-report and hide the toggle. Default is therefore 1, which is also what keeps
 * table rows compact; `lines` is exposed for callers that accept that trade-off.
 */
export default function TruncateText({
  text,
  to,
  lines = 1,
  maxWidthClass = 'max-w-[18rem]',
  className,
  textClassName,
  linkClassName,
  moreLabel = 'See all',
  lessLabel = 'Show less',
}) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef(null);

  const value = text ?? '';
  const hasText = value !== '';

  // Only measurable while actually clipped - once expanded the element is no longer
  // overflowing, so reading it would wrongly hide the toggle needed to collapse again.
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setClamped(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
  }, [expanded]);

  // A new record reuses this row, so start clamped again.
  useEffect(() => {
    setExpanded(false);
    setClamped(false);
  }, [value, to]);

  useEffect(() => {
    if (!hasText) return undefined;
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [measure, hasText, value]);

  if (!hasText) return null;

  const clampClass =
    lines <= 1 ? 'truncate' : lines === 2 ? 'line-clamp-2' : `line-clamp-${lines}`;

  const sharedTextClass = clsx(
    'whitespace-pre-line break-words',
    !expanded && 'overflow-hidden',
    !expanded && clampClass,
    maxWidthClass,
    textClassName
  );

  const toggle = clamped ? (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => setExpanded((current) => !current)}
      className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-semibold text-primary-600 underline-offset-2 transition hover:text-primary-700 hover:underline"
    >
      {expanded ? lessLabel : moreLabel}
      {expanded ? (
        <ChevronUp className="h-3 w-3" aria-hidden="true" />
      ) : (
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  ) : null;

  return (
    <div className={clsx('min-w-0', className)}>
      {to ? (
        <Link
          to={to}
          ref={ref}
          className={clsx(
            'block rounded font-semibold text-navy-900 hover:text-primary-600',
            sharedTextClass,
            linkClassName
          )}
        >
          {value}
        </Link>
      ) : (
        <p ref={ref} className={sharedTextClass}>
          {value}
        </p>
      )}
      {toggle}
    </div>
  );
}