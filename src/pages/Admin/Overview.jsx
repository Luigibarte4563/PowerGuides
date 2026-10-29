import {
  AlertTriangle,
  Bell,
  MapPin,
  Plug,
  RefreshCw,
  Users as UsersIcon,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useAdminStats } from '@/hooks/useAdmin';
import { useReference } from '@/context/ReferenceContext';
import { humanize, formatNumber } from '@/utils/formatters';
import { roleLabel } from '@/utils/roles';

/**
 * Module ADMIN - platform overview (`/admin`).
 *
 * One endpoint (`admin/stats.php`) feeds every figure: user counts, report totals
 * by status and severity, the 30-day report trend and the top barangays. The
 * endpoint is admin-only, and this page is only reachable behind `RequireRole
 * (['admin'])`, so no request here can answer 403 for the signed-in account.
 */
/* Chart chrome in workspace palette: muted slate ticks, navy panel gridlines. */
const AXIS_TICK = { fontSize: 11, fill: '#8B8FA8' };
const GRID_STROKE = '#31324C';

function shortDay(date) {
  const day = new Date(`${date}T00:00:00`);
  return Number.isNaN(day.getTime())
    ? date
    : day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Group rows carry raw role names; show the platform's labels for them. */
function roleRows(byRole, referenceRoles) {
  return byRole.map((row) => ({ ...row, label: roleLabel(row.label, referenceRoles) }));
}

export default function Overview() {
  const statsQuery = useAdminStats();
  const { roles: referenceRoles } = useReference();
  const stats = statsQuery.data;

  if (statsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Platform Overview"
          description="Every account, report and aggregate on the platform."
        />
        <LoadingState label="Loading platform statistics…" />
      </div>
    );
  }

  if (statsQuery.isError || !stats) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Platform Overview"
          description="Every account, report and aggregate on the platform."
        />
        <ErrorState
          message="The platform statistics could not be loaded."
          onRetry={() => statsQuery.refetch()}
        />
      </div>
    );
  }

  const users = stats.users;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Every account, report and aggregate on the platform. Operational work - verifying reports, maintenance, broadcasts - lives in the company app."
        actions={
          <button
            type="button"
            onClick={() => statsQuery.refetch()}
            className="inline-flex items-center gap-1.5 rounded-control border border-navy-200 px-3 py-2 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 dark:border-navy-600 dark:text-navy-100 dark:hover:bg-navy-700"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <section aria-labelledby="admin-accounts-heading">
        <h2 id="admin-accounts-heading" className="sr-only">
          Accounts
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Total users"
            value={formatNumber(users.total)}
            hint={`${formatNumber(users.newLast30Days)} joined in the last 30 days`}
            icon={UsersIcon}
            tone="primary"
          />
          <Card>
            <CardHeader title="Accounts by role" />
            <CardBody className="flex flex-wrap gap-2">
              {roleRows(users.byRole, referenceRoles).map((row) => (
                <Badge key={row.label} tone={row.label.includes('admin') ? 'danger' : 'navy'}>
                  {row.label}: {formatNumber(row.count)}
                </Badge>
              ))}
            </CardBody>
          </Card>
          <StatCard
            label="Notifications sent"
            value={formatNumber(stats.notifications.total)}
            icon={Bell}
            tone="info"
          />
        </div>
      </section>

      <section aria-labelledby="admin-reports-heading">
        <h2 id="admin-reports-heading" className="sr-only">
          Reports
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Outage reports"
            value={formatNumber(stats.outages.total)}
            hint={`${formatNumber(stats.outages.active)} currently active`}
            icon={Zap}
            tone="warning"
          />
          <StatCard
            label="Flood reports"
            value={formatNumber(stats.floods.total)}
            hint={`${formatNumber(stats.floods.unresolved)} not yet cleared`}
            icon={Waves}
            tone="info"
          />
          <StatCard
            label="Electrical hazards"
            value={formatNumber(stats.hazards.total)}
            hint={`${formatNumber(stats.hazards.unresolved)} unresolved`}
            icon={AlertTriangle}
            tone="danger"
          />
          <StatCard
            label="Maintenance schedules"
            value={formatNumber(stats.maintenance.total)}
            icon={Wrench}
            tone="navy"
          />
        </div>
      </section>

      <Card>
        <CardHeader
          title="Outage reports · last 30 days"
          description="New reports per day across Dagupan"
        />
        <CardBody>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stats.trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={shortDay} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} />
              <Tooltip
                labelFormatter={shortDay}
                formatter={(value) => [formatNumber(value), 'Reports']}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="Reports"
                stroke="#E0A802"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top barangays" description="Outage reports per barangay, all time" />
          <CardBody>
            {stats.topBarangays.length === 0 ? (
              <p className="text-sm text-navy-500">No outage reports yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={stats.topBarangays}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={120}
                    tick={AXIS_TICK}
                    tickLine={false}
                  />
                  <Tooltip formatter={(value) => [formatNumber(value), 'Reports']} />
                  <Bar dataKey="count" name="Reports" fill="#E0A802" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Report mix" description="How reports break down" />
          <CardBody className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-navy-800">Outages by status</h3>
              <ul className="mt-2 space-y-1.5">
                {stats.outages.byStatus.map((row) => (
                  <li key={row.label} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 text-navy-600">
                      <Zap className="h-3.5 w-3.5 text-navy-400" aria-hidden="true" />
                      {humanize(row.label)}
                    </span>
                    <span className="font-semibold text-navy-900">{formatNumber(row.count)}</span>
                  </li>
                ))}
                {stats.outages.byStatus.length === 0 ? (
                  <li className="text-sm text-navy-400">None yet.</li>
                ) : null}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-navy-800">Hazards by severity</h3>
              <ul className="mt-2 space-y-1.5">
                {stats.hazards.bySeverity.map((row) => (
                  <li key={row.label} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 text-navy-600">
                      <AlertTriangle className="h-3.5 w-3.5 text-navy-400" aria-hidden="true" />
                      {humanize(row.label)}
                    </span>
                    <span className="font-semibold text-navy-900">{formatNumber(row.count)}</span>
                  </li>
                ))}
                {stats.hazards.bySeverity.length === 0 ? (
                  <li className="text-sm text-navy-400">None yet.</li>
                ) : null}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-navy-800">Power stations</h3>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-navy-600">
                <Plug className="h-3.5 w-3.5 text-navy-400" aria-hidden="true" />
                {formatNumber(stats.powerStations.available)} of{' '}
                {formatNumber(stats.powerStations.total)} available
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-navy-600">
                <MapPin className="h-3.5 w-3.5 text-navy-400" aria-hidden="true" />
                {formatNumber(stats.outages.bySeverity.reduce((sum, row) => sum + row.count, 0))}{' '}
                reports carry a severity rating
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
