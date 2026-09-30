/** Formatting helpers shared across every page. */

export const DEFAULT_CENTER = { lat: 16.0433, lng: 120.3329, zoom: 13 }; // Dagupan City

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
});

const TIME_FORMAT = new Intl.DateTimeFormat('en-PH', { timeStyle: 'short' });

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = typeof value === 'number' ? value : String(value).trim();
  if (!raw) return null;

  // Accept "YYYY-MM-DD HH:MM:SS" from MySQL (Safari cannot parse the space form).
  const normalised = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)
    ? raw.replace(' ', 'T')
    : raw;
  const date = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalised) ? `${normalised}:00` : normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? DATE_TIME_FORMAT.format(date) : '—';
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? DATE_FORMAT.format(date) : '—';
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? TIME_FORMAT.format(date) : '—';
}

/** "3 minutes ago", "in 2 hours", etc. */
export function formatRelativeTime(value) {
  const date = toDate(value);
  if (!date) return '—';

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  for (const [unit, seconds] of units) {
    if (absSeconds >= seconds) return rtf.format(Math.round(diffSeconds / seconds), unit);
  }
  return 'just now';
}

/** Duration in seconds -> "1h 5m 10s" / "45s". */
export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  if (minutes > 0) return `${minutes}m ${String(secs).padStart(2, '0')}s`;
  return `${secs}s`;
}

/** Minutes -> "2 hours 30 minutes" (used for maintenance windows and timers). */
export function formatMinutes(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

export function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('en-PH');
}

export function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${Math.round(number)}%`;
}

export function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return '—';
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toFixed(value < 10000 ? 2 : 1)} km`;
}

/** Read the first value of a record field across the shapes the API may use. */
export function readField(record, keys, fallback = '') {
  if (!record || typeof record !== 'object') return fallback;
  for (const key of [].concat(keys)) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

/** "Title Case Label" from `in_progress` / `IN PROGRESS` / `inProgress`. */
export function humanize(value, fallback = '—') {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).replace(/[_-]+/g, ' ').trim();
  if (!text) return fallback;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function toNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function isTrue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'available', 'active'].includes(value.toLowerCase());
  return false;
}

export function hasCoordinates(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

/** Great-circle distance in metres between two coordinates. */
export function distanceInMeters(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((v) => Number.isFinite(Number(v)))) return null;
  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
