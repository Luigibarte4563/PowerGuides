import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Mail, MapPin, ShieldCheck, User } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { AuthAlert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDateTime, humanize } from '@/utils/formatters';
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

/** Module M - profile: account information from `me.php` and logout. */
export default function Profile() {
  const { user, logout } = useAuth();
  const { location } = useSavedLocation();
  const { notifications, unreadCount } = useNotifications();
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

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account details and session." />

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-navy-900 text-2xl font-extrabold text-primary-300">
              {initials(user?.name)}
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-navy-900">{user?.name || 'Community member'}</h2>
              <p className="mt-1 text-sm text-navy-500">{user?.email}</p>
            </div>
            <Badge tone="primary" icon={ShieldCheck}>
              {humanize(user?.role, 'Community user')}
            </Badge>
            <div className="w-full space-y-2 border-t border-navy-100 pt-4 text-left">
              <Row icon={Mail} label="Email" value={user?.email || '—'} />
              <Row icon={User} label="User ID" value={user?.id ?? '—'} />
              <Row icon={MapPin} label="Saved location" value={location ? 'Configured' : 'Not set yet'} />
              <Row icon={ShieldCheck} label="Member since" value={formatDateTime(user?.createdAt)} />
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader description="A quick look at your activity on PowerGuide Dagupan.">
              Your activity
            </CardHeader>
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Stat label="Notifications" value={notifications.length} />
              <Stat label="Unread" value={unreadCount} />
              <Stat label="Location" value={location ? 'Set' : 'Not set'} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader description="Your session is restored automatically on every visit using me.php.">
              Session
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-navy-600">
                Signing out clears your session on this device and returns you to the landing page. Your reports
                and devices stay on your account.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="danger" icon={LogOut} loading={loggingOut} onClick={handleLogout}>
                  Log out
                </Button>
                <Button variant="outline" to="/dashboard/location">
                  Update my location
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Account data</CardHeader>
            <CardBody>
              <p className="text-sm text-navy-600">
                This build is the normal-user app. Account and role management are handled elsewhere, so profile
                details are read-only here.
              </p>
              {/* TODO(API-CONFIRM): once the exact `me.php` fields are confirmed, extra columns can be shown here without changing the API layer. */}
              <p className="mt-3 text-xs text-navy-400">
                Profile details come straight from <code className="font-mono">GET /api/auth/me.php</code>.
              </p>
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

function Stat({ label, value }) {
  return (
    <div className="rounded-card border border-navy-100 bg-canvas p-4">
      <p className="text-sm text-navy-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-navy-900">{value}</p>
    </div>
  );
}
