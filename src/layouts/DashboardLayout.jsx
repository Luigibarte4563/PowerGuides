import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/** Persisted so the sidebar width survives a reload. */
const COLLAPSED_KEY = 'powerguide.sidebar.collapsed';

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Dashboard chrome: persistent sidebar + top bar with the routed page inside. */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Icon-only rail on desktop. Never collapsed on mobile - there the sidebar is a
  // temporary drawer, so a collapsed rail would hide the labels with no room for
  // them, and `open` already controls visibility.
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
    <div className="min-h-screen bg-canvas dark:bg-navy-950">
      <a href="#dashboard-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      {/* Reserve room for the rail: the sidebar is fixed, so the content has to
          be offset by whichever width it currently is. */}
      <div className={clsx('transition-[padding] duration-200', collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-[17.5rem]')}>
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main id="dashboard-content" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
