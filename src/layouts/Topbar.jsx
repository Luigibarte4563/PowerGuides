import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronDown, LogOut, Menu, Moon, Settings, Sun, User } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMarkAllAsRead, useNotifications } from '@/hooks/useNotifications';
import { findNavItem } from '@/routes/navItems';
import { ROLE_LABELS, normaliseRole } from '@/utils/roles';
import { formatRelativeTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';

function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'
  );
}

function useDismissable(ref, onDismiss) {
  useEffect(() => {
    const handlePointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss();
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onDismiss]);
}

/**
 * Dashboard top bar: page title, light/dark toggle, notification bell with unread
 * count, user menu.
 *
 * Shared by the resident and company layouts, so the page title, the account-menu
 * links and the subtitle come from props; they default to the resident app.
 */
export default function Topbar({
  onOpenSidebar,
  findItem = findNavItem,
  appLabel = 'PowerGuide Dagupan',
  fallbackTitle = 'Dashboard',
  profileTo = '/dashboard/profile',
  locationTo = '/dashboard/location',
  notificationsTo = '/dashboard/notifications',
  showLocationLink = true,
}) {
  const { user, logout, role } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const navItem = findItem(routerLocation.pathname);
  const pageTitle = navItem?.label || fallbackTitle;

  const { notifications, unreadCount, isLoading } = useNotifications();
  const markAll = useMarkAllAsRead();

  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const bellRef = useRef(null);
  const menuRef = useRef(null);

  useDismissable(bellRef, () => setBellOpen(false));
  useDismissable(menuRef, () => setMenuOpen(false));

  const recent = notifications.slice(0, 5);

  const handleLogout = async () => {
    setError('');
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (logoutError) {
      setError(toUserMessage(logoutError, 'We could not sign you out. Please try again.'));
      setMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-[600] flex h-16 items-center gap-3 border-b border-navy-100 bg-white/95 px-4 backdrop-blur dark:border-navy-700 dark:bg-navy-900/95 sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="inline-flex h-10 w-10 items-center justify-center rounded-control text-navy-700 transition hover:bg-navy-100 dark:text-navy-200 dark:hover:bg-navy-800 lg:hidden"
        aria-label="Open navigation"
        aria-controls="sidebar-panel"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy-400 dark:text-navy-400">{appLabel}</p>
        <h1 className="truncate text-base font-extrabold text-navy-900 dark:text-white sm:text-lg">{pageTitle}</h1>
      </div>

      {/* Light/dark toggle, ahead of the bell so both read as one control cluster. */}
      <button
        type="button"
        onClick={toggleTheme}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-control text-navy-600 transition hover:bg-navy-100 dark:text-navy-300 dark:hover:bg-navy-800"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={isDark}
      >
        {/* Both icons are rendered and cross-faded so the control does not resize
            or pop as the theme changes. The moon is absolutely centred because it
            would otherwise be laid out after the sun. */}
        <Sun
          className={clsx(
            'h-5 w-5 transition duration-200',
            isDark ? 'scale-0 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
          )}
          aria-hidden="true"
        />
        <Moon
          className={clsx(
            'absolute inset-0 m-auto h-5 w-5 transition duration-200',
            isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-90 rotate-90 opacity-0'
          )}
          aria-hidden="true"
        />
      </button>

      {/* Notification bell + dropdown */}
      <div className="relative" ref={bellRef}>
        <button
          type="button"
          onClick={() => setBellOpen((open) => !open)}
          className={clsx(
            'relative inline-flex h-10 w-10 items-center justify-center rounded-control transition',
            bellOpen
              ? 'bg-navy-100 text-navy-900 dark:bg-navy-800 dark:text-white'
              : 'text-navy-600 hover:bg-navy-100 dark:text-navy-300 dark:hover:bg-navy-800'
          )}
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-expanded={bellOpen}
          aria-haspopup="true"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold leading-[18px] text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>

        {bellOpen ? (
          <div className="absolute right-0 top-12 z-[650] w-[20rem] max-w-[calc(100vw-2rem)] animate-slide-up overflow-hidden rounded-card border border-navy-100 bg-white shadow-pop dark:border-navy-700 dark:bg-navy-800 dark:shadow-pop-dark">
            <div className="flex items-center justify-between gap-2 border-b border-navy-100 px-4 py-3 dark:border-navy-700">
              <p className="text-sm font-bold text-navy-900 dark:text-white">Notifications</p>
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending || unreadCount === 0}
                className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 transition hover:text-navy-900 disabled:opacity-50 dark:text-navy-300 dark:hover:text-white"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            </div>

            <ul className="max-h-80 divide-y divide-navy-100 overflow-y-auto dark:divide-navy-700">
              {isLoading ? (
                <li className="px-4 py-6 text-center text-sm text-navy-500 dark:text-navy-400">Loading notifications…</li>
              ) : recent.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-navy-500 dark:text-navy-400">
                  No notifications yet.
                </li>
              ) : (
                recent.map((notification) => (
                  <li
                    key={notification.id}
                    className={clsx(
                      'px-4 py-3',
                      !notification.isRead && 'bg-primary-50/60 dark:bg-primary-500/10'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.isRead ? (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-label="Unread" />
                      ) : null}
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-navy-400 dark:text-navy-400">
                          {humanize(notification.type, 'Update')}
                        </p>
                        <p className="line-clamp-2 text-sm text-navy-700 dark:text-navy-200">
                          {notification.title || notification.message || 'New update'}
                        </p>
                        <p className="mt-0.5 text-xs text-navy-400 dark:text-navy-400">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="border-t border-navy-100 p-2 dark:border-navy-700">
                <Link
                  to={notificationsTo}
                  onClick={() => setBellOpen(false)}
                  className="block rounded-control px-3 py-2 text-center text-sm font-semibold text-navy-700 transition hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-700"
                >
                  View all notifications
                </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={clsx(
            'flex items-center gap-2 rounded-control py-1.5 pl-1.5 pr-2 transition',
            menuOpen ? 'bg-navy-100 dark:bg-navy-800' : 'hover:bg-navy-100 dark:hover:bg-navy-800'
          )}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label="Account menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-primary-300 dark:bg-navy-700">
            {initials(user?.name)}
          </span>
          <span className="hidden max-w-[9rem] truncate text-sm font-semibold text-navy-800 dark:text-navy-100 sm:block">
            {user?.name || 'Account'}
          </span>
          <ChevronDown className="hidden h-4 w-4 text-navy-400 sm:block" aria-hidden="true" />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-12 z-[650] w-60 animate-slide-up overflow-hidden rounded-card border border-navy-100 bg-white shadow-pop dark:border-navy-700 dark:bg-navy-800 dark:shadow-pop-dark">
            <div className="border-b border-navy-100 px-4 py-3 dark:border-navy-700">
              <p className="truncate text-sm font-bold text-navy-900 dark:text-white">{user?.name}</p>
              <p className="truncate text-xs text-navy-500 dark:text-navy-400">{user?.email}</p>
              {role ? <p className="mt-1 text-xs font-semibold text-primary-700 dark:text-primary-300">{ROLE_LABELS[normaliseRole(role)] || role}</p> : null}
            </div>
            <ul className="p-2 text-sm">
              <li>
                <Link
                  to={profileTo}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-control px-3 py-2 font-semibold text-navy-700 transition hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-700"
                >
                  <User className="h-4 w-4 text-navy-400" aria-hidden="true" />
                  My profile
                </Link>
              </li>
              {showLocationLink ? (
                <li>
                  <Link
                    to={locationTo}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-control px-3 py-2 font-semibold text-navy-700 transition hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-700"
                  >
                    <Settings className="h-4 w-4 text-navy-400" aria-hidden="true" />
                    My location
                  </Link>
                </li>
              ) : null}
            </ul>
            {error ? <p className="px-4 pb-2 text-xs font-medium text-danger-600 dark:text-danger-200">{error}</p> : null}
            <div className="border-t border-navy-100 p-2 dark:border-navy-700">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-sm font-semibold text-danger-600 transition hover:bg-danger-50 dark:text-danger-200 dark:hover:bg-danger-500/15"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Log out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
