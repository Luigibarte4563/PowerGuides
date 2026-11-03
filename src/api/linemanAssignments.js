import { apiRequest, pickList } from './client';

/**
 * Lineman <-> barangay assignments.
 *
 * The database is the source of truth: an `electric_company` / `admin` account posts a
 * lineman and a barangay, and the backend stores it in `lineman_assignments` and enforces
 * it on every outage endpoint. Nothing here is cached in localStorage and no assignment
 * is modelled client-side - `my.php` exists so a lineman's own scope is read back from
 * the server rather than assumed from their role.
 *
 * Confirmed contract (see `C:\xampp\htdocs\CrowdsourcedAPI\api\lineman_assignment`):
 *   get.php     GET  ?lineman_id=&barangay_id=&status=
 *                     -> { success, message, count, data: Assignment[] }
 *                     Managers only. Each filter is validated server-side; an invalid one
 *                     is a 400 rather than a silently-ignored "return everything".
 *   linemen.php GET  -> { success, message, count, data: { id, name, email }[] }
 *                     Managers only. The ONLY user listing in the API, restricted to
 *                     `role = 'lineman'` and to name + email. It exists because nothing
 *                     else can fill a "Select Lineman" picker - there is no user
 *                     directory endpoint anywhere in this backend.
 *   create.php  POST { lineman_id, barangay_id, work_type? }
 *                     -> 201 { success, message, data: Assignment }
 *                     400 if the id does not exist, or the target's role is not
 *                     `lineman`; 409 if the pair is ALREADY active.
 *                     Re-assigning a pair that was deactivated reactivates that same row
 *                     (the table is UNIQUE on lineman_id + barangay_id), so it also
 *                     answers 201 with "Assignment reactivated".
 *                     `assigned_by` is never read from the body - it comes from the JWT.
 *   update.php  POST { id, lineman_id?, barangay_id?, status?, work_type? }
 *                     -> 200 { success, message, data: Assignment }
 *                     PARTIAL UPDATE: omitted fields keep their stored value, so a
 *                     status-only edit cannot blank the barangay. 400 for an invalid
 *                     value, 404 unknown id, 409 when the move lands on a pair the same
 *                     lineman already holds. `assigned_by` is rewritten to the editor.
 *   delete.php  POST { id } -> 200 { success, message, id, status: 'inactive' }
 *                     Deactivates; the row and its history are kept. Idempotent - an
 *                     already-inactive row is a 200, an unknown id is a 404.
 *   my.php      GET  -> { success, message, count, data:
 *                           { id, barangay_id, barangay_name, status, work_type }[] }
 *                     Lineman only, and there is deliberately no id parameter: the
 *                     identity comes from the JWT alone, so a lineman cannot ask for
 *                     anybody else's assignments. Only ACTIVE rows are returned.
 *
 * `work_type` ('outage' | 'maintenance' | 'both', default 'both') says what the
 * assignment is FOR, and it GATES access:
 *   - outage endpoints accept only work_type 'outage' or 'both'
 *     (auth/lineman_access.php);
 *   - maintenance STATUS updates accept only work_type 'maintenance' or 'both'
 *     (maintenance/update.php, status-only).
 * A 'both' assignment grants both; existing rows default to 'both'.
 */

/** Row shape returned by get.php, create.php and update.php. */
function readAssignment(row) {
  return {
    id: Number(row?.id),
    linemanId: Number(row?.lineman_id),
    linemanName: row?.lineman_name || '',
    linemanEmail: row?.lineman_email || '',
    barangayId: Number(row?.barangay_id),
    barangayName: row?.barangay_name || '',
    assignedBy: row?.assigned_by ?? null,
    assignedByName: row?.assigned_by_name || '',
    assignedAt: row?.assigned_at || '',
    updatedAt: row?.updated_at || '',
    status: row?.status || 'active',
    workType: row?.work_type || 'both',
  };
}

/** Row shape returned by my.php - deliberately has no assigned_by or email. */
function readMyAssignment(row) {
  return {
    id: Number(row?.id),
    barangayId: Number(row?.barangay_id),
    barangayName: row?.barangay_name || '',
    status: row?.status || 'active',
    workType: row?.work_type || 'both',
  };
}

export const linemanAssignmentsApi = {
  /** Managers only - every assignment, with optional filters. */
  async list(params = {}, { signal } = {}) {
    const payload = await apiRequest('/api/lineman_assignment/get.php', {
      params: {
        lineman_id: params.linemanId,
        barangay_id: params.barangayId,
        status: params.status,
      },
      signal,
    });
    return { items: pickList(payload).map(readAssignment), count: payload?.count ?? null, raw: payload };
  },

  /** Managers only - the assignable linemen, for the dropdown. */
  async listLinemen(_params, { signal } = {}) {
    const payload = await apiRequest('/api/lineman_assignment/linemen.php', { signal });
    return {
      items: pickList(payload).map((row) => ({
        id: Number(row?.id),
        name: row?.name || '',
        email: row?.email || '',
      })),
      count: payload?.count ?? null,
      raw: payload,
    };
  },

  /** Managers only. Ids are numbers; the server rejects anything non-integer with 400. */
  async create({ linemanId, barangayId, workType }, { signal } = {}) {
    const body = { lineman_id: linemanId, barangay_id: barangayId };
    if (workType) body.work_type = workType;
    return apiRequest('/api/lineman_assignment/create.php', { method: 'POST', body, signal });
  },

  /** Managers only. Partial - send just the fields that change. */
  async update({ id, linemanId, barangayId, status, workType }, { signal } = {}) {
    const body = { id };
    if (linemanId !== undefined && linemanId !== '') body.lineman_id = linemanId;
    if (barangayId !== undefined && barangayId !== '') body.barangay_id = barangayId;
    if (status) body.status = status;
    if (workType) body.work_type = workType;
    return apiRequest('/api/lineman_assignment/update.php', { method: 'POST', body, signal });
  },

  /** Managers only. Deactivates rather than deleting. */
  async remove(id, { signal } = {}) {
    return apiRequest('/api/lineman_assignment/delete.php', {
      method: 'POST',
      body: { id },
      signal,
    });
  },

  /** Lineman only - the caller's own active assignments, straight from the JWT. */
  async listMine(_params, { signal } = {}) {
    const payload = await apiRequest('/api/lineman_assignment/my.php', { signal });
    return {
      items: pickList(payload).map(readMyAssignment),
      count: payload?.count ?? null,
      raw: payload,
    };
  },
};

/** The single value `status` accepts besides `inactive`. */
export const ACTIVE_ASSIGNMENT_STATUS = 'active';
export const INACTIVE_ASSIGNMENT_STATUS = 'inactive';

/** What an assignment is for. Metadata only - it never widens or narrows access. */
export const ASSIGNMENT_WORK_TYPES = ['outage', 'maintenance', 'both'];

export const WORK_TYPE_LABELS = {
  outage: 'Outage work',
  maintenance: 'Maintenance work',
  both: 'Outage + maintenance',
};

export function workTypeLabel(workType) {
  return WORK_TYPE_LABELS[normaliseWorkType(workType)] || WORK_TYPE_LABELS.both;
}

function normaliseWorkType(workType) {
  return String(workType ?? 'both').trim().toLowerCase();
}

export function isActiveAssignment(assignment) {
  return String(assignment?.status || '').toLowerCase() === ACTIVE_ASSIGNMENT_STATUS;
}

/** Normalised read for an item returned by `my.php`, for reuse outside the service. */
export { readAssignment, readMyAssignment };