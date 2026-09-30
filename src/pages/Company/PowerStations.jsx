import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crosshair, MapPin, Pencil, Plug, Plus, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table';
import { InfoNote } from '@/components/ui/Alert';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';
import AppMap, { FitPoints, MapLegend, MapPoints } from '@/components/Map';
import MapWorkspace from '@/components/MapWorkspace';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import { powerStationsApi } from '@/api';
import {
  COMPANY_PAGE_SIZE,
  COMPANY_QUERY_KEYS,
  DEFAULT_RADIUS_METERS,
  RADIUS_OPTIONS,
  availabilityTone,
} from '@/utils/constants';
import { readStation } from '@/utils/records';
import { formatDateTime, formatDistance, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import PowerStationFormModal from './components/PowerStationFormModal';

const TABS = [
  { value: 'all', label: 'All stations', icon: Plug },
  { value: 'near', label: 'Near my location', icon: Crosshair },
  { value: 'mine', label: 'My stations', icon: MapPin },
];

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
  { value: 'offline', label: 'Offline' },
  { value: 'maintenance', label: 'Under maintenance' },
];

/**
 * Module PWR - power stations (FR-PWR-1 .. FR-PWR-6).
 *
 * `power_station/*` has NO role check: any authenticated user can read the list, and
 * write access is scoped to the station's `created_by`. So on this page "My stations"
 * is the only set the current user can actually edit or delete, and the action column
 * reflects that rather than pretending otherwise.
 *
 * The API also allows ONE station per user - a second `create.php` call answers 403
 * "You already have a power station. Please update it instead." - so the create button
 * is hidden once the signed-in user already owns a station.
 *
 * FR-PWR-6 adds the "Near my location" tab on `get_near_location.php`. That endpoint only
 * takes a radius and centres the search on the account's saved primary location, which is
 * read from the resident side of the account - so a staff account without one gets a setup
 * message instead of an empty result.
 */
