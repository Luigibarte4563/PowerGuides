import { useEffect, useMemo, useState } from 'react';

function parseTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(String(value).replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Live countdown for a safety timer.
 *
 * @param {number|string|Date|null} endsAt    Timestamp when the timer finishes.
 * @param {number|string|Date|null} startedAt Timestamp the timer started (for progress).
 * @returns {{ remaining:number, isExpired:boolean, isRunning:boolean, label:string, progress:number }}
 */
export function useCountdown(endsAt, startedAt = null) {
  const target = useMemo(() => parseTimestamp(endsAt), [endsAt]);
  const start = useMemo(() => parseTimestamp(startedAt), [startedAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target === null || target <= Date.now()) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);

  const remaining = target === null ? 0 : Math.max(0, Math.round((target - now) / 1000));
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const label =
    remaining <= 0
      ? 'Expired'
      : [
          hours > 0 ? String(hours).padStart(2, '0') : null,
          String(minutes).padStart(2, '0'),
          String(seconds).padStart(2, '0'),
        ]
          .filter(Boolean)
          .join(':');

  let progress = 0;
  if (start !== null && target !== null && target > start) {
    progress = Math.max(0, Math.min(1, (target - now) / (target - start)));
  }

  return { remaining, isExpired: remaining <= 0, isRunning: remaining > 0, label, progress };
}
