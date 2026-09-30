/**
 * Record field normalisers.
 *
 * Every key here is taken from the real API responses in
 * `C:\xampp\htdocs\CrowdsourcedAPI\api\*` (see the comments per module). Reads go
 * through the `read*` helpers so a small column rename only needs editing here.
 */
import { distanceInMeters, hasCoordinates, readField, toNumber } from './formatters';

/** TODO(API-CONFIRM): primary key per table (all rows expose `id`). */
export function readId(record) {
  return readField(
    record,
    ['id', 'outage_report_id', 'flood_report_id', 'hazard_id', 'device_id', 'timer_id', 'station_id'],
    null
  );
}

/**
 * Ownership marker.
 * `outage_report/get.php` does not return a user id, so the Outages page resolves
 * ownership by intersecting its ids with `get_my_report.php` and passing
 * `{ myIds }` as the second argument.
 */
export function isOwnedBy(record, user, options = {}) {
  const { myIds } = options;
  if (!record) return false;
  const id = readId(record);

  if (Array.isArray(myIds)) return myIds.some((mine) => String(mine) === String(id));

  const ownerId = toNumber(
    readField(record, ['user_id', 'created_by', 'reported_by', 'updated_by'], null),
    null
  );
  const currentId = toNumber(user?.id, null);
  if (ownerId !== null && currentId !== null) return ownerId === currentId;
  return false;
}

// ------------------------------------------------------------------ outage --
export const readOutage = (record) => ({
  raw: record,
  id: readId(record),
  reportKey: readField(record, ['report_key'], ''),
  locationName: readField(record, ['location_name', 'location'], ''),
  barangay: readField(record, ['barangay_name', 'barangay'], ''),
  barangayId: readField(record, ['barangay_id'], ''),
  category: readField(record, ['category'], ''),
  severity: readField(record, ['severity'], ''),
  hazardType: readField(record, ['hazard_type'], ''),
  status: readField(record, ['status'], ''),
  description: readField(record, ['description'], ''),
  resolutionNote: readField(record, ['resolution_note'], ''),
  affectedHouses: toNumber(readField(record, ['affected_houses'], null), null),
  isActive: readField(record, ['is_active'], null),
  lat: toNumber(readField(record, ['latitude', 'lat'], null), null),
  lng: toNumber(readField(record, ['longitude', 'lng'], null), null),
  images: readImages(record),
  updates: Array.isArray(record?.updates) ? record.updates : [],
  verifications: Array.isArray(record?.verifications) ? record.verifications : [],
  createdAt: readField(record, ['created_at', 'reported_at'], ''),
  updatedAt: readField(record, ['updated_at'], ''),
  startedAt: readField(record, ['started_at'], ''),
  resolvedAt: readField(record, ['resolved_at'], ''),
  ownerId: toNumber(readField(record, ['user_id'], null), null),
});

export function readImages(record) {
  const candidates = [
    record?.images,
    record?.photos,
    record?.image,
    record?.image_url,
    record?.image_proof,
    record?.image_path,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate
        .map((item) =>
          typeof item === 'string'
            ? item
            : readField(item, ['image_url', 'url', 'path', 'src', 'image'], '')
        )
        .filter(Boolean);
    }
    if (typeof candidate === 'string' && candidate.trim()) return [candidate.trim()];
  }
  return [];
}

/**
 * Staff view of an outage report, from `outage_report_electric_com/get.php` and
 * `outage/get.php`.
 *
 * The only structural differences from `readOutage` are handled by the shared keys,
 * so this adds the staff-specific context instead of duplicating the row:
 *   - `reporter` is a LABEL, not a name. Neither endpoint joins `users`, so the best
 *     available handle is the resident's `user_id` - showing a real name would mean
 *     fetching every reporter's profile.
 *   - `isActive` is the server's flag, kept separate from `status` because
 *     `update_single.php` clears `is_active` on `resolved` while the status column
 *     still carries the full history.
 *   - `canEdit` mirrors `get_detail.php`: staff may open any report, so the detail
 *     link is never withheld the way the resident app withholds other people's.
 */
