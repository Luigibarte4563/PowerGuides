import { LayoutDashboard, Users } from 'lucide-react';

/**
 * Navigation for the Admin Dashboard (`/admin`).
 *
 * The admin app only contains what no other app can do - user & role management and
 * platform analytics. Everything operational already lives in `/company`, which an
 * admin can open like any staff account; the sidebar profile/notification links
 * therefore reuse the staff app's pages.
 */
export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Platform' },
  { to: '/admin/users', label: 'Users & Roles', icon: Users, group: 'Platform' },
];

/** Group order used by the sidebar. */
export const ADMIN_NAV_GROUPS = ['Platform'];

export function findAdminNavItem(pathname) {
  return (
    ADMIN_NAV.find((item) => item.end && pathname === item.to) ||
    ADMIN_NAV.filter((item) => !item.end)
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => pathname.startsWith(item.to)) ||
    null
  );
}
