import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZoomControl } from 'react-leaflet';
import { CalendarClock, CheckCircle2, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import AppMap, { FitPoints, MapCircle, MapLegend, MapPoints, PIN_COLORS } from '@/components/Map';
import MapWorkspace, { FeedActions, FeedToggle } from '@/components/MapWorkspace';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { maintenanceApi, UPCOMING_STATUSES } from '@/api';
import { COMPANY_PAGE_SIZE, COMPANY_QUERY_KEYS, statusTone } from '@/utils/constants';
import { readMaintenance } from '@/utils/records';
import { formatDate, formatDistance, formatTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import Pagination from '@/components/Pagination';
import MaintenanceFormModal from './components/MaintenanceFormModal';

/**
 * Module MNT - maintenance management.
 *
 * `get_upcoming.php` and `get_complete.php` are counts-only / status-filtered reads,
 * so the schedule list itself always comes from `get.php` and the tabs filter those
 * rows client-side.
 *
 * KNOWN GAP (already logged in the project README): `get.php` joins `roles` and keeps
 * only rows whose creator role is `electric_company`, so a schedule created by an
 * `admin` account is never returned - it is created successfully and then vanishes.
 * `created_by` is selected but not emitted, so ownership (which `delete.php` requires)
 * cannot be checked client-side either. The delete action is therefore offered and a
 * rejection from the server is reported plainly.
 */
export default function Maintenance() {
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('upcoming');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [mapStatus, setMapStatus] = useState('');

  const listQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.maintenance({ tab }),
    queryFn: async ({ signal }) => (await maintenanceApi.list({}, { signal })).items,
    retry: 1,
  });

  const upcomingQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.maintenance({ count: 'upcoming' }),
    queryFn: async ({ signal }) => (await maintenanceApi.getUpcoming({}, { signal })).count,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const completeQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.completedMaintenance,
    // Staff-only endpoint; a lineman gets 403, so the tab count just stays unknown.
    enabled: isManager,
    queryFn: async ({ signal }) => (await maintenanceApi.getComplete({}, { signal })).items,
    retry: 1,
  });

  const mapQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.maintenanceMap,
    queryFn: async ({ signal }) => (await maintenanceApi.getMapData({}, { signal })).items,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const all = useMemo(() => (listQuery.data || []).map(readMaintenance), [listQuery.data]);
  const completed = useMemo(
    () => (completeQuery.data || []).map(readMaintenance),
    [completeQuery.data]
  );

  const counts = useMemo(() => {
    const inList = (status) => all.filter((item) => String(item.status).toLowerCase() === status).length;
    return {
      upcoming: all.filter((item) => UPCOMING_STATUSES.includes(String(item.status).toLowerCase())).length,
      ongoing: inList('ongoing'),
      completed: completed.length || inList('completed'),
    };
  }, [all, completed]);

  const rows = useMemo(() => {
    if (tab === 'completed') {
      const source = completed.length ? completed : all.filter((item) => item.status === 'completed');
      return source;
    }
    if (tab === 'upcoming') {
      return all.filter((item) => String(item.status).toLowerCase() === 'upcoming');
    }
    return all.filter((item) => String(item.status).toLowerCase() === 'ongoing');
  }, [all, completed, tab]);

  const pageCount = Math.max(1, Math.ceil(rows.length / COMPANY_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * COMPANY_PAGE_SIZE, page * COMPANY_PAGE_SIZE);

  // Each schedule expands into one point per affected barangay so a multi-barangay
  // schedule is drawn in full rather than only at its first location.
  const mapPoints = useMemo(() => {
    const filtered = mapStatus
      ? (mapQuery.data || []).filter(
          (row) => String(readMaintenance(row).status).toLowerCase() === mapStatus
        )
      : mapQuery.data || [];
    return filtered.flatMap((row) => {
      const schedule = readMaintenance(row);
      // `located` only - a location without coordinates has no pin to draw, though it
      // still has a name and is listed in the Barangays column.
      return schedule.located.map((location, index) => ({
        ...location,
        id: `${schedule.id}-${index}`,
        title: schedule.title,
        status: schedule.status,
        radius: schedule.radius,
        date: schedule.date,
      }));
    });
  }, [mapQuery.data, mapStatus]);

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
  const hasRadius = (point) => Number(point.radius) > 0;
  const circlePoints = mapPoints.filter(hasRadius);
  const pinPoints = mapPoints.filter((point) => !hasRadius(point));

  const renderMapPopup = (point) => (
    <div className="min-w-[13rem]">
      <p className="font-bold text-navy-900">{point.title || 'Maintenance'}</p>
      <p className="mt-0.5 text-xs text-navy-500">
        {point.barangay} · {formatDate(point.date)}
      </p>
      {hasRadius(point) ? (
        <p className="mt-1 text-xs text-navy-600">
          Notify radius {formatDistance(point.radius)}
        </p>
      ) : null}
      <Badge tone={statusTone(point.status)} size="sm" className="mt-2">
        {humanize(point.status)}
      </Badge>
    </div>
  );

  const maintenanceMap = (
    <AppMap zoom={12} zoomControl={false} className="h-full w-full">
      <ZoomControl position="bottomright" />
      {/* Grown by the radius so a whole coverage circle sits inside the fitted view. */}
      <FitPoints items={mapPoints} radiusFor={(point) => point.radius} />

        {circlePoints.map((point) => (
          <MapCircle
            key={`circle-${point.id}`}
            center={point}
            radius={Number(point.radius)}
            color={PIN_COLORS[point.status === 'ongoing' ? 'warning' : 'primary']}
            fillOpacity={0.12}
          >
            {renderMapPopup(point)}
          </MapCircle>
        ))}

        {/* Fallback only: a location with no usable radius keeps its pin. */}
        {pinPoints.length ? (
          <MapPoints
            items={pinPoints}
            toneFor={(point) => (point.status === 'ongoing' ? 'warning' : 'primary')}
            glyphFor={() => 'M'}
          >
            {renderMapPopup}
          </MapPoints>
        ) : null}

        <MapLegend
          title="Status"
          items={[
            { label: 'Upcoming', tone: 'primary' },
            { label: 'Ongoing', tone: 'warning' },
          ]}
        />
      </AppMap>
    );

  const deleteMutation = useMutation({
    mutationFn: (id) => maintenanceApi.remove(id),
    onSuccess: () => {
      toast.success('The maintenance schedule was deleted.', { title: 'Deleted' });
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['company-maintenance'] });
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.summary });
    },
    onError: (error) => {
      toast.error(
        toUserMessage(
          error,
          'Only the staff member who created a schedule can delete it, and their role must be electric company or admin.'
        ),
        { title: 'Delete failed' }
      );
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div
      data-theme="dark"
      className="min-h-full bg-[#03041A] px-4 pb-8 pt-5 font-montserrat text-white lg:px-8 lg:pt-6"
    >
      <FeedActions
        actions={
          isManager ? (
            <Button
              variant="primary"
              icon={Plus}
              onClick={openCreate}
              className="rounded-xl px-5 shadow-[0_8px_24px_rgba(255,187,2,0.18)]"
            >
              Schedule maintenance
            </Button>
          ) : null
        }
      />

      <MapWorkspace
        map={maintenanceMap}
        mapLabel="Maintenance areas map"
        mapTitle="Maintenance Feed"
        mapSubtitle={`${mapPoints.length} affected area${mapPoints.length === 1 ? '' : 's'} plotted${
          mapQuery.dataUpdatedAt ? ` · updated ${formatTime(mapQuery.dataUpdatedAt)}` : ''
        }`}
        toggle={
          <FeedToggle
            ariaLabel="Maintenance status"
            value={tab}
            onChange={(value) => {
              setTab(value);
              setPage(1);
            }}
            options={[
              { value: 'upcoming', label: 'Upcoming', count: upcomingQuery.data ?? counts.upcoming },
              { value: 'ongoing', label: 'Ongoing', count: counts.ongoing },
              { value: 'completed', label: 'Completed', count: counts.completed },
            ]}
          />
        }
        stats={[
          { label: 'Upcoming', value: counts.upcoming, icon: CalendarClock, color: '#22D3EE' },
          { label: 'Ongoing', value: counts.ongoing, icon: Wrench, color: '#FFBB02' },
          { label: 'Completed', value: counts.completed, icon: CheckCircle2, color: '#34FB34' },
        ]}
        filters={
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Select
              aria-label="Filter map by status"
              options={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'ongoing', label: 'Ongoing' },
                { value: 'completed', label: 'Completed' },
              ]}
              placeholder="All statuses"
              value={mapStatus}
              onChange={(event) => setMapStatus(event.target.value)}
              className="h-9 py-0 text-xs"
            />
          </div>
        }
        plottedCount={mapPoints.length}
        mapEmpty={!mapQuery.isLoading && mapPoints.length === 0}
        mapEmptyLabel="No mapped maintenance areas yet"
      >
        <div className="space-y-3">
          <DataView
            isLoading={tab === 'completed' ? completeQuery.isLoading : listQuery.isLoading}
            error={tab === 'completed' ? completeQuery.isError : listQuery.isError}
            onRetry={() =>
              tab === 'completed' ? completeQuery.refetch() : listQuery.refetch()
            }
            loadingLabel="Loading maintenance schedules…"
            items={pageRows}
            empty={{
              icon: Wrench,
              title: emptyTitle(tab),
              description: emptyDescription(tab),
              action: isManager ? (
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  Schedule maintenance
                </Button>
              ) : null,
            }}
            renderCard={(item) => (
              <RecordCard
                icon={Wrench}
                iconTone={item.status === 'ongoing' ? 'warning' : 'primary'}
                title={item.title}
                subtitle={[item.barangay, formatDate(item.date)].filter(Boolean).join(' · ')}
                badges={[
                  { label: humanize(item.status), tone: statusTone(item.status) },
                  item.radius ? { label: formatDistance(item.radius), tone: 'neutral' } : null,
                ]}
                description={item.description}
                meta={[
                  { label: 'Window', value: `${formatTime(item.startAt)} – ${formatTime(item.endAt)}` },
                  item.company ? { label: 'Posted by', value: item.company } : null,
                ].filter(Boolean)}
                actions={
                  isManager ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Pencil}
                        onClick={() => {
                          setEditing(item);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        className="text-danger-600"
                        onClick={() => setDeleting(item)}
                      >
                        Delete
                      </Button>
                    </>
                  ) : null
                }
              />
            )}
          />

          <Pagination
            page={page}
            pageCount={pageCount}
            total={rows.length}
            pageSize={COMPANY_PAGE_SIZE}
            onChange={setPage}
          />
        </div>
      </MapWorkspace>

      {!isManager ? (
        <p className="mt-4 text-[10px] text-white/40">
          You can review published schedules, but planning them is limited to electric company and admin
          accounts.
        </p>
      ) : null}

      <MaintenanceFormModal
        open={formOpen}
        schedule={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this maintenance schedule?"
        description="The schedule and any notifications it sent are removed. This cannot be undone."
        confirmLabel="Delete schedule"
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

function emptyTitle(tab) {
  if (tab === 'completed') return 'No completed maintenance yet';
  if (tab === 'ongoing') return 'No maintenance is running right now';
  return 'No upcoming maintenance scheduled';
}

function emptyDescription(tab) {
  if (tab === 'completed') return 'Finished work will be listed here for the record.';
  if (tab === 'ongoing') return 'Schedules move here automatically while their window is open.';
  return 'Schedule a window and the affected residents are notified automatically.';
}
