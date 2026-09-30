import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import clsx from 'clsx';
import Logo from '@/components/Logo';
import { DASHBOARD_NAV, NAV_GROUPS } from '@/routes/navItems';
import { useNotifications } from '@/hooks/useNotifications';

/**
 * Dashboard sidebar: grouped links, unread badge, mobile drawer.
 *
 * `collapsed` switches it to an icon-only rail on desktop. The labels are then
 * removed from the DOM and the accessible name moves onto the link itself
 * (`aria-label` + `title`), so a rail is never a wall of unlabelled icons.
 *
 * The resident and company apps share this chrome, so `items` / `groups` /
 * `homeTo` / `notificationsTo` are props; they default to the resident app.
 */
export default function Sidebar({
  open,
  onClose,
  collapsed = false,
  onToggleCollapsed,
  items = DASHBOARD_NAV,
  groups = NAV_GROUPS,
  homeTo = '/dashboard',
  notificationsTo = '/dashboard/notifications',
  ariaLabel = 'Dashboard navigation',
}) {
  const { unreadCount } = useNotifications();

  const grouped = groups
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[700] bg-navy-950/50 animate-fade-in lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="sidebar-panel"
        className={clsx(
          'fixed inset-y-0 left-0 z-[750] flex flex-col bg-navy-900 transition-[width,transform] duration-200 lg:translate-x-0',
          collapsed ? 'w-[4.75rem]' : 'w-[17.5rem]',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label={ariaLabel}
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        <div
          className={clsx(
            'relative flex h-16 shrink-0 items-center border-b border-navy-800',
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          <Logo to={homeTo} variant="light" showText={!collapsed} />

          {/*
            Expanded: the toggle sits in the header. Collapsed there is no room
            beside the logo, so it becomes a small tab on the panel's right edge -
            which also makes it reachable from the content area.
          */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={clsx(
              'hidden text-navy-300 transition hover:text-white lg:block',
              collapsed
                ? 'absolute -right-2.5 top-1/2 -translate-y-1/2 rounded-l-control rounded-r-none border border-r-0 border-navy-700 bg-navy-800 p-1 shadow-card hover:bg-navy-700'
                : 'rounded-control p-2 hover:bg-navy-800'
            )}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-control p-2 text-navy-300 transition hover:bg-navy-800 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/*
          Scrollable so the links stay reachable on a short window, with the
          scrollbar tinted into the panel (see .pg-sidebar-scroll in index.css).
          pr-4 keeps the labels clear of the scrollbar.
        */}
        <nav
          className={clsx(
            'pg-sidebar-scroll flex-1 space-y-4 overflow-y-auto py-4',
            collapsed ? 'px-2' : 'pl-3 pr-4'
          )}
        >
          {grouped.map(({ group, items }) => (
            <div key={group}>
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-navy-800" aria-hidden="true" />
              ) : (
                <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-navy-500">
                  {group}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const badge = item.to === notificationsTo ? unreadCount : 0;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        // The label leaves the DOM when collapsed, so the
                        // accessible name and the hover tooltip come from here.
                        aria-label={collapsed ? item.label : undefined}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center rounded-control text-sm font-semibold transition',
                            collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
                            isActive
                              ? 'bg-primary-500 text-navy-950'
                              : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              className={clsx('h-4 w-4 shrink-0', isActive ? 'text-navy-950' : 'text-navy-400')}
                              aria-hidden="true"
                            />
                            {collapsed ? null : <span className="flex-1 truncate">{item.label}</span>}
                            {badge > 0 ? (
                              collapsed ? (
                                <span
                                  className={clsx(
                                    'absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-navy-900',
                                    isActive ? 'bg-navy-950' : 'bg-primary-500'
                                  )}
                                  aria-hidden="true"
                                />
                              ) : (
                                <span
                                  className={clsx(
                                    'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                                    isActive ? 'bg-navy-950 text-primary-300' : 'bg-primary-500 text-navy-950'
                                  )}
                                >
                                  {badge > 99 ? '99+' : badge}
                                </span>
                              )
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
      </aside>
    </>
  );
}