export const readCompanyOutage = (record) => {
  const base = readOutage(record);
  const reporterId = toNumber(readField(record, ['user_id'], null), null);

  return {
    ...base,
    reporterId,
    reporter: reporterId === null ? 'Unknown reporter' : `Resident #${reporterId}`,
    /** `outage/get.php` returns `report_key`; the company-scoped list does not. */
    reportKey: readField(record, ['report_key'], ''),
    isVerified: (base.verifications || []).some(
      (item) => String(readField(item, ['verification_status'], '')).toLowerCase() === 'confirmed'
    ),
  };
};

/** One row of `get_detail.php`'s `updates[]` (a field update / note). */
export const readOutageUpdate = (record) => ({
  raw: record,
  id: readId(record),
  message: readField(record, ['update_message', 'message'], ''),
  toStatus: readField(record, ['to_status', 'status'], ''),
  createdAt: readField(record, ['created_at', 'updated_at'], ''),
});

/** One row of `get_detail.php`'s `verifications[]` (a staff verification). */
export const readVerification = (record) => ({
  raw: record,
  id: readId(record),
  status: readField(record, ['verification_status', 'status'], ''),
  notes: readField(record, ['notes', 'note'], ''),
  verifiedBy: toNumber(readField(record, ['verified_by'], null), null),
  createdAt: readField(record, ['verified_at', 'created_at'], ''),
});

/** Turn a possibly-relative image path into something the browser can load. */
export function resolveImageUrl(url) {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  if (!base) return url;
  return `${base}/${url.replace(/^\/+/, '')}`;
}

// ------------------------------------------------------------- maintenance --
/**
 * `maintenance/get.php` groups one row per schedule with a `locations` array of
 * `{ barangay_name, lat, lng }` and a `radius` in metres.
 */
export const readMaintenance = (record) => {
  const locations = (Array.isArray(record?.locations) ? record.locations : [])
    .map((location) => ({
      barangay: readField(location, ['barangay_name', 'barangay'], ''),
      lat: toNumber(readField(location, ['lat', 'latitude'], null), null),
      lng: toNumber(readField(location, ['lng', 'longitude'], null), null),
    }))
    .filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng));

  const date = readField(record, ['maintenance_date'], '');
  const start = readField(record, ['start_time'], '');
  const end = readField(record, ['end_time'], '');

  return {
    raw: record,
    id: readId(record),
    title: readField(record, ['title', 'description'], 'Scheduled maintenance'),
    company: readField(record, ['company_name'], ''),
    status: readField(record, ['status'], ''),
    date,
    startTime: start,
    endTime: end,
    startAt: combineDateTime(date, start),
    endAt: combineDateTime(date, end),
    radius: toNumber(readField(record, ['radius'], null), null),
    description: readField(record, ['description'], ''),
    locations,
    barangay: locations.map((location) => location.barangay).filter(Boolean).join(', '),
    lat: locations[0]?.lat ?? null,
    lng: locations[0]?.lng ?? null,
    createdAt: readField(record, ['created_at'], ''),
  };
};

/** Combine the separate `maintenance_date` + `start_time` columns. */
export function combineDateTime(date, time) {
  if (!date) return '';
  if (!time) return String(date);
  const timePart = String(time).length === 5 ? `${time}:00` : time;
  return `${date} ${timePart}`;
}

// ---------------------------------------------------------- power station --
export const readStation = (record) => ({
  raw: record,
  id: readId(record),
  name: readField(record, ['station_name', 'name'], 'Power station'),
  locationName: readField(record, ['location_name'], ''),
  address: readField(record, ['location_name', 'address', 'barangay_name'], ''),
  barangay: readField(record, ['barangay_name'], ''),
  type: readField(record, ['station_type'], ''),
  accessType: readField(record, ['access_type'], ''),
  availability: readField(record, ['availability_status'], ''),
  operatingHours: readField(record, ['operating_hours'], ''),
  chargingType: readField(record, ['charging_type'], ''),
  description: readField(record, ['description'], ''),
  image: readField(record, ['image'], ''),
  lat: toNumber(readField(record, ['latitude', 'lat'], null), null),
  lng: toNumber(readField(record, ['longitude', 'lng'], null), null),
  createdAt: readField(record, ['created_at'], ''),
  updatedAt: readField(record, ['updated_at'], ''),
  createdBy: toNumber(readField(record, ['created_by', 'user_id'], null), null),
  distance: toNumber(readField(record, ['distance'], null), null),
});

