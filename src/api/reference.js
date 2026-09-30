import { apiRequest, pickItem, unwrapPayload } from './client';

/**
 * Shared reference data: roles, barangays, outage categories, severity levels,
 * hazard types, statuses, power-station types, safety-timer types, notification types.
 *
 * TODO(API-CONFIRM) the exact keys in the response, e.g. `barangays`,
 * `outage_categories`, `severity_levels`, `hazard_types`, `statuses`,
 * `power_station_types`, `safety_timer_types`, `notification_types`.
 * `ReferenceContext` normalises whatever comes back into a stable shape.
 */
export async function getReference({ signal } = {}) {
  const payload = await apiRequest('/api/reference/get.php', { signal });
  return unwrapPayload(payload) ?? pickItem(payload) ?? {};
}
