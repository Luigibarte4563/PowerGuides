import { apiRequest, pickItem, pickList, uploadWithProgress } from './client';

/**
 * Outage reports.
 *
 * Contract (`api/outage_report/*`):
 *   create.php        POST { location_name*, description*, barangay_name?, category?,
 *                                severity?, hazard_type?, affected_houses?, started_at?,
 *                                latitude?, longitude? }
 *                     -> { success, message, report_id, barangay }
 *                     Coordinates: when `latitude` AND `longitude` are numeric the server stores
 *                     them verbatim and matches the barangay from that point; otherwise it
 *                     geocodes `location_name`. So a dropped pin takes precedence and also
 *                     skips the geocoding call.
 *                     Guard rails: 403 when the user already has an active report, 403 when the
 *                     point falls outside the coverage area, 400 on out-of-range coordinates,
 *                     404 when there is no pin and the name could not be geocoded.
 *   get.php           ?status=&category=  (matched by NAME)
 *                     -> { success, count, data: [ id, report_key, location_name, latitude,
 *                          longitude, description, affected_houses, is_active, started_at,
 *                          resolved_at, resolution_note, created_at, updated_at, barangay_id,
 *                          barangay_name, category, severity, hazard_type, status ] }
 *                     NOTE: rows do not include user_id - ownership is resolved by intersecting
 *                     with get_my_report.php ids.
 *   get_active.php    -> count only (`total_active_reports`)
 *   get_resolve.php   -> count only (`total_resolved`)
 *   get_my_report.php -> { count, data } for the signed-in user
 *   get_detail.php    ?id= -> report + images[], updates[], verifications[]; 403 for other users
 *   update.php        POST { id*, location_name, description, affected_houses, started_at,
 *                            category, severity, hazard_type, barangay_name, latitude?, longitude? }
 *                     (owner-only) A pin wins; otherwise the point is only re-geocoded when
 *                     `location_name` actually changed.
 *   delete.php        POST { id* } (owner-only, soft delete)
 *   upload_image.php  multipart: field `image` + `outage_report_id`, max 5 MB
 */
export const outagesApi = {
  async create(data, { signal } = {}) {
    return apiRequest('/api/outage_report/create.php', { method: 'POST', body: data, signal });
  },

  /** All reports, optionally filtered by status/category NAME. */
  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/outage_report/get.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  /** Count of active reports (the endpoint returns no rows). */
  async getActive(_params, { signal } = {}) {
    const payload = await apiRequest('/api/outage_report/get_active.php', { signal });
    return {
      count: Number(payload?.total_active_reports ?? 0),
      totalActive: Number(payload?.total_active_reports ?? 0),
      items: [],
      raw: payload,
    };
  },

  /** Count of resolved reports (the endpoint returns no rows). */
  async getResolved(_params, { signal } = {}) {
    const payload = await apiRequest('/api/outage_report/get_resolve.php', { signal });
    return {
      count: Number(payload?.total_resolved ?? 0),
      totalResolved: Number(payload?.total_resolved ?? 0),
      items: [],
      raw: payload,
    };
  },

  async getMyReports(params, { signal } = {}) {
    const payload = await apiRequest('/api/outage_report/get_my_report.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  async getDetail(id, { signal } = {}) {
    const payload = await apiRequest('/api/outage_report/get_detail.php', { params: { id }, signal });
    return pickItem(payload);
  },

  /** Owner-only. */
  async update(data, { signal } = {}) {
    return apiRequest('/api/outage_report/update.php', { method: 'POST', body: data, signal });
  },

  /** Owner-only. */
  async remove(id, { signal } = {}) {
    return apiRequest('/api/outage_report/delete.php', { method: 'POST', body: { id }, signal });
  },

  /** Owner-only. `outage_report_id` is required by the endpoint. */
  uploadImage(file, { onProgress, signal, outageReportId } = {}) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('outage_report_id', String(outageReportId));
    return uploadWithProgress('/api/outage_report/upload_image.php', formData, { onProgress, signal });
  },
};

/** Pull the new report id out of create.php (`report_id`). */
export function extractCreatedId(payload) {
  return payload?.report_id ?? payload?.data?.report_id ?? null;
}
