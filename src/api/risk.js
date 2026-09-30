import { apiRequest, pickList } from './client';

/**
 * Nearby risk areas.
 *
 * Confirmed contract (`api/risk/get_nearby.php`):
 *   ?lat=&lng=&radius= (radius in metres, server default 3000)
 *   -> { success, radius, counts: { floods, hazards },
 *        data: { floods: [...], hazards: [...] } }
 *
 *   Both arrays share one row shape:
 *   { id, category: 'flood' | 'hazard', location_name, latitude, longitude,
 *     risk_level, description, reported_at, barangay_name, distance (metres) }
 *   `risk_level` is flood_level for floods and severity for hazards.
 *   NOTE: `id` comes from different tables in the two arrays and can collide, so records
 *   are keyed by `category` + `id` everywhere in the UI.
 */
export async function getNearbyRisks({ lat, lng, radius, ...params } = {}, { signal } = {}) {
  const payload = await apiRequest('/api/risk/get_nearby.php', {
    params: { lat, lng, radius, ...params },
    signal,
  });

  const data = payload?.data ?? {};
  const floods = Array.isArray(data.floods) ? data.floods : pickList({ data: data.risks });
  const hazards = Array.isArray(data.hazards) ? data.hazards : [];

  return {
    floods,
    hazards,
    risks: [...floods.map((item) => ({ ...item, __kind: 'flood' })), ...hazards.map((item) => ({ ...item, __kind: 'hazard' }))],
    counts: {
      floods: Number(payload?.counts?.floods ?? floods.length),
      hazards: Number(payload?.counts?.hazards ?? hazards.length),
    },
    radius: payload?.radius ?? radius ?? null,
    raw: payload,
  };
}
