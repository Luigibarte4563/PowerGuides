import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import RoleChangeGuard from '@/components/RoleChangeGuard';
import { COMPANY_NAV, COMPANY_NAV_GROUPS, findCompanyNavItem } from '@/routes/companyNavItems';

/** Sidebar width preference, namespaced so it survives a switch between the two apps. */
const COLLAPSED_KEY = 'powerguide.company.sidebar.collapsed';

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Chrome for the Electric Company Dashboard.
 *
 * Identical shell to `DashboardLayout` (the two apps share the sidebar, top bar and
 * card language) with the company navigation wired in. Access control is NOT here -
 * `RequireRole` wraps this route so the gate cannot be bypassed by a deep link.
 */
export default function CompanyLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* private mode: the rail just resets on reload */
      }
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#company-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        items={COMPANY_NAV}
        groups={COMPANY_NAV_GROUPS}
        homeTo="/company"
        notificationsTo="/company/notifications"
        ariaLabel="Electric Company Dashboard navigation"
      />

      <div className={clsx('transition-[padding] duration-200', collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-[17.5rem]')}>
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
        <main id="company-content" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            {/* FR-AUTH-4b - offers a re-login when the API refuses a call this role
                used to be allowed to make. */}
            <RoleChangeGuard />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
