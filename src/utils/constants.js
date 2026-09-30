/** Shared constants and design-token helpers. */

import { DEFAULT_CENTER, distanceInMeters } from './formatters';

export const APP_NAME = 'PowerGuide Dagupan';
export const APP_TAGLINE = 'Report. Track. Stay safe.';

/**
 * Default "near me" radius. Dagupan is ~10 km across and the seeded reports sit
 * ~1.5 km out from the city centre, so 1 km showed an empty map almost every
 * time. Matches an option in `RADIUS_OPTIONS` so a pill is pre-selected.
 */
export const DEFAULT_RADIUS_METERS = 2000;
export const RADIUS_OPTIONS = [
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 2000, label: '2 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
];

/**
 * A coordinate further than this from the city centre cannot be a Dagupan
 * location. Used to catch a saved point that geocoded to the wrong country
 * rather than silently returning an empty "all clear" result.
 */
export const SERVICE_AREA_RADIUS_METERS = 25000;

/** True when a point is too far from Dagupan to be inside the service area. */
export function isOutsideServiceArea(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng ?? point?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const distance = distanceInMeters(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, lat, lng);
  return distance !== null && distance > SERVICE_AREA_RADIUS_METERS;
}

export const IMAGE_UPLOAD = {
  // TODO(API-CONFIRM) confirm the max size accepted by `outage_report/upload_image.php`.
  maxBytes: 5 * 1024 * 1024,
  maxBytesLabel: '5 MB',
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  accept: 'image/jpeg,image/png,image/webp,image/gif',
};

export const REFERENCE_KEYS = {
  roles: ['roles', 'role'],
  barangays: ['barangays', 'barangay', 'list_of_barangays'],
  outageCategories: ['outage_categories', 'outage_category', 'categories', 'outage_types'],
  severityLevels: ['severity_levels', 'severity_level', 'severity', 'severities'],
  hazardTypes: ['hazard_types', 'hazard_type', 'types'],
  statuses: ['statuses', 'status', 'outage_statuses', 'hazard_statuses'],
  powerStationTypes: ['power_station_types', 'power_station_type', 'station_types'],
  safetyTimerTypes: ['safety_timer_types', 'safety_timer_type', 'timer_types'],
  notificationTypes: ['notification_types', 'notification_type'],
};

export const SEVERITY_TONE = {
  low: 'success',
  minor: 'success',
  moderate: 'warning',
  medium: 'warning',
  warning: 'warning',
  high: 'danger',
  critical: 'danger',
  severe: 'danger',
};

export const STATUS_TONE = {
  active: 'danger',
  ongoing: 'danger',
  unresolved: 'danger',
  pending: 'warning',
  in_progress: 'warning',
  processing: 'warning',
  acknowledged: 'info',
  monitoring: 'info',
  scheduled: 'info',
  upcoming: 'info',
  resolved: 'success',
  completed: 'success',
  closed: 'success',
  safe: 'success',
  available: 'success',
  unavailable: 'danger',
  stopped: 'neutral',
  expired: 'neutral',
  cancelled: 'neutral',
  rejected: 'danger',
};

/** Badge tone for a severity value (never colour alone - text is always shown). */
export function severityTone(value) {
  const key = String(value ?? '').toLowerCase().trim();
  return SEVERITY_TONE[key] || 'neutral';
}

/** Badge tone for a status value. */
export function statusTone(value) {
  const key = String(value ?? '').toLowerCase().trim();
  if (STATUS_TONE[key]) return STATUS_TONE[key];
  if (/resolv|clos|complet|clear|safe/.test(key)) return 'success';
  if (/active|ongoing|unresolve|critical|down/.test(key)) return 'danger';
  if (/pending|progress|queue|warn/.test(key)) return 'warning';
  if (/schedul|upcoming|plan|monitor/.test(key)) return 'info';
  return 'neutral';
}

