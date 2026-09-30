import { apiRequest, pickList } from './client';

/**
 * Heatmap points and stored clusters - read only for normal users
 * (`cluster/store.php` is staff-only and is not used here).
 *
 * Confirmed contract:
 *   heatmap/get.php ?mode=by_barangay|clusters&radius=<metres>&days=<lookback, default 7>
 *     -> { success, mode, lookback_days, report_count, point_count, data }
 *        mode=by_barangay rows: { barangay_id, barangay_name, report_count, affected_houses,
 *                                 latitude, longitude, confidence_score, severity_score,
 *                                 forecast_level }
 *        mode=clusters  rows: { latitude, longitude, radius_meters, report_count,
 *                                 affected_houses, confidence_score, severity_score,
 *                                 forecast_level }
 *   cluster/get.php ?status=&barangay=&from_date=&include_reports=1
 *     -> { success, count, data: [ id, cluster_date, center_latitude, center_longitude,
 *          radius_meters, report_count, affected_houses, confidence_score, severity_score,
 *          forecast_level, status, calculated_at, barangay_name ] }
 *
 * `heatmap/get.php` does NOT return lat/lng/intensity triplets, so the intensity for
 * Leaflet.heat is derived from report_count and the returned scores.
 */
export const heatmapApi = {
  /** @param {'by_barangay'|'clusters'} [mode] */
  async getHeatmap(params, { signal } = {}) {
    const payload = await apiRequest('/api/heatmap/get.php', {
      params: { mode: 'by_barangay', ...params },
      signal,
    });

    const items = pickList(payload);
    const maxCount = items.reduce((max, item) => Math.max(max, Number(item.report_count) || 0), 0) || 1;

    const points = items
      .map((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        // Normalise report_count to the 0.2..1 range leaflet.heat expects.
        const weight = (Number(item.report_count) || 0) / maxCount;
        return {
          lat,
          lng,
          intensity: 0.2 + Math.min(0.8, weight * 0.8),
          label: item.barangay_name || 'Unknown',
          reportCount: Number(item.report_count) || 0,
          forecastLevel: item.forecast_level || '',
          severityScore: item.severity_score ?? null,
          confidenceScore: item.confidence_score ?? null,
          radiusMeters: item.radius_meters ?? null,
          raw: item,
        };
      })
      .filter(Boolean);

    return {
      points,
      items,
      mode: payload?.mode ?? 'by_barangay',
      lookbackDays: payload?.lookback_days ?? null,
      reportCount: payload?.report_count ?? null,
      raw: payload,
    };
  },

  async getClusters(params, { signal } = {}) {
    const payload = await apiRequest('/api/cluster/get.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  /**
   * FR-MAP-3 - persist a calculated cluster. Staff only
   * (['lineman', 'electric_company', 'admin']).
   * -> { success, message, cluster_id }
   *
   * `status` is NOT an input: the endpoint always writes 'active'. `report_ids` are
   * looked up for their coordinates and stored with a computed `distance_meters`;
   * ids that do not resolve are skipped. `barangay_id` is a numeric id, not a name.
   */
  async storeCluster(data, { signal } = {}) {
    return apiRequest('/api/cluster/store.php', { method: 'POST', body: data, signal });
  },
};

/** `cluster/store.php` rejects anything outside this list. */
export const CLUSTER_FORECAST_LEVELS = ['low', 'moderate', 'high', 'critical'];
