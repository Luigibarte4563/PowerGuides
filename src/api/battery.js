import { apiRequest, pickList } from './client';

/**
 * Battery tracking - the caller's own devices only.
 *
 * Confirmed contract (`api/battery/*`):
 *   create.php          POST { device_type*, device_name*, capacity_mah?, current_percentage?,
 *                                is_primary? } -> { success, message, device_id }
 *                        device_type enum: phone | laptop | powerbank | ups | tablet | other
 *   get.php             -> data rows: { id, device_name, device_type, capacity_mah,
 *                        current_percentage, is_primary, created_at, updated_at,
 *                        estimated_hours_remaining, estimated_usage_rate_per_hour?,
 *                        recent_logs: [ ... ] }
 *   get_history.php     ?device_id* -> data rows: { id, battery_device_id,
 *                        battery_percentage_start, battery_percentage_end, usage_minutes,
 *                        estimated_watts, activity, logged_at }
 *   update.php          POST { device_id*, device_name, device_type, capacity_mah,
 *                        current_percentage, is_primary }
 *   set_percentage.php  POST { device_id*, current_percentage* }
 *   log_usage.php       POST { device_id*, battery_percentage_start*,
 *                        battery_percentage_end*, usage_minutes?, estimated_watts?, activity? }
 *                        (also updates the device's current percentage)
 *   delete.php          POST { device_id* }
 */
export const BATTERY_DEVICE_TYPES = [
  'phone',
  'laptop',
  'powerbank',
  'ups',
  'tablet',
  'other',
];

export const batteryApi = {
  async create(data, { signal } = {}) {
    return apiRequest('/api/battery/create.php', { method: 'POST', body: data, signal });
  },

  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/battery/get.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  async getHistory({ device_id: deviceId, ...params } = {}, { signal } = {}) {
    const payload = await apiRequest('/api/battery/get_history.php', {
      params: { device_id: deviceId, ...params },
      signal,
    });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  async update(data, { signal } = {}) {
    return apiRequest('/api/battery/update.php', { method: 'POST', body: data, signal });
  },

  async setPercentage({ device_id: deviceId, current_percentage: percentage }, { signal } = {}) {
    return apiRequest('/api/battery/set_percentage.php', {
      method: 'POST',
      body: { device_id: deviceId, current_percentage: percentage },
      signal,
    });
  },

  async logUsage(data, { signal } = {}) {
    return apiRequest('/api/battery/log_usage.php', { method: 'POST', body: data, signal });
  },

  async remove(deviceId, { signal } = {}) {
    return apiRequest('/api/battery/delete.php', {
      method: 'POST',
      body: { device_id: deviceId },
      signal,
    });
  },
};
