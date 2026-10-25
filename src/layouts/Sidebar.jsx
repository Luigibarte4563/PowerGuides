import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import clsx from 'clsx';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { DASHBOARD_NAV, NAV_GROUPS } from '@/routes/navItems';
import { useNotifications } from '@/hooks/useNotifications';

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

/**
 * App sidebar - the Outages page treatment on every page.
 *
 * A fixed 340px dark panel (`lg:static`, so the shell is a flex row and the
 * content flows beside it) with the account controls pinned to the bottom. On
 * mobile it is a temporary drawer behind the top bar's hamburger.
 *
 * The resident and company apps share this chrome, so `items` / `groups` /
 * `homeTo` / `notificationsTo` / `profileTo` are props; they default to the
 * resident app.
 */
export default function Sidebar({
  open,
  onClose,
  items = DASHBOARD_NAV,
  groups = NAV_GROUPS,
  homeTo = '/dashboard',
  notificationsTo = '/dashboard/notifications',
  profileTo = '/dashboard/profile',
  ariaLabel = 'Dashboard navigation',
}) {
  const { unreadCount } = useNotifications();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const grouped = groups
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[700] animate-fade-in bg-[#03041A]/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="sidebar-panel"
        className={clsx(
          'fixed inset-y-0 left-0 z-[750] flex w-[21.25rem] max-w-[85vw] flex-col border-r-2 border-white/10 bg-[#03041A] font-montserrat text-white transition-transform duration-200 lg:static lg:z-auto lg:h-screen lg:max-w-none lg:shrink-0 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label={ariaLabel}
      >
        <div className="flex h-[76px] shrink-0 items-center justify-between px-5">
          <Logo to={homeTo} variant="light" />

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/50 transition hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="pg-immersive-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-5 pt-1">
          {grouped.map(({ group, items: groupItems }) => (
            <div key={group}>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                {group}
              </p>
              <ul className="space-y-1">
                {groupItems.map((item) => {
                  const badge = item.to === notificationsTo ? unreadCount : 0;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          clsx(
                            'group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition',
                            isActive
                              ? 'bg-[#FEBB02] text-[#03041A]'
                              : 'text-white/65 hover:bg-[#FEBB02] hover:text-[#03041A]'
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              className={clsx(
                                'h-[18px] w-[18px] shrink-0 transition',
                                isActive
                                  ? 'text-[#03041A]'
                                  : 'text-white/45 group-hover:text-[#03041A]'
                              )}
                              aria-hidden="true"
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {badge > 0 ? (
                              <span
                                className={clsx(
                                  'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                                  isActive
                                    ? 'bg-[#03041A] text-[#FEBB02]'
                                    : 'bg-[#FEBB02] text-[#03041A] group-hover:bg-[#03041A] group-hover:text-[#FEBB02]'
                                )}
                              >
                                {badge > 99 ? '99+' : badge}
                              </span>
                            ) : null}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
            <Link
              to={profileTo}
              onClick={onClose}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FEBB02] text-[11px] font-extrabold text-[#03041A]">
                  {initials(user?.name)}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-white">
                  {user?.name || 'Community member'}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-white/45">
                  {user?.email || 'No email on file'}
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-xl p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
