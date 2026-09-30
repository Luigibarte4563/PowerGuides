import {
  AlertTriangle,
  BatteryCharging,
  Bell,
  Flame,
  LayoutDashboard,
  MapPin,
  Plug,
  ShieldAlert,
  Timer,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';

/**
 * Single source of truth for dashboard navigation.
 * Used by the sidebar, the top-bar page title and the breadcrumb helper.
 */
export const DASHBOARD_NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true, group: 'Monitor' },
  { to: '/dashboard/outages', label: 'Outage Reports', icon: Zap, group: 'Report' },
  { to: '/dashboard/floods', label: 'Flood Reports', icon: Waves, group: 'Report' },
  { to: '/dashboard/hazards', label: 'Electrical Hazards', icon: AlertTriangle, group: 'Report' },
  { to: '/dashboard/risk-areas', label: 'Risk Areas', icon: ShieldAlert, group: 'Explore' },
  { to: '/dashboard/heatmap', label: 'Heatmap', icon: Flame, group: 'Explore' },
  { to: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench, group: 'Explore' },
  { to: '/dashboard/power-stations', label: 'Power Stations', icon: Plug, group: 'Explore' },
  { to: '/dashboard/location', label: 'My Location', icon: MapPin, group: 'Tools' },
  { to: '/dashboard/battery', label: 'Battery Tracking', icon: BatteryCharging, group: 'Tools' },
  { to: '/dashboard/safety-timers', label: 'Safety Timers', icon: Timer, group: 'Tools' },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell, group: 'Account' },
  { to: '/dashboard/profile', label: 'Profile', icon: LayoutDashboard, group: 'Account' },
];

/** Group order used by the sidebar. */
export const NAV_GROUPS = ['Monitor', 'Report', 'Explore', 'Tools', 'Account'];

export function findNavItem(pathname) {
  return (
    DASHBOARD_NAV.find((item) => item.end && pathname === item.to) ||
    DASHBOARD_NAV.filter((item) => !item.end)
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => pathname.startsWith(item.to)) ||
    null
  );
}
