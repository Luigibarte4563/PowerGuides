import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import RoleChangeGuard from '@/components/RoleChangeGuard';
import { ADMIN_NAV, ADMIN_NAV_GROUPS, findAdminNavItem } from '@/routes/adminNavItems';

/**
 * Chrome for the Admin Dashboard (`/admin`).
 *
 * Same shell as the other two apps with the admin navigation wired in. Access control
 * is NOT here - `RequireRole` wraps this route so the gate cannot be bypassed by a
 * deep link.
 *
 * The admin app has no pages of its own for profile or notifications: an admin is a
 * company-level account, so those links reuse the staff app's pages, which already
 * render the account details and the capabilities of the current role.
 */
export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div
      data-theme="dark"
      data-surface="dark"
      className="flex h-screen overflow-hidden bg-[#03041A] font-montserrat text-white"
    >
      <a href="#admin-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={ADMIN_NAV}
        groups={ADMIN_NAV_GROUPS}
        homeTo="/admin"
        notificationsTo="/company/notifications"
        profileTo="/company/profile"
        ariaLabel="Admin Dashboard navigation"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          findItem={findAdminNavItem}
          appLabel="PowerGuide Dagupan · Admin"
          fallbackTitle="Dashboard"
          profileTo="/company/profile"
          notificationsTo="/company/notifications"
          showLocationLink
        />
        <main
          id="admin-content"
          className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[#03041A]"
        >
          {/* FR-AUTH-4b - offers a re-login when the API refuses a call this role
              used to be allowed to make. */}
          <RoleChangeGuard />
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
