import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import RoleChangeGuard from '@/components/RoleChangeGuard';
import { COMPANY_NAV, COMPANY_NAV_GROUPS, findCompanyNavItem } from '@/routes/companyNavItems';

/**
 * Chrome for the Electric Company Dashboard.
 *
 * Identical shell to `DashboardLayout` (the two apps share the sidebar, top bar and
 * card language) with the company navigation wired in. Access control is NOT here -
 * `RequireRole` wraps this route so the gate cannot be bypassed by a deep link.
 *
 * The map workspace pages render edge-to-edge; every other page keeps the standard
 * padded `max-w-7xl` column. `/company/outages` has no map and `/company/map` was
 * not converted, so both stay in the padded column.
 */
const WORKSPACE_PATHS = new Set([
  '/company/hazards',
  '/company/maintenance',
  '/company/power-stations',
]);

export default function CompanyLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isWorkspace = WORKSPACE_PATHS.has(location.pathname);

  return (
    <div
      data-theme="dark"
      data-surface="dark"
      className="flex h-screen overflow-hidden bg-[#03041A] font-montserrat text-white"
    >
      <a href="#company-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={COMPANY_NAV}
        groups={COMPANY_NAV_GROUPS}
        homeTo="/company"
        notificationsTo="/company/notifications"
        ariaLabel="Electric Company Dashboard navigation"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          findItem={findCompanyNavItem}
          appLabel="PowerGuide Dagupan · Company"
          fallbackTitle="Dashboard"
          profileTo="/company/profile"
          notificationsTo="/company/notifications"
          // A staff account is not a resident, but it is still a user account: the
          // "Near my location" station search (FR-PWR-6) is centred on the saved primary
          // location, so the link is kept for the case where one has not been set yet.
          showLocationLink
        />
        <main
          id="company-content"
          className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[#03041A]"
        >
          {/* FR-AUTH-4b - offers a re-login when the API refuses a call this role
              used to be allowed to make. */}
          <RoleChangeGuard />
          {isWorkspace ? (
            <Outlet />
          ) : (
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