// ----------------------------------------------------------- notification --
export const readNotification = (record) => ({
  raw: record,
  id: readId(record),
  type: readField(record, ['type', 'notification_type'], 'system'),
  title: readField(record, ['title'], ''),
  message: readField(record, ['message', 'body'], ''),
  isRead: toNumber(readField(record, ['is_read'], 0), 0) === 1,
  outageReportId: readField(record, ['outage_report_id'], null),
  maintenanceId: readField(record, ['maintenance_id'], null),
  floodReportId: readField(record, ['flood_report_id'], null),
  hazardId: readField(record, ['electrical_hazard_id'], null),
  timerId: readField(record, ['safety_timer_id'], null),
  createdAt: readField(record, ['created_at', 'sent_at'], ''),
});

// ------------------------------------------------------------ user location --
/**
 * `user_location/get.php` returns a null-filled row when nothing is saved, and in that
 * branch `barangay_id` is missing entirely - so every read stays defensive.
 */
export const readUserLocation = (record) => {
  if (!record) return null;
  const lat = toNumber(readField(record, ['latitude', 'lat'], null), null);
  const lng = toNumber(readField(record, ['longitude', 'lng'], null), null);
  if (!hasCoordinates(lat, lng)) return null;

  return {
    raw: record,
    lat,
    lng,
    address: readField(record, ['address', 'location_name'], ''),
    locationName: readField(record, ['location_name'], ''),
    barangay: readField(record, ['barangay'], ''),
    barangayId: readField(record, ['barangay_id'], ''),
    updatedAt: readField(record, ['updated_at'], ''),
  };
};

/** Coordinates as accepted by the API query params (`lat`, `lng`). */
export function coordinatesOf(location) {
  if (!location) return null;
  const lat = toNumber(location.lat, null);
  const lng = toNumber(location.lng, null);
  return hasCoordinates(lat, lng) ? { lat, lng } : null;
}

// ----------------------------------------------------------------- battery --
export const readBatteryDevice = (record) => ({
  raw: record,
  id: readId(record),
  name: readField(record, ['device_name', 'name'], 'Device'),
  deviceType: readField(record, ['device_type'], ''),
  percentage: toNumber(readField(record, ['current_percentage', 'percentage'], null), null),
  capacity: readField(record, ['capacity_mah', 'capacity'], ''),
  isPrimary: toNumber(readField(record, ['is_primary'], 0), 0) === 1,
  estimatedHours: toNumber(readField(record, ['estimated_hours_remaining'], null), null),
  usageRate: toNumber(readField(record, ['estimated_usage_rate_per_hour'], null), null),
  recentLogs: Array.isArray(record?.recent_logs) ? record.recent_logs : [],
  createdAt: readField(record, ['created_at'], ''),
  updatedAt: readField(record, ['updated_at'], ''),
});

export const readBatteryLog = (record) => ({
  raw: record,
  id: readId(record),
  deviceId: toNumber(readField(record, ['battery_device_id', 'device_id'], null), null),
  startPercentage: toNumber(readField(record, ['battery_percentage_start'], null), null),
  endPercentage: toNumber(readField(record, ['battery_percentage_end'], null), null),
  usageMinutes: toNumber(readField(record, ['usage_minutes'], null), null),
  estimatedWatts: toNumber(readField(record, ['estimated_watts'], null), null),
  activity: readField(record, ['activity'], ''),
  loggedAt: readField(record, ['logged_at', 'created_at'], ''),
});

// ---------------------------------------------------------- safety timers --
/**
 * `safety_timer/get.php` recomputes `status` server-side and returns
 * `expected_expiration_at` (not `ends_at`) plus `remaining_seconds`.
 */
export const readSafetyTimer = (record) => ({
  raw: record,
  id: readField(record, ['timer_id', 'id'], null),
  title: readField(record, ['title'], 'Safety timer'),
  type: readField(record, ['timer_name', 'type'], ''),
  description: readField(record, ['type_description'], ''),
  notes: readField(record, ['notes', 'note'], ''),
  durationHours: toNumber(readField(record, ['default_duration_hours'], null), null),
  warningHoursBefore: toNumber(readField(record, ['warning_hours_before'], null), null),
  warningAt: readField(record, ['warning_at'], ''),
  startedAt: readField(record, ['started_at'], ''),
  endsAt: readField(record, ['expected_expiration_at', 'ends_at'], ''),
  completedAt: readField(record, ['completed_at'], ''),
  status: readField(record, ['status'], ''),
  remainingSeconds: toNumber(readField(record, ['remaining_seconds'], null), null),
  ownerId: toNumber(readField(record, ['user_id'], null), null),
});

