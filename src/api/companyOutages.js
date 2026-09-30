import { apiRequest, pickItem, pickList } from './client';

/**
 * Outage management for the Electric Company Dashboard.
 *
 * These endpoints are all gated by `auth/rbac.php` on
 * `['lineman', 'electric_company', 'admin']` and are the only outage calls a staff
 * user should make - the resident-facing `outage_report/get.php` filters nothing
 * and `get_detail.php` only opens other people's reports for staff roles.
 *
 * ---------------------------------------------------------------------------
 * `outage_report_electric_com/get.php`  ?status=&severity=&active=1|0
 *   -> { success, count, data: [ id, user_id, location_name, latitude, longitude,
 *        description, affected_houses, is_active, started_at, resolved_at,
 *        resolution_note, created_at, updated_at, barangay_name, category, severity,
 *        hazard_type, status ] }
 *   Names are matched exactly (st.status_name = :status), so the reference
 *   `outage_statuses` / `severity_levels` labels are what the filter sends.
 *   `active` is presence-based server side: `?active=` casts to 0, so it must be
 *   omitted rather than sent empty.
 *   No `report_key` and no `category`/`barangay` filter - see `outage/get.php`.
 *
 * `outage/get.php`  ?status=&category=&severity=&barangay=
 *   -> same rows PLUS `report_key`, but no `active` filter. This is the "raw
 *   all-reports" view (FR-OUT-10); the roles match.
 *
 * `outage_report_electric_com/update_single.php`  POST { id*, status* }
 *   `status` is whitelisted server side to MANAGEABLE_STATUSES. `resolved` also
 *   stamps `resolved_at` and clears `is_active`.
 *   -> { success, message } (no row count)
 *
 * `outage_report_electric_com/update_barangay.php`  POST { barangay*, status* }
 *   `barangay` is a NAME (resolved against `barangays.barangay_name`, and the row is
 *   created if it does not exist). No status whitelist here - it falls back to
 *   `active` via `getStatusId()`, so only send values from the reference table.
 *   -> { success, message, affected }  (`affected` is the row count)
 *
 * `outage_report_electric_com/update_dagupan.php`  POST { status* }
 *   No WHERE clause at all: every row in `outage_reports` is updated.
 *   -> { success, message, affected }
 *
 * `outage/verify.php`  POST { outage_report_id*, verification_status*, notes?, status? }
 *   `verification_status` in VERIFICATION_STATUSES. The server derives the target
 *   report status from it (confirmed -> verified, false_report -> rejected,
 *   not_confirmed -> under_review); `status` overrides that.
 *   -> { success, message, verification_status, status }
 *
 * `outage/add_update.php`  POST { outage_report_id*, update_message*, status? }
 *   `status` is optional - omit it to record a note without moving the report.
 *   -> { success, message, status }
 *
 * `outage_report/get_detail.php?id=`  -> report + images[] + updates[] + verifications[]
 * ---------------------------------------------------------------------------
 */

/** The only statuses `update_single.php` accepts. */
export const MANAGEABLE_STATUSES = ['active', 'under_review', 'verified', 'resolved', 'rejected'];

/** Statuses `verify.php` accepts, and the report status each one implies. */
export const VERIFICATION_STATUSES = [
  { value: 'confirmed', label: 'Confirmed', impliedStatus: 'verified' },
  { value: 'not_confirmed', label: 'Not confirmed', impliedStatus: 'under_review' },
  { value: 'false_report', label: 'False report', impliedStatus: 'rejected' },
];

/** Statuses treated as "still needs work" for the open/closed counters. */
export const OPEN_STATUSES = ['active', 'under_review', 'verified'];

export function isOpenCompanyStatus(status) {
  const key = String(status ?? '').trim().toLowerCase();
  if (!key) return true;
  return OPEN_STATUSES.includes(key);
}

export const companyOutagesApi = {
  /**
   * Company-scoped list. `active` is only sent when explicitly set, because the
   * endpoint treats the parameter's PRESENCE as the filter and `?active=` becomes 0.
   */
  async listScoped(params = {}, { signal } = {}) {
    const payload = await apiRequest('/api/outage_report_electric_com/get.php', {
      params: { status: params.status, severity: params.severity, active: params.active },
      signal,
    });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  /** Raw all-reports view, including `report_key` and category/barangay filters. */
  async listRaw(params = {}, { signal } = {}) {
    const payload = await apiRequest('/api/outage/get.php', {
      params: {
        status: params.status,
        category: params.category,
        severity: params.severity,
        barangay: params.barangay,
      },
      signal,
    });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  async getDetail(id, { signal } = {}) {
    const payload = await apiRequest('/api/outage_report/get_detail.php', { params: { id }, signal });
    return pickItem(payload);
  },

  /** FR-OUT-6 - one report. No row count is returned, so the list is refetched. */
  async updateSingle({ id, status }, { signal } = {}) {
    return apiRequest('/api/outage_report_electric_com/update_single.php', {
      method: 'POST',
      body: { id, status },
      signal,
    });
  },

  /** FR-OUT-7 - every report in one barangay. Resolves to `{ affected }`. */
  async updateBarangay({ barangay, status }, { signal } = {}) {
    return apiRequest('/api/outage_report_electric_com/update_barangay.php', {
      method: 'POST',
      body: { barangay, status },
      signal,
    });
  },

  /** FR-OUT-8 - every report in Dagupan. Resolves to `{ affected }`. */
  async updateDagupan({ status }, { signal } = {}) {
    return apiRequest('/api/outage_report_electric_com/update_dagupan.php', {
      method: 'POST',
      body: { status },
      signal,
    });
  },

  /** FR-OUT-4 - staff verification; also moves the report status. */
  async verify({ outageReportId, verificationStatus, notes, status }, { signal } = {}) {
    return apiRequest('/api/outage/verify.php', {
      method: 'POST',
      body: {
        outage_report_id: outageReportId,
        verification_status: verificationStatus,
        notes: notes || '',
        // Omitted entirely when blank, so the server applies its own mapping.
        ...(status ? { status } : {}),
      },
      signal,
    });
  },

  /** FR-OUT-5 - a field update on the report's history. */
  async addUpdate({ outageReportId, message, status }, { signal } = {}) {
    return apiRequest('/api/outage/add_update.php', {
      method: 'POST',
      body: {
        outage_report_id: outageReportId,
        update_message: message,
        ...(status ? { status } : {}),
      },
      signal,
    });
  },
};

/** How many rows a bulk action will touch, for the confirmation copy (FR-OUT-9). */
export function countAffected(reports, { status, scope } = {}) {
  if (scope === 'all') return reports.length;
  if (!status) return reports.length;
  return reports.filter((report) => String(report?.status ?? '').toLowerCase() === String(status).toLowerCase())
    .length;
}
