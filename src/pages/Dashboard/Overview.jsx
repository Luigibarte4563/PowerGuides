import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  MapPin,
  Plug,
  Plus,
  ShieldAlert,
  Timer,
  Waves,
  Zap,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { ErrorState, SkeletonList } from '@/components/ui/States';
import AppMap, { MapPin as MapPinMarker } from '@/components/Map';
import RecordCard from '@/components/RecordCard';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import {
  floodsApi,
  getNearbyRisks,
  hazardsApi,
  maintenanceApi,
  outagesApi,
  powerStationsApi,
  UPCOMING_STATUSES,
} from '@/api';
import { QUERY_KEYS, isOpenStatus, severityTone, statusTone } from '@/utils/constants';
import { readFlood, readHazard, readMaintenance, readOutage } from '@/utils/records';
import { formatDateTime, formatRelativeTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';

/**
 * Module A - dashboard overview.
 *
 * Summarises EVERY report type the app collects (outages, floods, hazards) plus
 * maintenance and power stations, and mixes all three report types into one
 * "latest reports" feed - previously the overview only listed the user's own
 * outages, so floods and hazards were invisible here.
 */

/** Where each report type lives, for the merged feed. */
const REPORT_KIND = {
  outage: { label: 'Outage', icon: Zap, tone: 'primary', page: '/dashboard/outages' },
  flood: { label: 'Flood', icon: Waves, tone: 'info', page: '/dashboard/floods' },
  hazard: { label: 'Hazard', icon: AlertTriangle, tone: 'danger', page: '/dashboard/hazards' },
};

const reportedAt = (value) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
};

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { coords, hasLocation } = useSavedLocation();
  const { unreadCount, isLoading: notificationsLoading } = useNotifications();

  const activeOutages = useQuery({
    queryKey: QUERY_KEYS.outages({ scope: 'active' }),
    queryFn: async ({ signal }) => (await outagesApi.getActive({}, { signal })).count,
    staleTime: 60 * 1000,
  });

  const myReports = useQuery({
    queryKey: QUERY_KEYS.outages({ scope: 'mine' }),
    queryFn: async ({ signal }) => (await outagesApi.getMyReports({}, { signal })).items,
    staleTime: 60 * 1000,
  });

  // Whole-city flood and hazard feeds. Each call also feeds the counters and the
  // merged report list below, so they are only made once and shared.
  const floodReports = useQuery({
    queryKey: QUERY_KEYS.floods({ scope: 'overview' }),
    queryFn: async ({ signal }) => (await floodsApi.list({}, { signal })).items,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const hazardReports = useQuery({
    queryKey: QUERY_KEYS.hazards({ scope: 'overview' }),
    queryFn: async ({ signal }) => (await hazardsApi.list({}, { signal })).items,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const availableStations = useQuery({
    queryKey: QUERY_KEYS.powerStations({ scope: 'available' }),
    queryFn: async ({ signal }) => (await powerStationsApi.getAvailable({}, { signal })).count,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const upcomingMaintenance = useQuery({
    queryKey: QUERY_KEYS.maintenance({ scope: 'upcoming' }),
    queryFn: async ({ signal }) =>
      (await maintenanceApi.list({}, { signal })).items
        .map((item) => readMaintenance(item))
        .filter((item) => UPCOMING_STATUSES.includes(String(item.status).toLowerCase())),
    staleTime: 5 * 60 * 1000,
  });

  const nearbyRisks = useQuery({
    queryKey: QUERY_KEYS.risks({ scope: 'overview', lat: coords?.lat, lng: coords?.lng, radius: 2000 }),
    queryFn: async ({ signal }) => {
      const result = await getNearbyRisks({ lat: coords.lat, lng: coords.lng, radius: 2000 }, { signal });
      return result;
    },
    enabled: Boolean(coords),
    staleTime: 60 * 1000,
  });

  const greeting = getGreeting();
  const riskItems = [
    ...(nearbyRisks.data?.floods || []).map((item) => ({ item: readFlood(item), kind: 'flood' })),
    ...(nearbyRisks.data?.hazards || []).map((item) => ({ item: readHazard(item), kind: 'hazard' })),
  ].slice(0, 5);

  const openFloods = countOpen(floodReports.data, readFlood);
  const openHazards = countOpen(hazardReports.data, readHazard);

  // Every report type in one feed, newest first.
  const latestReports = useMemo(() => {
    const rows = [
      ...(myReports.data || []).map((record) => ({ kind: 'outage', record: readOutage(record) })),
      ...(floodReports.data || []).map((record) => ({ kind: 'flood', record: readFlood(record) })),
      ...(hazardReports.data || []).map((record) => ({ kind: 'hazard', record: readHazard(record) })),
    ];
    return rows
      .filter((row) => row.record?.id != null)
      .sort((a, b) => reportedAt(b.record.createdAt) - reportedAt(a.record.createdAt));
  }, [myReports.data, floodReports.data, hazardReports.data]);

  // Outage details are 403 for other people's reports, so only link to one you own.
  const reportLink = (row) =>
    row.kind === 'outage' && String(row.record.ownerId) === String(user?.id)
      ? `/dashboard/outages/${row.record.id}`
      : REPORT_KIND[row.kind].page;

  // The feed merges three queries: show a skeleton until the first settles, and
  // surface an error only when nothing usable came back.
  const reportQueries = [myReports, floodReports, hazardReports];
  const reportsLoading = reportQueries.some((query) => query.isLoading);
  const reportsFailed = reportQueries.every((query) => query.isError);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'neighbour'}`}
        description="Here is what is happening around you right now."
        actions={
          <>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => navigate('/dashboard/outages?new=1')}
            >
              Report Outage
            </Button>
            <Button
              variant="outline"
              icon={Waves}
              onClick={() => navigate('/dashboard/floods?new=1')}
            >
              Report Flood
            </Button>
          </>
        }
      />

      {/* Summary cards - one per report type, so every module is represented. */}
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Active outages"
          value={activeOutages.data}
          isLoading={activeOutages.isLoading}
          icon={Zap}
          tone="danger"
          to="/dashboard/outages"
        />
        <SummaryCard
          label="Open flood reports"
          value={openFloods}
          isLoading={floodReports.isLoading}
          icon={Waves}
          tone="info"
          to="/dashboard/floods"
        />
        <SummaryCard
          label="Open hazards"
          value={openHazards}
          isLoading={hazardReports.isLoading}
          icon={AlertTriangle}
          tone="danger"
          to="/dashboard/hazards"
        />
        <SummaryCard
          label="Nearby risks"
          value={coords ? riskItems.length : null}
          isLoading={nearbyRisks.isLoading}
          icon={ShieldAlert}
          tone="navy"
          to="/dashboard/risk-areas"
        />
        <SummaryCard
          label="My reports"
          value={myReports.data?.length}
          isLoading={myReports.isLoading}
          icon={MapPin}
          tone="info"
          to="/dashboard/outages?tab=mine"
        />
        <SummaryCard
          label="Unread notifications"
          value={notificationsLoading ? null : unreadCount}
          isLoading={notificationsLoading}
          icon={Bell}
          tone="warning"
          to="/dashboard/notifications"
        />
        <SummaryCard
          label="Upcoming maintenance"
          value={upcomingMaintenance.data?.length}
          isLoading={upcomingMaintenance.isLoading}
          icon={CalendarClock}
          tone="primary"
          to="/dashboard/maintenance?filter=upcoming"
        />
        <SummaryCard
          label="Power stations available"
          value={availableStations.data}
          isLoading={availableStations.isLoading}
          icon={Plug}
          tone="success"
          to="/dashboard/power-stations"
        />
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            icon={Zap}
            label="Report Outage"
            description="Lights out on your street"
            onClick={() => navigate('/dashboard/outages?new=1')}
            tone="primary"
          />
          <QuickAction
            icon={Waves}
            label="Report Flood"
            description="Water rising near you"
            onClick={() => navigate('/dashboard/floods?new=1')}
            tone="info"
          />
          <QuickAction
            icon={AlertTriangle}
            label="Report Hazard"
            description="Downed wire or exposed cable"
            onClick={() => navigate('/dashboard/hazards?new=1')}
            tone="danger"
          />
          <QuickAction
            icon={Timer}
            label="Start Safety Timer"
            description="Time an appliance safely"
            onClick={() => navigate('/dashboard/safety-timers?new=1')}
            tone="success"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Nearby risks */}
        <Card>
          <CardHeader
            description={
              hasLocation
                ? 'Active floods and unresolved hazards near your saved location'
                : 'Set your location to see risks near you'
            }
            action={
              hasLocation ? (
                <Button to="/dashboard/risk-areas" variant="outline" size="sm">
                  View all
                </Button>
              ) : (
                <Button to="/dashboard/location" variant="outline" size="sm" icon={MapPin}>
                  Set location
                </Button>
              )
            }
          >
            Nearby risks
          </CardHeader>
          <CardBody className="space-y-4">
            {!hasLocation ? (
              <div className="rounded-card border border-dashed border-navy-200 bg-canvas p-6 text-center">
                <MapPin className="mx-auto h-6 w-6 text-navy-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-navy-800">No location saved yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-navy-500">
                  Save your location so PowerGuide can show floods, hazards and power stations around you.
                </p>
                <Button to="/dashboard/location" variant="primary" size="sm" className="mt-4">
                  Set my location
                </Button>
              </div>
            ) : nearbyRisks.isLoading ? (
              <SkeletonList rows={2} />
            ) : nearbyRisks.isError ? (
              <ErrorState
                compact
                message={toUserMessage(nearbyRisks.error)}
                onRetry={() => nearbyRisks.refetch()}
              />
            ) : riskItems.length === 0 ? (
              <div className="rounded-card border border-success-200 bg-success-50 p-6 text-center">
                <p className="text-sm font-bold text-success-700">All clear nearby</p>
                <p className="mt-1 text-xs text-navy-600">
                  No active floods or unresolved electrical hazards were reported within 2 km.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {riskItems.map(({ item, kind }) => (
                  <li key={`${kind}-${item.id}`}>
                    <RecordCard
                      icon={kind === 'flood' ? Waves : AlertTriangle}
                      iconTone={kind === 'flood' ? 'info' : 'danger'}
                      title={kind === 'flood' ? item.barangay || 'Flood report' : item.hazardType || 'Electrical hazard'}
                      subtitle={`Reported ${formatRelativeTime(item.createdAt)}`}
                      badges={[
                        item.severity ? { label: humanize(item.severity), tone: severityTone(item.severity) } : null,
                        item.status ? { label: humanize(item.status), tone: statusTone(item.status) } : null,
                      ]}
                      description={item.description}
                      to={kind === 'flood' ? '/dashboard/floods' : '/dashboard/hazards'}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Recent activity */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              description="Outages, floods and hazards from across Dagupan"
              action={
                <Button to="/dashboard/risk-areas" variant="outline" size="sm">
                  View all
                </Button>
              }
            >
              Latest reports
            </CardHeader>
            <CardBody className="space-y-3">
              {reportsLoading ? (
                <SkeletonList rows={2} />
              ) : reportsFailed ? (
                <ErrorState
                  compact
                  message={toUserMessage(
                    myReports.error || floodReports.error || hazardReports.error
                  )}
                  onRetry={() => {
                    myReports.refetch();
                    floodReports.refetch();
                    hazardReports.refetch();
                  }}
                />
              ) : latestReports.length === 0 ? (
                <p className="rounded-card border border-dashed border-navy-200 bg-canvas p-5 text-center text-sm text-navy-500">
                  No reports yet. Be the first to report an outage, flood or hazard.
                </p>
              ) : (
                <ul className="space-y-3">
                  {latestReports.slice(0, 6).map((row) => (
                    <li key={`${row.kind}-${row.record.id}`}>
                      <RecordCard
                        icon={REPORT_KIND[row.kind].icon}
                        iconTone={REPORT_KIND[row.kind].tone}
                        title={
                          row.record.locationName ||
                          row.record.barangay ||
                          row.record.hazardType ||
                          REPORT_KIND[row.kind].label
                        }
                        subtitle={`${formatRelativeTime(row.record.createdAt)} · ${row.record.barangay || 'Dagupan'}`}
                        badges={[
                          { label: REPORT_KIND[row.kind].label, tone: REPORT_KIND[row.kind].tone },
                          row.record.severity
                            ? { label: humanize(row.record.severity), tone: severityTone(row.record.severity) }
                            : null,
                          row.record.status
                            ? { label: humanize(row.record.status), tone: statusTone(row.record.status) }
                            : null,
                        ].filter(Boolean)}
                        description={row.record.description}
                        to={reportLink(row)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              action={
                <Button to="/dashboard/maintenance" variant="outline" size="sm">
                  View all
                </Button>
              }
            >
              Upcoming maintenance
            </CardHeader>
            <CardBody className="space-y-3">
              {upcomingMaintenance.isLoading ? (
                <SkeletonList rows={2} />
              ) : upcomingMaintenance.isError ? (
                <ErrorState
                  compact
                  message={toUserMessage(upcomingMaintenance.error)}
                  onRetry={() => upcomingMaintenance.refetch()}
                />
              ) : (upcomingMaintenance.data || []).length === 0 ? (
                <p className="rounded-card border border-dashed border-navy-200 bg-canvas p-5 text-center text-sm text-navy-500">
                  No scheduled maintenance announced yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {(upcomingMaintenance.data || []).slice(0, 4).map((maintenance) => (
                    <li key={maintenance.id}>
                      <RecordCard
                        icon={CalendarClock}
                        iconTone="info"
                        title={maintenance.title}
                        subtitle={`${formatDateTime(maintenance.startAt)}${
                          maintenance.barangay ? ` · ${maintenance.barangay}` : ''
                        }`}
                        badges={[
                          maintenance.status
                            ? { label: humanize(maintenance.status), tone: statusTone(maintenance.status) }
                            : null,
                        ]}
                        to="/dashboard/maintenance"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Mini map */}
      <Card>
        <CardHeader
          description={
            hasLocation
              ? 'Your saved location and nearby reported incidents'
              : 'Save your location to centre this map on you'
          }
          action={
            <Button to="/dashboard/heatmap" variant="outline" size="sm">
              Open heatmap
            </Button>
          }
        >
          Area map
        </CardHeader>
        <CardBody>
          <div className="h-72 w-full overflow-hidden rounded-card border border-navy-200">
            <AppMap center={coords || undefined} zoom={coords ? 14 : undefined} className="h-full w-full">
              {riskItems.map(({ item, kind }) =>
                Number.isFinite(item.lat) && Number.isFinite(item.lng) ? (
                  <MapPinMarker
                    key={`map-${kind}-${item.id}`}
                    position={{ lat: item.lat, lng: item.lng }}
                    tone={kind === 'flood' ? 'info' : 'danger'}
                  >
                    <p className="font-bold text-navy-900">
                      {kind === 'flood' ? item.barangay || 'Flood report' : item.hazardType || 'Hazard'}
                    </p>
                    {item.description ? <p className="mt-1 text-navy-600">{item.description}</p> : null}
                    <Badge
                      className="mt-2"
                      tone={item.severity ? severityTone(item.severity) : 'neutral'}
                      size="sm"
                    >
                      {humanize(item.severity, 'Severity n/a')}
                    </Badge>
                  </MapPinMarker>
                ) : null
              )}
            </AppMap>
          </div>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-navy-400">
        Need the full picture? Visit{' '}
        <Link to="/dashboard/risk-areas" className="font-semibold text-primary-600 hover:text-primary-700">
          risk areas
        </Link>{' '}
        or{' '}
        <Link to="/dashboard/power-stations" className="font-semibold text-primary-600 hover:text-primary-700">
          power stations
        </Link>
        .
      </p>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Count reports that are still open. Returns 0 on error/unavailable, and the
 * caller drives the loading state separately so the card shows a dash rather than
 * a misleading zero.
 */
function countOpen(rows, reader) {
  if (!Array.isArray(rows)) return 0;
  return rows.map(reader).filter((record) => isOpenStatus(record.status)).length;
}


function SummaryCard({ label, value, isLoading, icon, tone, to }) {
  return (
    <StatCard
      to={to}
      label={label}
      value={isLoading ? '—' : (value ?? 0)}
      icon={icon}
      tone={tone}
    />
  );
}

const QUICK_TONES = {
  primary: 'hover:border-primary-300 hover:bg-primary-50/60',
  info: 'hover:border-info-200 hover:bg-info-50/60',
  danger: 'hover:border-danger-200 hover:bg-danger-50/60',
  success: 'hover:border-success-200 hover:bg-success-50/60',
};

const QUICK_ICON_TONES = {
  primary: 'bg-primary-100 text-primary-700',
  info: 'bg-info-50 text-info-700',
  danger: 'bg-danger-50 text-danger-700',
  success: 'bg-success-50 text-success-700',
};

function QuickAction({ icon: Icon, label, description, onClick, tone = 'primary' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-card border border-navy-100 bg-white p-4 text-left shadow-card transition ${QUICK_TONES[tone]}`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-control ${QUICK_ICON_TONES[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-navy-900">{label}</span>
        <span className="block truncate text-xs text-navy-500">{description}</span>
      </span>
    </button>
  );
}
