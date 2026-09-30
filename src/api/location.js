import { apiRequest, pickItem } from './client';

/**
 * The user's saved (primary) location, used by every "near me" feature.
 *
 * Confirmed contract (`api/user_location/*`):
 *   get.php       -> { success, data: { location_name, address, barangay, barangay_id,
 *                       latitude, longitude, updated_at } }
 *                   When nothing is saved the row is returned with null values and NO
 *                   barangay_id, so every field must be read defensively.
 *   location.php  POST { address* (location_name accepted as fallback), barangay_name? }
 *                   -> { success, message, data: { address, latitude, longitude, barangay,
 *                      barangay_id } }
 *                   IMPORTANT: coordinates are GEOCODED server-side from the address text -
 *                   the client cannot send lat/lng, so the form is address-first.
 */
export const locationApi = {
  async get({ signal } = {}) {
    const payload = await apiRequest('/api/user_location/get.php', { signal });
    return pickItem(payload);
  },

  async save(data, { signal } = {}) {
    return apiRequest('/api/user_location/location.php', { method: 'POST', body: data, signal });
  },
};
