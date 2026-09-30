import { apiRequest, pickList } from './client';

/**
 * Maintenance schedules - read only for normal users (create/update/delete are
 * restricted to the utility company).
 *
 * Confirmed contract:
 *   maintenance/get.php        -> { success, total, data: [ id, company_name, radius (metres),
 *                                   maintenance_date, start_time, end_time, description,
 *                                   status, created_at,
 *                                   locations: [ { barangay_name, lat, lng } ] ] }
 *   maintenance/get_upcoming.php -> { success, upcoming_count, current_date, current_time }
 *                                   (a COUNT only - no rows, so the "Upcoming" tab filters
 *                                    get.php client-side)
 *   maintenance_map/get.php    ?status=&date= -> same row shape (plus created_by)
 */
export const maintenanceApi = {
  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/maintenance/get.php', { params, signal });
    return { items: pickList(payload), total: payload?.total ?? null, raw: payload };
  },

  async getUpcoming(_params, { signal } = {}) {
    const payload = await apiRequest('/api/maintenance/get_upcoming.php', { signal });
    return {
      count: Number(payload?.upcoming_count ?? 0),
      items: [],
      raw: payload,
    };
  },

  /** Areas affected by maintenance, for the map view. */
  async getMapData(params, { signal } = {}) {
    const payload = await apiRequest('/api/maintenance_map/get.php', { params, signal });
    return { items: pickList(payload), total: payload?.total ?? null, raw: payload };
  },
};

/** Statuses counted as "upcoming" by `maintenance/get_upcoming.php`. */
export const UPCOMING_STATUSES = ['upcoming', 'ongoing'];
