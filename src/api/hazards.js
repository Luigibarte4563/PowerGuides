import { apiRequest, pickList } from './client';

/**
 * Electrical hazards.
 *
 * Confirmed contract (`api/electrical_hazard/*`):
 *   create.php          POST { location_name*, severity?, hazard_type?, latitude?, longitude?,
 *                              description?, barangay_name?, image_url? }
 *                         -> { success, message, hazard_id }
 *                         `severity` enum: low | moderate | high | critical
 *                         `hazard_type` is resolved by hazard_types.hazard_name
 *                         (defaults to "none"; unknown values return 400).
 *   get.php             ?status=&severity=&barangay= -> data rows:
 *                         { id, reported_by, location_name, latitude, longitude, description,
 *                           severity, status, image_proof, reported_at, resolved_at,
 *                           barangay_name, hazard_type }
 *   get_nearby.php      ?lat=&lng=&radius= (metres, server default 3000) -> same rows minus
 *                         image_proof, plus `distance` (metres)
 *   update_status.php   POST { status*, hazard_id* } (owner-only)
 *                         `status` enum: reported | verified | resolved
 */
export const HAZARD_SEVERITIES = ['low', 'moderate', 'high', 'critical'];
export const HAZARD_STATUSES = ['reported', 'verified', 'resolved'];

export const hazardsApi = {
  async create(data, { signal } = {}) {
    return apiRequest('/api/electrical_hazard/create.php', { method: 'POST', body: data, signal });
  },

  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/electrical_hazard/get.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  async getNearby({ lat, lng, radius, ...params } = {}, { signal } = {}) {
    const payload = await apiRequest('/api/electrical_hazard/get_nearby.php', {
      params: { lat, lng, radius, ...params },
      signal,
    });
    return { items: pickList(payload), count: payload?.count ?? null, radius: payload?.radius ?? radius, raw: payload };
  },

  /** Owner-only. */
  async updateStatus({ hazard_id: hazardId, status }, { signal } = {}) {
    return apiRequest('/api/electrical_hazard/update_status.php', {
      method: 'POST',
      body: { hazard_id: hazardId, status },
      signal,
    });
  },
};