// ------------------------------------------------------------------ flood --
export const readFlood = (record) => ({
  raw: record,
  id: readId(record),
  locationName: readField(record, ['location_name'], ''),
  barangay: readField(record, ['barangay_name', 'barangay'], ''),
  severity: readField(record, ['flood_level', 'risk_level'], ''),
  status: readField(record, ['status'], ''),
  description: readField(record, ['description'], ''),
  depthCm: toNumber(readField(record, ['flood_depth_cm'], null), null),
  image: readField(record, ['image_proof', 'image_url'], ''),
  lat: toNumber(readField(record, ['latitude', 'lat'], null), null),
  lng: toNumber(readField(record, ['longitude', 'lng'], null), null),
  distance: toNumber(readField(record, ['distance'], null), null),
  createdAt: readField(record, ['reported_at', 'created_at'], ''),
  updatedAt: readField(record, ['updated_at'], ''),
  ownerId: toNumber(readField(record, ['reported_by', 'user_id'], null), null),
});

// ---------------------------------------------------------------- hazard --
export const readHazard = (record) => ({
  raw: record,
  id: readId(record),
  hazardType: readField(record, ['hazard_type', 'type'], ''),
  severity: readField(record, ['severity', 'risk_level'], ''),
  status: readField(record, ['status'], ''),
  description: readField(record, ['description'], ''),
  locationName: readField(record, ['location_name'], ''),
  barangay: readField(record, ['barangay_name', 'barangay'], ''),
  image: readField(record, ['image_proof', 'image_url'], ''),
  lat: toNumber(readField(record, ['latitude', 'lat'], null), null),
  lng: toNumber(readField(record, ['longitude', 'lng'], null), null),
  distance: toNumber(readField(record, ['distance'], null), null),
  createdAt: readField(record, ['reported_at', 'created_at'], ''),
  resolvedAt: readField(record, ['resolved_at'], ''),
  updatedAt: readField(record, ['updated_at'], ''),
  ownerId: toNumber(readField(record, ['reported_by', 'user_id'], null), null),
});

// ------------------------------------------------------------------ risk --
/**
 * `risk/get_nearby.php` merges both tables with `category` = 'flood' | 'hazard' and
 * `risk_level` as the severity/level.
 */
export function readRisk(record, kind) {
  const base = kind === 'flood' ? readFlood(record) : readHazard(record);
  const type = kind || record?.category || 'hazard';
  return {
    ...base,
    kind: type === 'flood' ? 'flood' : 'hazard',
    label: base.locationName || base.barangay || (type === 'flood' ? 'Flood report' : 'Electrical hazard'),
  };
}

/** Attach a computed distance (metres) when the API did not provide one. */
export function withDistance(item, origin) {
  if (!origin || !hasCoordinates(item?.lat, item?.lng) || item?.distance !== null) return item;
  const computed = distanceInMeters(origin.lat, origin.lng, item.lat, item.lng);
  return computed === null ? item : { ...item, distance: Math.round(computed) };
}

// ---------------------------------------------------------------- cluster --
/** `cluster/get.php` rows use center_latitude / center_longitude / radius_meters. */
export const readCluster = (record) => ({
  raw: record,
  id: readId(record),
  label: readField(record, ['barangay_name', 'label', 'name'], 'Cluster'),
  clusterDate: readField(record, ['cluster_date'], ''),
  count: toNumber(readField(record, ['report_count', 'count', 'total'], null), null) ?? 0,
  affectedHouses: toNumber(readField(record, ['affected_houses'], null), null),
  forecastLevel: readField(record, ['forecast_level'], ''),
  confidenceScore: toNumber(readField(record, ['confidence_score'], null), null),
  severityScore: toNumber(readField(record, ['severity_score'], null), null),
  status: readField(record, ['status'], ''),
  lat: toNumber(readField(record, ['center_latitude', 'latitude', 'lat'], null), null),
  lng: toNumber(readField(record, ['center_longitude', 'longitude', 'lng'], null), null),
  radiusMeters: toNumber(readField(record, ['radius_meters', 'radius'], null), null),
  calculatedAt: readField(record, ['calculated_at'], ''),
  reports: Array.isArray(record?.reports) ? record.reports : [],
});
