import { apiRequest, pickList } from './client';

/**
 * Safety timers.
 *
 * Confirmed contract (`api/safety_timer/*`):
 *   create.php  POST { timer_type_name?, duration_hours?, warning_hours_before?, title?, notes?,
 *                      started_at? }
 *                 -> { success, message, timer_id, started_at, warning_at,
 *                      expected_expiration_at, status: "running" }
 *                 Durations are in HOURS, not minutes. Send either `timer_type_name`
 *                 (looked up against safety_timer_types.timer_name, which also supplies the
 *                 default duration and warning window) OR `duration_hours`.
 *   get.php     -> data rows: { id, user_id, timer_type_id, title, started_at,
 *                 expected_expiration_at, warning_at, notes, completed_at, status, timer_id,
 *                 timer_name, default_duration_hours, warning_hours_before, type_description,
 *                 remaining_seconds }
 *                 `status` is recomputed server-side: running | warning | expired | stopped.
 *                 NOTE: this endpoint has write side effects (it persists status changes and
 *                 fires warning/expired notifications), so keep its refetch interval sensible.
 *   stop.php    POST { timer_id* }
 *   delete.php  POST { timer_id* }
 */
export const safetyTimersApi = {
  async create(data, { signal } = {}) {
    const payload = {
      title: data.title || data.timer_type_name || 'Safety timer',
      notes: data.notes || '',
    };

    if (data.timer_type_name) {
      // The server resolves the default duration + warning window from the type.
      payload.timer_type_name = data.timer_type_name;
      if (data.duration_hours) payload.duration_hours = Number(data.duration_hours);
      if (data.warning_hours_before !== undefined && data.warning_hours_before !== '') {
        payload.warning_hours_before = Number(data.warning_hours_before);
      }
    } else {
      payload.duration_hours = Number(data.duration_hours) || 1;
      if (data.warning_hours_before !== undefined && data.warning_hours_before !== '') {
        payload.warning_hours_before = Number(data.warning_hours_before);
      }
    }

    return apiRequest('/api/safety_timer/create.php', { method: 'POST', body: payload, signal });
  },

  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/safety_timer/get.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  async stop(timerId, { signal } = {}) {
    return apiRequest('/api/safety_timer/stop.php', {
      method: 'POST',
      body: { timer_id: timerId },
      signal,
    });
  },

  async remove(timerId, { signal } = {}) {
    return apiRequest('/api/safety_timer/delete.php', {
      method: 'POST',
      body: { timer_id: timerId },
      signal,
    });
  },
};
