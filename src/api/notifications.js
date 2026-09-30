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
};
