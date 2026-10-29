import { apiRequest, pickList } from './client';

/**
 * Admin platform endpoints (`/api/admin`).
 *
 * Every endpoint here answers 403 unless the signed-in account holds the `admin`
 * role - the only single-entry allow-list in the API (`auth/rbac.php`). They exist
 * because the platform had no way to list accounts or change roles without editing
 * the database by hand, and no aggregate view across users.
 *
 * Confirmed contract (see `C:\xampp\htdocs\CrowdsourcedAPI\api\admin`):
 *   users.php       GET  ?role=&q=  -> { success, count, data: AdminUser[] }
 *                        Directory of every account: name, email, role, provider,
 *                        created_at, last_login. No password hash, google_id or
 *                        refresh_token is ever selected.
 *   update_role.php POST { user_id, role_id }
 *                        -> 200 { success, message, data: { id, previous_role, role, role_id } }
 *                        400 bad input / unknown role / changing your OWN role;
 *                        404 unknown user; idempotent when the target already holds
 *                        the role. The JWT carries the role claim, so the change
 *                        reaches the target's API permissions at their next sign-in -
 *                        the message returned says exactly that.
 *   create_user.php POST { first_name, last_name, email, password, role_id? }
 *                        -> 201 { success, message, data: AdminUser }
 *                        The authenticated counterpart of auth/register.php, with the
 *                        one power registration refuses: choosing the role. Validation
 *                        mirrors registration (400 required/invalid email/short
 *                        password/unknown role, 409 duplicate email); password is
 *                        hashed server-side and auth_provider is 'local'. No JWT is
 *                        issued - the new user signs in themselves.
 *   stats.php       GET  -> { success, data: Stats }
 *                        Platform aggregates: user totals and by role, outages by
 *                        status/severity, floods, hazards, maintenance, stations,
 *                        notifications, a zero-filled 30-day report trend and the
 *                        top barangays by report count.
 */

/** Row shape returned by users.php. */
function readUser(row) {
  return {
    id: Number(row?.id),
    name: row?.name || '',
    email: row?.email || '',
    role: row?.role || 'user',
    roleId: Number(row?.role_id),
    authProvider: row?.auth_provider || 'local',
    lastLogin: row?.last_login || '',
    createdAt: row?.created_at || '',
  };
}

/** Every group list in stats.php comes back as { label, count }. */
function readGroups(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    label: String(row?.label ?? ''),
    count: Number(row?.count ?? 0),
  }));
}

/** Snake_case payload from stats.php -> camelCase for the UI. */
function readStats(data) {
  const d = data && typeof data === 'object' ? data : {};
  return {
    users: {
      total: Number(d.users?.total ?? 0),
      newLast30Days: Number(d.users?.new_last_30_days ?? 0),
      byRole: readGroups(d.users?.by_role),
    },
    outages: {
      total: Number(d.outages?.total ?? 0),
      active: Number(d.outages?.active ?? 0),
      byStatus: readGroups(d.outages?.by_status),
      bySeverity: readGroups(d.outages?.by_severity),
    },
    floods: {
      total: Number(d.floods?.total ?? 0),
      unresolved: Number(d.floods?.unresolved ?? 0),
      byLevel: readGroups(d.floods?.by_level),
    },
    hazards: {
      total: Number(d.hazards?.total ?? 0),
      unresolved: Number(d.hazards?.unresolved ?? 0),
      bySeverity: readGroups(d.hazards?.by_severity),
    },
    maintenance: {
      total: Number(d.maintenance?.total ?? 0),
      byStatus: readGroups(d.maintenance?.by_status),
    },
    powerStations: {
      total: Number(d.power_stations?.total ?? 0),
      available: Number(d.power_stations?.available ?? 0),
    },
    notifications: {
      total: Number(d.notifications?.total ?? 0),
    },
    trend: (Array.isArray(d.trend) ? d.trend : []).map((row) => ({
      date: String(row?.date ?? ''),
      count: Number(row?.count ?? 0),
    })),
    topBarangays: (Array.isArray(d.top_barangays) ? d.top_barangays : []).map((row) => ({
      barangay: String(row?.barangay ?? ''),
      count: Number(row?.count ?? 0),
    })),
  };
}

export const adminApi = {
  /** Admin only - the user directory, with optional role and search filters. */
  async listUsers(params = {}, { signal } = {}) {
    const payload = await apiRequest('/api/admin/users.php', {
      params: { role: params.role, q: params.q },
      signal,
    });
    return { items: pickList(payload).map(readUser), count: payload?.count ?? null, raw: payload };
  },

  /** Admin only. Idempotent when the target already holds the role. */
  async updateRole({ userId, roleId }, { signal } = {}) {
    return apiRequest('/api/admin/update_role.php', {
      method: 'POST',
      body: { user_id: userId, role_id: roleId },
      signal,
    });
  },

  /**
   * Admin only. Creates a local account; `roleId` may be omitted, which the server
   * reads as the plain `user` role.
   */
  async createUser({ firstName, middleName, lastName, email, password, roleId }, { signal } = {}) {
    const body = { first_name: firstName, last_name: lastName, email, password };
    if (middleName) body.middle_name = middleName;
    if (roleId) body.role_id = roleId;
    return apiRequest('/api/admin/create_user.php', { method: 'POST', body, signal });
  },

  /** Admin only - every platform aggregate in one call. */
  async stats(_params, { signal } = {}) {
    const payload = await apiRequest('/api/admin/stats.php', { signal });
    return readStats(payload?.data ?? payload);
  },
};
