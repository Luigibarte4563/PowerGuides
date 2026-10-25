import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ZoomControl } from 'react-leaflet';
import { CalendarClock, CheckCircle2, Info, Wrench } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import AppMap, { FitPoints, MapCircle, MapLegend, MapPoints, PIN_COLORS } from '@/components/Map';
import MapWorkspace, { FeedActions, FeedToggle } from '@/components/MapWorkspace';
import { maintenanceApi, UPCOMING_STATUSES } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readMaintenance } from '@/utils/records';
import { statusTone } from '@/utils/constants';
import { formatDateTime, formatDistance, formatTime, humanize } from '@/utils/formatters';
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
  // `located` only - nameless/unlocated areas have no pin, so they are not plotted.
  const mapPoints = mapItems.flatMap((item) =>
    item.located.map((location) => ({
      id: `${item.id}-${location.barangay}-${location.lat}-${location.lng}`,
      lat: location.lat,
      lng: location.lng,
      label: location.barangay,
      schedule: item,
    }))
  );

  /**
   * Coverage is a CIRCLE per affected barangay, not a pin.
   *
   * `maintenance_schedules.radius` belongs to the schedule, and one schedule can cover
   * several barangays - so it has to be drawn at every one of them. This used to
   * render a single `RadiusCircle` at `mapPoints[0]`, which put one circle on whichever
   * barangay happened to sort first and left every other affected area as a bare pin.
   *
   * `radius` is a nullable column, so a location without one falls back to the pin
   * rather than disappearing from the map entirely.
   */
  const hasRadius = (point) => Number(point.schedule?.radius) > 0;
  const circlePoints = mapPoints.filter(hasRadius);
  const pinPoints = mapPoints.filter((point) => !hasRadius(point));

  const renderMapPopup = (point) => (
    <div className="min-w-[12rem]">
      <p className="font-bold text-navy-900">{point.schedule.title}</p>
      <p className="text-xs text-navy-500">{point.label}</p>
      <p className="mt-1 text-xs text-navy-600">{formatDateTime(point.schedule.startAt)}</p>
      {hasRadius(point) ? (
        <p className="mt-1 text-xs text-navy-600">
          Notify radius {formatDistance(point.schedule.radius)}
        </p>
      ) : null}
      {point.schedule.status ? (
        <Badge tone={statusTone(point.schedule.status)} size="sm" className="mt-2">
          {humanize(point.schedule.status)}
        </Badge>
      ) : null}
    </div>
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(all.map((item) => item.status).filter(Boolean))).map((status) => ({ id: status, name: humanize(status) })),
    [all]
  );

  const mapSummary = mapQuery.isLoading
    ? 'Loading affected areas…'
    : `${mapPoints.length} affected area${mapPoints.length === 1 ? '' : 's'} plotted`;

  // Feed stat tiles, counted the same way the tabs filter.
  const upcomingCount = all.filter((item) =>
    UPCOMING_STATUSES.includes(String(item.status).toLowerCase())
  ).length;
  const ongoingCount = all.filter((item) => String(item.status).toLowerCase() === 'ongoing').length;
  const completedCount = all.filter((item) => String(item.status).toLowerCase() === 'completed').length;

  const maintenanceMap =
    mapQuery.isError ? (
      <p className="h-full p-6 text-sm font-medium text-danger-700">{toUserMessage(mapQuery.error)}</p>
    ) : (
      <AppMap zoomControl={false} className="h-full w-full">
        <ZoomControl position="bottomright" />
        {/* Grown by the radius so a whole coverage circle sits inside the fitted view. */}
        <FitPoints items={mapPoints} radiusFor={(point) => point.schedule?.radius} />

        {circlePoints.map((point) => (
          <MapCircle
            key={point.id}
            center={point}
            radius={Number(point.schedule.radius)}
            color={PIN_COLORS[statusTone(point.schedule.status)]}
            fillOpacity={0.12}
          >
            {renderMapPopup(point)}
          </MapCircle>
        ))}

        {/* Fallback only: a location with no usable radius keeps its pin. */}
        {pinPoints.length ? (
          <MapPoints items={pinPoints} toneFor={(point) => statusTone(point.schedule.status)}>
            {renderMapPopup}
          </MapPoints>
        ) : null}

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
    <div
      data-theme="dark"
      className="min-h-full bg-[#03041A] px-4 pb-8 pt-5 font-montserrat text-white lg:px-8 lg:pt-6"
    >
      <FeedActions
        search={search}
        onSearchChange={setSearch}
        onClearSearch={() => setSearch('')}
        searchId="maintenance-search"
        searchLabel="Search maintenance schedules"
        searchPlaceholder="Search schedules, areas, company…"
      />

      <MapWorkspace
        map={maintenanceMap}
        mapLabel="Maintenance areas map"
        mapTitle="Maintenance Feed"
        mapSubtitle={`${mapSummary}${mapQuery.dataUpdatedAt ? ` · updated ${formatTime(mapQuery.dataUpdatedAt)}` : ''}`}
        toggle={
          <FeedToggle
            ariaLabel="Maintenance scope"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'upcoming', label: 'Upcoming', count: upcomingCountQuery.data ?? upcomingCount },
              { value: 'all', label: 'All schedules', count: all.length },
            ]}
          />
        }
        stats={[
          { label: 'Upcoming', value: upcomingCount, icon: CalendarClock, color: '#22D3EE' },
          { label: 'Ongoing', value: ongoingCount, icon: Wrench, color: '#FFBB02' },
          { label: 'Completed', value: completedCount, icon: CheckCircle2, color: '#34FB34' },
        ]}
        filters={
          statusOptions.length ? (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Select
                aria-label="Filter by status"
                placeholder="All statuses"
                options={statusOptions}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-9 py-0 text-xs"
              />
            </div>
          ) : null
        }
        plottedCount={mapQuery.isError ? undefined : mapPoints.length}
        mapEmpty={!mapQuery.isLoading && !mapQuery.isError && mapPoints.length === 0}
        mapEmptyLabel="No mapped maintenance areas yet"
      >
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
        />
      </MapWorkspace>

      <p className="mt-4 flex items-start gap-2 text-[10px] text-white/40">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        Maintenance records are published by the utility company. Creating or editing schedules is not
        available to community users.
      </p>
    </div>
  );
}