export default function PowerStations() {
  const { user } = useAuth();
  const { barangays } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('');
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METERS);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  const { coords: savedCoords, hasLocation } = useSavedLocation();

  const listQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.powerStations({ page: 1, limit: 100 }),
    queryFn: async ({ signal }) => (await powerStationsApi.list({ page: 1, limit: 100 }, { signal })).items,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const mineQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.myStations,
    queryFn: async ({ signal }) => (await powerStationsApi.getMyPosts({}, { signal })).items,
    staleTime: 60 * 1000,
    retry: 1,
  });

  /**
   * FR-PWR-6 - `power_station/get_near_location.php`.
   *
   * The endpoint takes only a `radius`: the centre is the account's saved primary
   * location, which the server reads itself, so there is no lat/lng to send and no
   * picker to offer. The query stays disabled until the tab is actually opened, so a
   * staff account with no saved location never makes the call.
   */
  const nearQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.powerStations({ scope: 'near', radius }),
    queryFn: async ({ signal }) =>
      (await powerStationsApi.getNearLocation({ radius }, { signal })).items,
    enabled: tab === 'near',
    staleTime: 60 * 1000,
    retry: 1,
  });

  const all = useMemo(() => (listQuery.data || []).map(readStation), [listQuery.data]);
  const mine = useMemo(() => (mineQuery.data || []).map(readStation), [mineQuery.data]);
  const near = useMemo(
    () => (nearQuery.data || []).map(readStation).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)),
    [nearQuery.data]
  );

  // The endpoint reports `has_location: false` instead of rows when no centre exists, so
  // the saved location is checked up front rather than after an empty result.
  const nearUnavailable = nearQuery.data?.hasLocation === false;

  const activeQuery = { all: listQuery, near: nearQuery, mine: mineQuery }[tab];

  const rows = useMemo(() => {
    const source = tab === 'near' ? near : tab === 'mine' ? mine : all;
    const term = debouncedSearch.trim().toLowerCase();

    return source.filter((station) => {
      if (availability && String(station.availability ?? '').toLowerCase() !== availability) {
        return false;
      }
      if (!term) return true;
      return [station.name, station.locationName, station.barangay, station.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [tab, all, mine, near, availability, debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil(rows.length / COMPANY_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * COMPANY_PAGE_SIZE, page * COMPANY_PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id) => powerStationsApi.remove(id),
    onSuccess: () => {
      toast.success('Power station removed.', { title: 'Deleted' });
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['company-power-stations'] });
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.summary });
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The power station could not be removed.'), {
        title: 'Delete failed',
      });
    },
  });

  const stationMap =
    all.length === 0 ? (
      <p className="h-full overflow-y-auto p-8 text-center text-sm text-navy-500">
        {listQuery.isLoading ? 'Loading power stations…' : 'No power stations have been registered yet.'}
      </p>
    ) : (
      <AppMap zoom={12} className="h-full w-full">
        <FitPoints items={all} />
        <MapPoints
          items={all}
          toneFor={(station) =>
            station.availability === 'available'
              ? 'success'
              : station.availability === 'busy'
                ? 'warning'
                : station.availability === 'offline'
                  ? 'danger'
                  : 'neutral'
          }
          glyphFor={() => 'P'}
        >
          {(station) => (
            <div className="min-w-[13rem]">
              <p className="font-bold text-navy-900">{station.name}</p>
              <p className="mt-0.5 text-xs text-navy-500">
                {[station.barangay, humanize(station.type, 'Power station')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <Badge tone={availabilityTone(station.availability)} size="sm" className="mt-2">
                {humanize(station.availability, 'Unknown')}
              </Badge>
            </div>
          )}
        </MapPoints>
        <MapLegend
          title="Availability"
          items={[
            { label: 'Available', tone: 'success' },
            { label: 'Busy', tone: 'warning' },
            { label: 'Offline', tone: 'danger' },
            { label: 'Maintenance', tone: 'neutral' },
          ]}
        />
      </AppMap>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Power Stations"
        description="Registered stations, their availability, and the ones this account owns."
        actions={
          mine.length === 0 ? (
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
              Add power station
            </Button>
          ) : null
        }
      />

      <Tabs
        tabs={TABS.map((item) => ({
          ...item,
          count:
            item.value === 'mine'
              ? mine.length
              : item.value === 'near'
                ? nearQuery.data
                  ? near.length
                  : undefined
                : all.length,
        }))}
        value={tab}
        onChange={(value) => {
          setTab(value);
          setPage(1);
        }}
        ariaLabel="Station scope"
      />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Search"
            placeholder="Name, address or barangay"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Availability"
            options={AVAILABILITY_OPTIONS}
            placeholder="Any availability"
            value={availability}
            onChange={(event) => {
              setAvailability(event.target.value);
              setPage(1);
            }}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setSearch('');
                setAvailability('');
                setPage(1);
              }}
              disabled={!search && !availability}
            >
              Clear filters
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* FR-PWR-6 - only meaningful for the near tab, and only that tab can change it. */}
      {tab === 'near' ? (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-navy-600">Search radius</span>
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setRadius(option.value);
                    setPage(1);
                  }}
                  aria-pressed={radius === option.value}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    radius === option.value
                      ? 'border-primary-400 bg-primary-100 text-primary-800'
                      : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <InfoNote>
              The API centres this search on your account&rsquo;s saved primary location, not on
              the map, so it has no point to pick. Results come back with a distance and are
              listed nearest first
              {savedCoords
                ? ` from ${savedCoords.lat.toFixed(4)}, ${savedCoords.lng.toFixed(4)}.`
                : '.'}
            </InfoNote>
          </CardBody>
        </Card>
      ) : null}

      <MapWorkspace
        map={stationMap}
        mapTitle="Station map"
        mapDescription={`${all.length} station${all.length === 1 ? '' : 's'} across Dagupan.`}
      >
        <DataView
          isLoading={activeQuery.isLoading}
          error={activeQuery.isError}
          onRetry={() => activeQuery.refetch()}
          loadingLabel="Loading power stations…"
          items={pageRows}
          empty={{
            icon: tab === 'near' ? Crosshair : Plug,
            title: emptyTitle(tab, hasLocation, nearUnavailable),
            description: emptyDescription(tab, hasLocation, nearUnavailable),
            action:
              tab === 'near' && !hasLocation ? (
                <Button variant="outline" to="/dashboard/location">
                  Set my saved location
                </Button>
              ) : tab === 'mine' && mine.length === 0 ? (
                <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
                  Add power station
                </Button>
              ) : tab !== 'near' && mine.length === 0 ? (
                <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
                  Add power station
                </Button>
              ) : null,
          }}
          renderCard={(station) => (
            <RecordCard
              icon={Plug}
              iconTone={availabilityTone(station.availability)}
              title={station.name}
              subtitle={[station.barangay, humanize(station.type, 'Power station')]
                .filter(Boolean)
                .join(' · ')}
              badges={[
                { label: humanize(station.availability, 'Unknown'), tone: availabilityTone(station.availability) },
                station.accessType ? { label: humanize(station.accessType), tone: 'neutral' } : null,
                station.createdBy === Number(user?.id) ? { label: 'Mine', tone: 'primary' } : null,
              ]}
              description={station.description}
              meta={[
                station.distance !== null && tab === 'near'
                  ? { label: 'Distance', value: formatDistance(station.distance) }
                  : null,
                station.operatingHours ? { label: 'Hours', value: station.operatingHours } : null,
                { label: 'Registered', value: formatDateTime(station.createdAt) },
              ].filter(Boolean)}
              actions={stationActions(station, user, setEditing, setFormOpen, setDeleting)}
            />
          )}
          renderTable={(visible) => (
            <div className="rounded-card border border-navy-100 bg-white shadow-card">
              <Table>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Barangay</TH>
                    <TH>Type</TH>
                    <TH>Access</TH>
                    <TH>Availability</TH>
                    {tab === 'near' ? <TH>Distance</TH> : null}
                    <TH>Registered</TH>
                    <TH align="right">Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {visible.map((station) => (
                    <TR key={station.id}>
                      <TD>
                        <span className="font-semibold text-navy-900">{station.name}</span>
                        {station.locationName ? (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-navy-500">
                            {station.locationName}
                          </p>
                        ) : null}
                      </TD>
                      <TD className="text-sm">{station.barangay || '—'}</TD>
                      <TD className="text-sm">{humanize(station.type, '—')}</TD>
                      <TD className="text-sm">{humanize(station.accessType, '—')}</TD>
                      <TD>
                        <Badge tone={availabilityTone(station.availability)}>
                          {humanize(station.availability, 'Unknown')}
                        </Badge>
                      </TD>
                      {tab === 'near' ? (
                        <TD className="whitespace-nowrap text-sm font-semibold text-navy-700">
                          {station.distance === null ? '—' : formatDistance(station.distance)}
                        </TD>
                      ) : null}
                      <TD className="whitespace-nowrap text-xs text-navy-500">
                        {formatDateTime(station.createdAt)}
                      </TD>
                      <TD align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          {station.createdBy === Number(user?.id) ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={Pencil}
                                onClick={() => {
                                  setEditing(station);
                                  setFormOpen(true);
                                }}
                                aria-label={`Edit ${station.name}`}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={Trash2}
                                className="text-danger-600"
                                onClick={() => setDeleting(station)}
                                aria-label={`Delete ${station.name}`}
                              >
                                Delete
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-navy-300">Other account</span>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={page}
                pageCount={pageCount}
                total={rows.length}
                pageSize={COMPANY_PAGE_SIZE}
                onChange={setPage}
              />
            </div>
          )}
        />
      </MapWorkspace>

      <p className="text-xs text-navy-400">
        The API allows one station per account, and only the account that created a station can
        edit or delete it. The near tab searches around your saved location, which lives on your
        resident account rather than on this dashboard.
        {all.length ? ` Showing ${all.length} registered station${all.length === 1 ? '' : 's'}.` : ''}
      </p>

      <PowerStationFormModal
        open={formOpen}
        station={editing}
        barangays={barangays}
        invalidateKeys={['company-power-stations', COMPANY_QUERY_KEYS.summary]}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this power station?"
        description="It is removed from the map and the community list. This cannot be undone."
        confirmLabel="Delete station"
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

/**
 * FR-PWR-6 empty states. The near tab has two distinct "nothing here" cases and they are
 * not interchangeable: no saved location is a setup problem with a way out, while an empty
 * result inside a real radius is simply an honest answer.
 */
function emptyTitle(tab, hasLocation, nearUnavailable) {
  if (tab === 'mine') return 'You have not registered a station';
  if (tab === 'near') {
    if (!hasLocation || nearUnavailable) return 'This account has no saved location';
    return 'No stations in range';
  }
  return 'No power stations found';
}

function emptyDescription(tab, hasLocation, nearUnavailable) {
  if (tab === 'mine') {
    return 'You can register one station on this account, then keep its availability up to date.';
  }
  if (tab === 'near') {
    if (!hasLocation || nearUnavailable) {
      return 'The API centres this search on your account’s saved primary location, and this account has not set one. Add it once and the near tab works from then on.';
    }
    return 'Nothing is registered within this radius of your saved location. Widen the radius or clear the availability filter.';
  }
  return 'Try clearing the filters, or register the first station.';
}

/** Edit/delete only for the owning account - the API enforces the same rule. */
function stationActions(station, user, setEditing, setFormOpen, setDeleting) {
  if (station.createdBy !== Number(user?.id)) {
    return <span className="text-xs text-navy-400">Managed by another account</span>;
  }
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        icon={Pencil}
        onClick={() => {
          setEditing(station);
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
        onClick={() => setDeleting(station)}
      >
        Delete
      </Button>
    </>
  );
}
