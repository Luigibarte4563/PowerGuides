import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LayoutDashboard, LogOut, Mail, ShieldCheck, User } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { AuthAlert, InfoNote } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useCompanySummary } from '@/hooks/useCompanyOutages';
import { formatDateTime } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import { MANAGER_ROLES, hasRole, roleLabel } from '@/utils/roles';

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
 * Company profile.
 *
 * Reads the same `me.php` payload as the resident profile; the difference is that the
 * role and its capabilities are shown explicitly, because they decide which buttons
 * exist across this app. The endpoint exposes no way to change a role, so the details
 * are read-only here and access is granted by a system administrator.
 */
export default function Profile() {
  const { user, logout, role } = useAuth();
  const { roles } = useReference();
  const { notifications, unreadCount } = useNotifications();
  const { summary } = useCompanySummary();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setError('');
    setLoggingOut(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (logoutError) {
      setError(toUserMessage(logoutError, 'We could not sign you out. Please try again.'));
      setLoggingOut(false);
    }
  };

  const isManager = hasRole(role, MANAGER_ROLES);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your staff account, the role it carries, and your session."
      />

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-navy-900 text-2xl font-extrabold text-primary-300">
              {initials(user?.name)}
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-navy-900">{user?.name || 'Staff member'}</h2>
              <p className="mt-1 text-sm text-navy-500">{user?.email}</p>
            </div>
            <Badge tone="primary" icon={ShieldCheck}>
              {roleLabel(role, roles)}
            </Badge>

            <div className="w-full space-y-2 border-t border-navy-100 pt-4 text-left">
              <Row icon={Mail} label="Email" value={user?.email || '—'} />
              <Row icon={User} label="User ID" value={user?.id ?? '—'} />
              <Row icon={ShieldCheck} label="Role ID" value={user?.roleId ?? '—'} />
              <Row icon={ShieldCheck} label="Member since" value={formatDateTime(user?.createdAt)} />
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader description="What this role is allowed to do across the dashboard.">
              Your access
            </CardHeader>
            <CardBody className="space-y-3">
              <Capability
                allowed
                label="Review, verify and add field updates to outage reports"
                detail="outage_report_electric_com/*, outage/verify, outage/add_update"
              />
              <Capability
                allowed
                label="Resolve electrical hazards"
                detail="electrical_hazard/update_status"
              />
              <Capability
                allowed
                label="Use the map, risk lookup and cluster tools"
                detail="heatmap, cluster, risk - open to any signed-in account"
              />
              <Capability
                allowed={isManager}
                label="Change report status for a whole barangay or all of Dagupan"
                detail="outage_report_electric_com/update_barangay, update_dagupan"
              />
              <Capability
                allowed={isManager}
                label="Create, edit and delete maintenance schedules"
                detail="maintenance/create, update, delete"
              />
              <Capability
                allowed={isManager}
                label="Send notifications to residents"
                detail="notification/create"
              />
              <InfoNote>
                These flags mirror the server&rsquo;s own allow-lists. The API re-checks every
                permission, so a hidden button is a courtesy - not the security boundary.
              </InfoNote>
            </CardBody>
          </Card>

          <Card>
            <CardHeader description="Your inbox and the current operational load.">
              At a glance
            </CardHeader>
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Notifications"
                value={notifications.length}
                icon={Bell}
                action={
                  <Button size="sm" variant="ghost" to="/company/notifications">
                    Open
                  </Button>
                }
              />
              <Stat label="Unread" value={unreadCount} icon={Bell} />
              <Stat
                label="Active outages"
                value={summary?.activeOutages?.count ?? '—'}
                icon={LayoutDashboard}
                action={
                  <Button size="sm" variant="ghost" to="/company/outages">
                    Review
                  </Button>
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Session</CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-navy-600">
                Signing out clears the session cookie on this device and returns you to the landing
                page. Your reports, verifications and schedules stay on your account.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="danger" icon={LogOut} loading={loggingOut} onClick={handleLogout}>
                  Log out
                </Button>
                <Button variant="outline" to="/dashboard">
                  Open the resident app
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-navy-500">
        <Icon className="h-4 w-4 text-navy-400" aria-hidden="true" />
        {label}
      </span>
      <span className="truncate text-sm font-semibold text-navy-800">{value}</span>
    </div>
  );
}

function Stat({ label, value, icon: Icon, action }) {
  return (
    <div className="rounded-card border border-navy-100 bg-canvas p-4">
      <p className="flex items-center gap-1.5 text-sm text-navy-500">
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold text-navy-900">{value}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/**
 * One capability line. Colour is never the only signal (NFR-6): a denied row states
 * "Not available for your role" in words, and a check/minus icon carries the same
 * meaning for anyone who cannot distinguish the tones.
 */
function Capability({ allowed, label, detail }) {
  return (
    <div className="flex items-start gap-3">
      {allowed ? (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
      ) : (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy-300" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy-800">
          {label}
          <span className={allowed ? 'sr-only' : 'ml-2 text-xs font-semibold text-navy-500'}>
            {allowed ? '' : 'Not available for your role'}
          </span>
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-navy-400">{detail}</p>
      </div>
    </div>
  );
}
