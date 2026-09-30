import { apiRequest, pickList } from './client';

/**
 * Flood reports.
 *
 * Confirmed contract (`api/flood_report/*`):
 *   create.php     POST { location_name*, flood_level?, latitude?, longitude?, description?,
 *                         barangay_name?, flood_depth_cm?, image_url? }
 *                    -> { success, message, flood_report_id }
 *                    `flood_level` enum: low | moderate | high | severe.
 *                    When latitude+longitude are both numeric they are used as-is, otherwise
 *                    `location_name` is geocoded.
 *   get.php        ?status=&flood_level=&barangay= -> data rows:
 *                    { id, reported_by, location_name, latitude, longitude, flood_depth_cm,
 *                      flood_level, description, image_proof, status, reported_at, updated_at,
 *                      barangay_name }
 *   get_nearby.php ?lat=&lng=&radius= (radius in metres, server default 3000)
 *                    -> data rows as above plus `distance` (metres)
 */
export const FLOOD_LEVELS = ['low', 'moderate', 'high', 'severe'];

export const floodsApi = {
  async create(data, { signal } = {}) {
    return apiRequest('/api/flood_report/create.php', { method: 'POST', body: data, signal });
  },

  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/flood_report/get.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  async getNearby({ lat, lng, radius, ...params } = {}, { signal } = {}) {
    const payload = await apiRequest('/api/flood_report/get_nearby.php', {
      params: { lat, lng, radius, ...params },
      signal,
    });
    return { items: pickList(payload), count: payload?.count ?? null, radius: payload?.radius ?? radius, raw: payload };
  },
};
