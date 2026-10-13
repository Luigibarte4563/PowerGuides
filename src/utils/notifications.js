/**
 * Notification history helpers.
 *
 * `readNotification` (utils/records.js) already exposes the reference ids the API
 * returns - `outage_report_id`, `maintenance_id`, `flood_report_id`,
 * `electrical_hazard_id`, `safety_timer_id` - but nothing consumed them, so a
 * notification could never open the record it points at. These helpers turn that
 * dangling data into a real destination, and group/filter the list for the history
 * timeline.
 *
 * ---------------------------------------------------------------------------
 * API limits this file works within (verified against the live API):
 *
 *   - There is NO `notification/get_detail.php`. A notification cannot be fetched
 *     by id, so the detail view is a modal holding an already-loaded record rather
 *     than a route - a deep link could only ever resolve from the loaded cache.
 *
 *   - `get.php` supports `limit` (max 200), `offset`, `unread`, `type` and
 *     `maintenance_id`. There is NO date-range filter, so day grouping and search
 *     have to happen here.
 *
 *   - `total` is the PAGE size, not a grand total. "Page 1 of N" is therefore
 *     impossible and history pages with "Load more" instead (see
 *     `useNotificationsHistory`).
 *
 *   - `notifications` has NO `read_at` column and no delete/archive endpoint, so
 *     "when did I read this?" can never be answered - history shows arrival time.
 *
 *   - Only outages have a detail ROUTE (`/dashboard/outages/:id`,
 *     `/company/outages/:id`). Everything else links to the list page that covers it,
 *     which is why the helpers below return a label as well as a path.
 */
import { formatDayKey, formatDayLabel } from './formatters';

/** Icon/badge tone per notification type, shared by the card, timeline and bell. */
export const NOTIFICATION_TYPE_TONES = {
  outage: 'danger',
  outage_report: 'danger',
  maintenance: 'info',
  hazard: 'danger',
  electrical_hazard: 'danger',
  flood: 'info',
  battery: 'success',
  timer: 'primary',
  safety_timer: 'primary',
  system: 'navy',
  info: 'navy',
};

/** A positive integer id, or null - the reference columns are nullable. */
function positiveId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Where a notification's linked record lives, or null when it has none.
 *
 * The notification table carries five nullable reference columns, but the app only
 * has a detail route for outages. Rather than render a link that 404s, the rest fall
 * back to the list page that covers the subject - and `timerId` is dropped entirely
 * for staff, because `/company` has no safety-timers screen at all.
 *
 * @param {object} notification normalised record (see readNotification)
 * @param {{ company?: boolean }} [options] staff context for the route prefix
 * @returns {{ to: string, label: string } | null}
 */
export function notificationTarget(notification, { company = false } = {}) {
  if (!notification) return null;

  const outageId = positiveId(notification.outageReportId);
  const maintenanceId = positiveId(notification.maintenanceId);
  const floodId = positiveId(notification.floodReportId);
  const hazardId = positiveId(notification.hazardId);
  const timerId = positiveId(notification.timerId);

  if (outageId) {
    return {
      to: company ? `/company/outages/${outageId}` : `/dashboard/outages/${outageId}`,
      label: 'View the outage report',
    };
  }
  if (maintenanceId) {
    return {
      to: company ? '/company/maintenance' : '/dashboard/maintenance',
      label: 'View maintenance schedules',
    };
  }
  if (floodId) {
    return company
      ? { to: '/company/map', label: 'View floods on the map' }
      : { to: '/dashboard/floods', label: 'View flood reports' };
  }
  if (hazardId) {
    return {
      to: company ? '/company/hazards' : '/dashboard/hazards',
      label: 'View hazard reports',
    };
  }
  if (timerId && !company) {
    return { to: '/dashboard/safety-timers', label: 'View your safety timers' };
  }
  return null;
}

/**
 * Group notifications into day buckets for the timeline.
 *
 * The API sorts `created_at DESC`, so every notification for a given day arrives
 * contiguously and one pass is enough. Rows with an unusable `created_at` are kept -
 * they land in a trailing "Unknown date" group rather than silently disappearing from
 * the history, which is the whole point of a history view.
 *
 * @returns {{ key: string, label: string, items: object[] }[]}
 */
export function groupByDay(notifications) {
  const groups = [];
  const index = new Map();

  (notifications || []).forEach((item) => {
    const key = formatDayKey(item?.createdAt) || 'unknown';
    if (!index.has(key)) {
      const group = {
        key,
        label: key === 'unknown' ? 'Unknown date' : formatDayLabel(item.createdAt),
        items: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    index.get(key).items.push(item);
  });

  return groups;
}

/**
 * Client-side filtering for the history view.
 *
 * Type and search run here rather than as `?type=` / server params: there is no
 * date filter on the endpoint, so a server-side type filter combined with offset
 * paging plus a client-side text query makes "which rows is page 3 of?" unanswerable.
 * Filtering the loaded set keeps what is on screen consistent with what is shown.
 *
 * @param {object[]} items
 * @param {{ query?: string, type?: string, tab?: 'all'|'unread'|'read' }} filters
 */
export function filterNotifications(items, { query = '', type = '', tab = 'all' } = {}) {
  const needle = String(query || '').trim().toLowerCase();

  return (items || []).filter((item) => {
    if (tab === 'unread' && item.isRead) return false;
    if (tab === 'read' && !item.isRead) return false;
    if (type && String(item.type ?? '') !== type) return false;
    if (!needle) return true;
    return `${item.title || ''} ${item.message || ''}`.toLowerCase().includes(needle);
  });
}

/** Text to show when a notification has no message - never leave a card blank. */
export function notificationBody(notification) {
  const message = String(notification?.message || '').trim();
  if (message) return message;
  return String(notification?.title || '').trim();
}

/** Flatten infinite-query pages into one list, dropping ids already seen. */
export function flattenNotificationPages(pages) {
  const seen = new Set();
  const result = [];
  (pages || []).forEach((page) => {
    (page?.items || []).forEach((item) => {
      if (item?.id === null || item?.id === undefined) {
        result.push(item);
        return;
      }
      if (seen.has(item.id)) return;
      seen.add(item.id);
      result.push(item);
    });
  });
  return result;
}