import { apiRequest, pickList } from './client';

/**
 * Notifications (the signed-in user only).
 *
 * Confirmed contract (`api/notification/*`):
 *   get.php               ?limit=&offset=&unread=1&type=&maintenance_id=
 *                         -> { success, total, unread_count, limit, offset, data: [ id, user_id,
 *                              title, message, type, is_read, outage_report_id, maintenance_id,
 *                              flood_report_id, electrical_hazard_id, safety_timer_id, created_at ] }
 *                         `unread_count` is the total unread count (ignores filters) - the
 *                         top bar uses it directly.
 *   mark_as_read.php      POST { notification_id* } (owner-scoped)
 *   mark_all_as_read.php  POST (no body)
 *   create.php            POST { user_id*, title*, message*, type? }  (manager only)
 *                         or   { notifications: [ { user_id, title, message, type? } ] }
 *                         Gated on ['electric_company', 'admin'] - a lineman gets 403,
 *                         so the compose UI is hidden rather than disabled-and-failing.
 *                         `type` is matched against `notification_types.type_name` and
 *                         silently falls back to `system`. In the array form, items
 *                         missing user_id/title/message are SKIPPED without an error,
 *                         so `created` may be lower than the number submitted - it is
 *                         the only trustworthy count, so the UI reports it back.
 *                         NOTE: there is no "target audience" endpoint. Broadcasting to
 *                         a barangay or to all users is therefore not possible from
 *                         the API; the dashboard resolves an audience to explicit
 *                         user_ids before calling (see composeAudience).
 */
export const notificationsApi = {
  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/notification/get.php', { params, signal });
    return {
      items: pickList(payload),
      unreadCount: Number(payload?.unread_count ?? 0),
      raw: payload,
    };
  },

  async markAsRead(notificationId, { signal } = {}) {
    return apiRequest('/api/notification/mark_as_read.php', {
      method: 'POST',
      body: { notification_id: notificationId },
      signal,
    });
  },

  async markAllAsRead(_, { signal } = {}) {
    return apiRequest('/api/notification/mark_all_as_read.php', { method: 'POST', signal });
  },

  /**
   * Manager only. Sends to one or many explicit `user_id`s - the endpoint has no
   * audience/broadcast concept, so the caller resolves the audience first.
   * `type` defaults server-side to `maintenance`.
   */
  async create({ title, message, type, userIds }, { signal } = {}) {
    const recipients = (userIds || []).map((id) => Number(id)).filter((id) => id > 0);
    if (recipients.length === 1) {
      return apiRequest('/api/notification/create.php', {
        method: 'POST',
        body: { user_id: recipients[0], title, message, ...(type ? { type } : {}) },
        signal,
      });
    }

    return apiRequest('/api/notification/create.php', {
      method: 'POST',
      body: {
        notifications: recipients.map((userId) => ({
          user_id: userId,
          title,
          message,
          ...(type ? { type } : {}),
        })),
      },
      signal,
    });
  },
};
