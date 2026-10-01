import {
  AlertTriangle,
  Bell,
  LayoutDashboard,
  Map as MapIcon,
  Plug,
  User,
  UserCheck,
  Wrench,
  Zap,
} from 'lucide-react';

/**
 * Navigation for the Electric Company Dashboard (`/company`).
 *
 * Kept separate from `DASHBOARD_NAV` (the resident app) because the two audiences
 * share no items beyond Profile - the company side manages reports, schedules and
 * broadcasts, the resident side files them.
 */
export const COMPANY_NAV = [
  { to: '/company', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Monitor' },
  { to: '/company/outages', label: 'Outage Reports', icon: Zap, group: 'Respond' },
  { to: '/company/hazards', label: 'Hazard Review', icon: AlertTriangle, group: 'Respond' },
  { to: '/company/assignments', label: 'Lineman Assignments', icon: UserCheck, group: 'Plan' },
  { to: '/company/maintenance', label: 'Maintenance', icon: Wrench, group: 'Plan' },
  { to: '/company/map', label: 'Map & Risk', icon: MapIcon, group: 'Plan' },
  { to: '/company/power-stations', label: 'Power Stations', icon: Plug, group: 'Assets' },
  { to: '/company/notifications', label: 'Notifications', icon: Bell, group: 'Account' },
  { to: '/company/profile', label: 'Profile', icon: User, group: 'Account' },
];

/** Group order used by the sidebar. */
export const COMPANY_NAV_GROUPS = ['Monitor', 'Respond', 'Plan', 'Assets', 'Account'];

export function findCompanyNavItem(pathname) {
  return (
    COMPANY_NAV.find((item) => item.end && pathname === item.to) ||
    COMPANY_NAV.filter((item) => !item.end)
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => pathname.startsWith(item.to)) ||
    null
  );
}