/** Tone for power-station availability. */
export function availabilityTone(value) {
  const key = String(value ?? '').toLowerCase().trim();
  if (['available', '1', 'true', 'online', 'open', 'active'].includes(key)) return 'success';
  if (['unavailable', '0', 'false', 'offline', 'closed', 'maintenance'].includes(key)) return 'danger';
  return 'neutral';
}

/**
 * Statuses that mean "this report is finished".
 *
 * The reference endpoint only publishes `outage_statuses`, so flood and hazard
 * statuses ("cleared", "resolved", ...) are matched by pattern instead of an
 * enum list.
 */
const CLOSED_STATUS_PATTERN = /resolv|clos|complet|clear|safe|dismiss|reject|cancel/;

/**
 * Negations that must win over the pattern above: an "unresolved" report is still
 * open, even though it contains "resolv".
 */
const STILL_OPEN_PATTERN = /^(un|in|non|not)[-_ ]?(resolved|closed|complete|cleared|cancelled)/;

/**
 * Whether a report is still open, for the dashboard counters.
 * A blank/unknown status counts as open, so a report is never silently hidden.
 */
export function isOpenStatus(value) {
  const key = String(value ?? '').toLowerCase().trim();
  if (!key) return true;
  if (STILL_OPEN_PATTERN.test(key)) return true;
  return !CLOSED_STATUS_PATTERN.test(key);
}

export const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'medium', 'low', 'minor'];

export const NOTIFICATION_TYPE_ICON = {
  outage: 'Zap',
  outage_report: 'Zap',
  maintenance: 'Wrench',
  hazard: 'AlertTriangle',
  flood: 'Waves',
  battery: 'BatteryCharging',
  timer: 'Timer',
  system: 'Bell',
  info: 'Bell',
};

/** Map query keys used across the app (also used to invalidate React Query). */
export const QUERY_KEYS = {
  reference: ['reference'],
  me: ['auth', 'me'],
  notifications: (params) => ['notifications', params],
  unreadCount: ['notifications', 'unread-count'],
  userLocation: ['user-location'],
  outages: (params) => ['outages', params],
  outage: (id) => ['outages', 'detail', id],
  maintenance: (params) => ['maintenance', params],
  maintenanceMap: ['maintenance', 'map'],
  powerStations: (params) => ['power-stations', params],
  powerStation: (id) => ['power-stations', 'detail', id],
  battery: ['battery', 'list'],
  batteryHistory: (id) => ['battery', 'history', id],
  safetyTimers: ['safety-timers'],
  floods: (params) => ['floods', params],
  hazards: (params) => ['hazards', params],
  risks: (params) => ['risks', params],
  heatmap: ['heatmap'],
  clusters: ['clusters'],
};

/**
 * Query keys for the Electric Company Dashboard (`/company`).
 *
 * These are deliberately separate from the resident `outages` / `maintenance` keys:
 * the company list is the staff-scoped `outage_report_electric_com/get.php` view and
 * bulk status changes must refresh it without touching (or being clobbered by) the
 * resident caches. Everything that reads outage rows shares the `company-outages`
 * prefix so a single invalidation after a status change covers all of them.
 */
export const COMPANY_QUERY_KEYS = {
  summary: ['company-summary'],
  outages: (params) => ['company-outages', params],
  outage: (id) => ['company-outages', 'detail', id],
  rawOutages: (params) => ['company-outages', 'raw', params],
  maintenance: (params) => ['company-maintenance', params],
  completedMaintenance: ['company-maintenance', 'completed'],
  maintenanceMap: ['company-maintenance', 'map'],
  notifications: (params) => ['company-notifications', params],
  powerStations: (params) => ['company-power-stations', params],
  myStations: ['company-power-stations', 'mine'],
  hazards: (params) => ['company-hazards', params],
  clusters: (params) => ['company-clusters', params],
};

/** Page size for the client-side tables (the staff endpoints return every row). */
export const COMPANY_PAGE_SIZE = 25;
