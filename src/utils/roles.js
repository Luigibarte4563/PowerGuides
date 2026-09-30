/**
 * Role identifiers, mirrored from the PHP API.
 *
 * `auth/issue_jwt.php` puts `roles.role_name` in the JWT and `auth/me.php`
 * returns it as `data.role`, and `auth/rbac.php` compares it with a STRICT
 * `in_array($user['role'], $allowedRoles, true)`. That strict comparison is why
 * these strings are spelled out here instead of being inferred: a near-miss like
 * `electric-company` silently becomes a 403. Keep them in sync with the allow-lists
 * quoted on each group below - the backend stays the source of truth (NFR-2), these
 * only decide what the UI offers.
 *
 * Allow-lists, quoted from the endpoint sources:
 *   STAFF_ROLES   `outage_report_electric_com/*`, `outage/get|verify|add_update`,
 *                 `outage_report/get_detail`, `cluster/store`,
 *                 `electrical_hazard/update_status`
 *   MANAGER_ROLES `maintenance/create|update|delete|get_complete`,
 *                 `notification/create`
 *
 * Note the asymmetry: `notification/create.php` is the one endpoint a lineman cannot
 * call, so the compose UI is gated on MANAGER_ROLES and not on STAFF_ROLES.
 */

export const ROLE = {
  USER: 'user',
  LINEMAN: 'lineman',
  ELECTRIC_COMPANY: 'electric_company',
  ADMIN: 'admin',
};

/** Can review/verify reports, add field updates and manage hazards. */
export const STAFF_ROLES = [ROLE.LINEMAN, ROLE.ELECTRIC_COMPANY, ROLE.ADMIN];

/** Can plan maintenance, broadcast notifications and run bulk status changes. */
export const MANAGER_ROLES = [ROLE.ELECTRIC_COMPANY, ROLE.ADMIN];

/** Display labels used when `reference/get.php` has not loaded yet. */
export const ROLE_LABELS = {
  [ROLE.USER]: 'Community member',
  [ROLE.LINEMAN]: 'Lineman (field staff)',
  [ROLE.ELECTRIC_COMPANY]: 'Electric company',
  [ROLE.ADMIN]: 'System administrator',
};

/** `/company` is only reachable by these roles; everyone else gets access-denied. */
export const COMPANY_ROLES = STAFF_ROLES;

export function normaliseRole(role) {
  return String(role ?? '')
    .trim()
    .toLowerCase();
}

export function hasRole(role, allowed) {
  return allowed.includes(normaliseRole(role));
}

export function isStaff(role) {
  return hasRole(role, STAFF_ROLES);
}

export function isManager(role) {
  return hasRole(role, MANAGER_ROLES);
}

export function isCompanyUser(role) {
  return hasRole(role, COMPANY_ROLES);
}

/**
 * Human label for a role. `reference/get.php` publishes `roles` rows of
 * `{ id, role_name, description }`, so the description is preferred when the row is
 * available and the local table is only a pre-load fallback (FR-REF-2).
 */
export function roleLabel(role, referenceRoles = []) {
  const key = normaliseRole(role);
  if (!key) return 'Signed in';

  const match = referenceRoles.find(
    (option) => String(option?.id ?? option?.name ?? '').trim().toLowerCase() === key
  );
  return match?.description?.trim() || ROLE_LABELS[key] || key;
}

/**
 * The app roots this role may land on.
 *
 * Staff legitimately use both apps - the company profile even links into the resident one
 * - so their landing page is a choice rather than a fixed destination. Residents have only
 * the resident app.
 */
export function appRootsFor(role) {
  return isCompanyUser(role) ? ['/company', '/dashboard'] : ['/dashboard'];
}

/** Where this role belongs by default when nothing specific was requested. */
export function defaultRootFor(role) {
  return isCompanyUser(role) ? '/company' : '/dashboard';
}

/** True when the role can reach more than one app, so a chooser is worth showing. */
export function canChooseApp(role) {
  return appRootsFor(role).length > 1;
}

/**
 * Where a signed-in user belongs after login (FR-AUTH-4).
 *
 * An explicit `from` wins, but only when it is a path this role can actually reach -
 * otherwise a resident bounced off `/company` would be bounced straight back by the
 * stale `from` that sent them there.
 */
export function landingPathFor(role, from = '') {
  const roots = appRootsFor(role);

  // `startsWith('/')` plus the `//` guard rejects absolute and protocol-relative
  // URLs, which would navigate off the app entirely.
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) {
    return defaultRootFor(role);
  }

  return roots.some((root) => from === root || from.startsWith(`${root}/`)) ? from : defaultRootFor(role);
}
