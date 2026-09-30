import { apiRequest, pickList } from './client';

/**
 * Maintenance schedules.
 *
 * Resident-facing reads (`get.php`, `get_upcoming.php`, `maintenance_map/get.php`)
 * only need an authenticated session. The writes and `get_complete.php` are gated on
 * `['electric_company', 'admin']` by `auth/rbac.php`, so the company dashboard gates
 * the matching UI on `isManager`.
 *
 * Confirmed contract:
 *   get.php          -> { success, total, data: [ id, company_name, radius,
 *                         maintenance_date, start_time, end_time, description, status,
 *                         created_at, locations: [ { barangay_name, lat, lng } ] ] }
 *                        KNOWN GAP: the query filters on the creator's role being
 *                        `electric_company`, so schedules created by an `admin` are
 *                        never returned here. `created_by` is selected but not
 *                        emitted, so ownership cannot be checked client-side either.
 *   get_upcoming.php -> { success, upcoming_count, current_date, current_time }
 *                        (a COUNT only - no rows, so "Upcoming" filters get.php rows
 *                         by the same statuses the server counts)
 *   get_complete.php -> { success, count, data: [ ms.* + company_name ] } - staff only
 *   maintenance_map/get.php ?status=&date= -> same row shape as get.php PLUS created_by
 *
 *   create.php  POST { maintenance_date*, start_time*, end_time*, barangays*[],
 *                      description?, radius? (default 2000) }
 *              -> { success, message, maintenance_id, barangays, users_notified }
 *              `barangays` is an array of NAMES; each is geocoded. A 409 means a
 *              schedule already exists for that date + barangay.
 *   update.php  POST { maintenance_id*, status?, maintenance_date?, start_time?, end_time?,
 *                      description?, radius?, barangays? }
 *              PARTIAL UPDATE. Every field except `maintenance_id` is optional and falls back
 *              to the stored value, so `{ maintenance_id, status }` alone is a valid
 *              "just move this schedule" call - which it is not on any other endpoint here.
 *              `status` is honoured only when it is one of
 *              upcoming|ongoing|completed|cancelled, otherwise it is derived from the window.
 *              `barangays` may be an array, a JSON array string, or a comma-separated list;
 *              omitted OR sent unchanged, the existing locations are kept and left alone
 *              (no delete/re-insert, so an edit that did not touch the areas cannot wipe the
 *              geocoded coordinates off the maintenance map).
 *              `radius` omitted keeps the stored value; supplying 0 or omitting it no longer
 *              silently shrinks the notify radius to 500.
 *              -> { success, message, maintenance_id, status, previous_status, status_changed,
 *                   residents_notified, barangays, users_notified, notification_breakdown }
 *              `notification_breakdown` = { by_barangay, by_radius, no_location, out_of_area,
 *              degraded } and explains `users_notified`: `no_location` counts residents with
 *              no saved location at all, `out_of_area` counts those deliberately skipped as
 *              outside the radius. Validation problems now answer 400 (not 500) with no
 *              server paths in the body.
 *              Known gap (SEC-2): the role is checked but ownership is not, so any company
 *              user can edit any schedule.
 *   delete.php  POST { maintenance_id* } - owner-scoped: `created_by` must be the
 *              caller AND their role must be `electric_company`/`admin`.
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

  /** Staff only - `electric_company` / `admin`. */
  async getComplete(_params, { signal } = {}) {
    const payload = await apiRequest('/api/maintenance/get_complete.php', { signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  /** Areas affected by maintenance, for the map view. */
  async getMapData(params, { signal } = {}) {
    const payload = await apiRequest('/api/maintenance_map/get.php', { params, signal });
    return { items: pickList(payload), total: payload?.total ?? null, raw: payload };
  },

  /** Manager only. `barangays` is an array of names. */
  async create(data, { signal } = {}) {
    return apiRequest('/api/maintenance/create.php', { method: 'POST', body: data, signal });
  },

  /**
   * Manager only.
   *
   * A PARTIAL update - `maintenanceApi.setStatus(id, status)` is the common case and
   * sends nothing but the id and the new status.
   */
  async update(data, { signal } = {}) {
    return apiRequest('/api/maintenance/update.php', { method: 'POST', body: data, signal });
  },

  /** Move a schedule's status on its own (FR-MNT-3). No other field is touched. */
  async setStatus(maintenanceId, status, { signal } = {}) {
    return apiRequest('/api/maintenance/update.php', {
      method: 'POST',
      body: { maintenance_id: maintenanceId, status },
      signal,
    });
  },

  /** Manager only, and only for a schedule this user created. */
  async remove(maintenanceId, { signal } = {}) {
    return apiRequest('/api/maintenance/delete.php', {
      method: 'POST',
      body: { maintenance_id: maintenanceId },
      signal,
    });
  },
};

/** Statuses counted as "upcoming" by `get_upcoming.php`. */
export const UPCOMING_STATUSES = ['upcoming', 'ongoing'];

/** Statuses `update.php` honours when given explicitly; anything else is derived. */
export const MAINTAINABLE_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];
