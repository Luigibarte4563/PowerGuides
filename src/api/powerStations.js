import { apiRequest, pickList } from './client';

/**
 * Power stations.
 *
 * Confirmed contract (`api/power_station/*`):
 *   create.php   POST { station_name*, location_name*, station_type, access_type,
 *                       availability_status, barangay_name, operating_hours,
 *                       charging_type, description }
 *                 -> { success, message }  (no id - one station per user, so creating a
 *                    second one returns 403 "You already have a power station...")
 *                 Coordinates are GEOCODED from `location_name`.
 *                 Enums: station_type = power_station|solar_station|charging_station|
 *                        generator_station; access_type = free|paid;
 *                        availability_status = available|busy|offline|maintenance.
 *   get.php                ?page=&limit= -> data rows (16 columns, see readStation)
 *   get_available.php      -> { total_available } (count only)
 *   get_near_location.php  ?radius=<metres> -> the CENTRE comes from the saved primary
 *                          location, so no lat/lng is sent. Rows include `distance` (metres)
 *                          and the response has `has_location`.
 *   get_my_posts.php       -> the caller's own stations
 *   update.php             POST { id*, station_name, location_name, station_type, access_type,
 *                          availability_status, operating_hours, charging_type, description,
 *                          barangay_name, latitude, longitude } (owner-only)
 *   delete.php             POST { station_id* } (owner-only)
 */
export const powerStationsApi = {
  async create(data, { signal } = {}) {
    return apiRequest('/api/power_station/create.php', { method: 'POST', body: data, signal });
  },

  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/power_station/get.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  /** Count of available stations (the endpoint returns no rows). */
  async getAvailable(_params, { signal } = {}) {
    const payload = await apiRequest('/api/power_station/get_available.php', { signal });
    return {
      count: Number(payload?.total_available ?? 0),
      totalAvailable: Number(payload?.total_available ?? 0),
      items: [],
      raw: payload,
    };
  },

  /** Only `radius` (metres) - the centre is the user's saved primary location. */
  async getNearLocation({ radius, ...params } = {}, { signal } = {}) {
    const payload = await apiRequest('/api/power_station/get_near_location.php', {
      params: { radius, ...params },
      signal,
    });
    return {
      items: pickList(payload),
      hasLocation: payload?.has_location ?? null,
      radius: payload?.radius ?? radius ?? null,
      raw: payload,
    };
  },

  async getMyPosts(params, { signal } = {}) {
    const payload = await apiRequest('/api/power_station/get_my_posts.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  /** Owner-only. */
  async update(data, { signal } = {}) {
    return apiRequest('/api/power_station/update.php', { method: 'POST', body: data, signal });
  },

  /** Owner-only - note the endpoint expects `station_id`. */
  async remove(stationId, { signal } = {}) {
    return apiRequest('/api/power_station/delete.php', {
      method: 'POST',
      body: { station_id: stationId },
      signal,
    });
  },
};
