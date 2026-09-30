import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Info, Wrench } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import AppMap, { FitPoints, MapLegend, MapPoints, RadiusCircle } from '@/components/Map';
import MapWorkspace from '@/components/MapWorkspace';
import { maintenanceApi, UPCOMING_STATUSES } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readMaintenance } from '@/utils/records';
import { statusTone } from '@/utils/constants';
import { formatDateTime, formatDistance, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';

/**
 * Module C - maintenance schedules. Read only for normal users.
 *
 * `maintenance/get_upcoming.php` returns only a count, so the Upcoming tab filters
 * `maintenance/get.php` by the same statuses the server counts ('upcoming','ongoing').
 * Each row carries a `locations` array and a `radius` in metres.
 */
export default function Maintenance() {
  const [tab, setTab] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const listQuery = useQuery({
    queryKey: QUERY_KEYS.maintenance({ scope: 'all' }),
    queryFn: async ({ signal }) => (await maintenanceApi.list({}, { signal })).items,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const upcomingCountQuery = useQuery({
    queryKey: QUERY_KEYS.maintenance({ scope: 'upcoming-count' }),
    queryFn: async ({ signal }) => (await maintenanceApi.getUpcoming({}, { signal })).count,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const mapQuery = useQuery({
    queryKey: QUERY_KEYS.maintenanceMap,
    queryFn: async ({ signal }) => (await maintenanceApi.getMapData({}, { signal })).items,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const all = useMemo(() => (listQuery.data || []).map(readMaintenance), [listQuery.data]);

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((item) => {
        if (tab === 'upcoming' && !UPCOMING_STATUSES.includes(String(item.status).toLowerCase())) return false;
        if (statusFilter && item.status !== statusFilter) return false;
        if (!term) return true;
        return [item.title, item.barangay, item.description, item.company]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => new Date(a.startAt || 0) - new Date(b.startAt || 0));
  }, [all, tab, statusFilter, search]);

  const mapItems = useMemo(() => (mapQuery.data || []).map(readMaintenance), [mapQuery.data]);
  const mapPoints = mapItems.flatMap((item) =>
    item.locations.map((location) => ({
      id: `${item.id}-${location.barangay}-${location.lat}-${location.lng}`,
      lat: location.lat,
      lng: location.lng,
      label: location.barangay,
      schedule: item,
    }))
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(all.map((item) => item.status).filter(Boolean))).map((status) => ({ id: status, name: humanize(status) })),
    [all]
  );

  const mapSummary = mapQuery.isLoading
    ? 'Loading affected areas…'
    : `${mapPoints.length} affected area${mapPoints.length === 1 ? '' : 's'} plotted`;

  const maintenanceMap =
    mapQuery.isError ? (
      <p className="h-full p-6 text-sm font-medium text-danger-700">{toUserMessage(mapQuery.error)}</p>
    ) : mapPoints.length === 0 ? (
      <p className="h-full overflow-y-auto p-6 text-center text-sm text-navy-500">
        No maintenance areas with coordinates to plot yet.
      </p>
    ) : (
      <AppMap className="h-full w-full">
        <FitPoints items={mapPoints} />
        <RadiusCircle center={mapPoints[0]} radius={mapPoints[0]?.schedule?.radius} />
        <MapPoints items={mapPoints} toneFor={(item) => statusTone(item.schedule.status)}>
          {(item) => (
            <div className="min-w-[12rem]">
              <p className="font-bold text-navy-900">{item.schedule.title}</p>
              <p className="text-xs text-navy-500">{item.label}</p>
              <p className="mt-1 text-xs text-navy-600">{formatDateTime(item.schedule.startAt)}</p>
              {item.schedule.status ? (
                <Badge tone={statusTone(item.schedule.status)} size="sm" className="mt-2">
                  {humanize(item.schedule.status)}
                </Badge>
              ) : null}
            </div>
          )}
        </MapPoints>
        <MapLegend
          title="Status"
          items={[
            { label: 'Upcoming / scheduled', tone: 'info' },
            { label: 'Ongoing', tone: 'warning' },
            { label: 'Completed', tone: 'success' },
          ]}
        />
      </AppMap>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Schedules"
        description="Planned maintenance and outage windows published by the utility. Read only."
      />

      <Tabs
        tabs={[
          { value: 'upcoming', label: 'Upcoming', icon: CalendarClock, count: upcomingCountQuery.data },
          { value: 'all', label: 'All schedules', icon: Wrench, count: all.length },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="Maintenance filters"
      />

      <MapWorkspace
        map={mapPoints.length || mapQuery.isError || mapQuery.isLoading ? maintenanceMap : null}
        mapTitle="Maintenance areas"
        mapDescription={mapSummary}
        mapAction={
          <Button variant="outline" size="sm" onClick={() => mapQuery.refetch()} loading={mapQuery.isLoading}>
            Refresh
          </Button>
        }
      >
          <Card>
            <CardBody className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Search"
                placeholder="Search schedules"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                label="Status"
                placeholder="All statuses"
                options={statusOptions}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              />
              <div className="flex items-end">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('');
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </CardBody>
          </Card>

          <DataView
            isLoading={listQuery.isLoading}
            error={listQuery.isError}
            errorMessage={toUserMessage(listQuery.error)}
            onRetry={() => listQuery.refetch()}
            loadingLabel="Loading maintenance schedules…"
            items={items}
            empty={{
              icon: Wrench,
              title: tab === 'upcoming' ? 'No upcoming maintenance' : 'No maintenance schedules',
              description:
                tab === 'upcoming'
                  ? 'Nothing is scheduled at the moment. Check back later.'
                  : 'Maintenance schedules published by the utility will appear here.',
            }}
            renderCard={(item) => (
              <RecordCard
                icon={Wrench}
                iconTone="info"
                title={item.title}
                subtitle={`${formatDateTime(item.startAt)}${item.endAt ? ` → ${formatDateTime(item.endAt)}` : ''}`}
                badges={[
                  item.status ? { label: humanize(item.status), tone: statusTone(item.status) } : null,
                  item.company ? { label: item.company, tone: 'neutral' } : null,
                ]}
                description={item.description}
                meta={[
                  item.barangay ? { label: 'Areas', value: item.barangay } : null,
                  Number.isFinite(item.radius) ? { label: 'Radius', value: formatDistance(item.radius) } : null,
                ].filter(Boolean)}
              />
            )}
            renderTable={(rows) => (
              <div className="rounded-card border border-navy-100 bg-white shadow-card">
                <Table>
                  <THead>
                    <tr>
                      <TH>Schedule</TH>
                      <TH>Areas</TH>
                      <TH>Window</TH>
                      <TH>Radius</TH>
                      <TH>Status</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {rows.map((item) => (
                      <TR key={item.id}>
                        <TD>
                          <p className="font-semibold text-navy-900">{item.title}</p>
                          <p className="mt-0.5 max-w-sm truncate text-xs text-navy-500">{item.description}</p>
                        </TD>
                        <TD className="max-w-[14rem] text-xs">{item.barangay || '—'}</TD>
                        <TD className="whitespace-nowrap text-xs">
                          {formatDateTime(item.startAt)}
                          {item.endAt ? (
                            <span className="block text-navy-500">to {formatDateTime(item.endAt)}</span>
                          ) : null}
                        </TD>
                        <TD className="whitespace-nowrap text-xs">
                          {Number.isFinite(item.radius) ? formatDistance(item.radius) : '—'}
                        </TD>
                        <TD>
                          {item.status ? (
                            <Badge tone={statusTone(item.status)}>{humanize(item.status)}</Badge>
                          ) : (
                            '—'
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          />
          <p className="flex items-start gap-2 text-xs text-navy-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Maintenance records are published by the utility company. Creating or editing schedules is not
            available to community users.
          </p>
        </MapWorkspace>
    </div>
  );
}
