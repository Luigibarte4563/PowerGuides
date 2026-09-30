import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crosshair, Pencil, Plug, Plus, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import AppMap, { FitPoints, MapLegend, MapPoints, RadiusCircle } from '@/components/Map';
import MapWorkspace from '@/components/MapWorkspace';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import { powerStationsApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readStation } from '@/utils/records';
import { DEFAULT_RADIUS_METERS, RADIUS_OPTIONS, availabilityTone } from '@/utils/constants';
import { formatDateTime, formatDistance, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import PowerStationFormModal, { STATION_TYPES } from './components/PowerStationFormModal';

const TABS = [
  { value: 'all', label: 'All stations', icon: Plug },
  { value: 'available', label: 'Available', icon: Crosshair },
  { value: 'near', label: 'Near my location', icon: Crosshair },
  { value: 'mine', label: 'My post', icon: Plug },
];

/**
 * Module D - power stations.
 *
 * `power_station/get_near_location.php` takes only `radius` (the centre is the
 * user's saved primary location) and `get_available.php` returns a count only, so
 * the Available tab filters the full list client-side and shows the server count.
 * The API allows ONE station per user, so the primary action switches to Edit once
 * a post exists.
 */
export default function PowerStations() {
  const { user } = useAuth();
  const { barangays } = useReference();
  const { coords, hasLocation } = useSavedLocation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  const allQuery = useQuery({
    queryKey: QUERY_KEYS.powerStations({ scope: 'all' }),
    queryFn: async ({ signal }) => (await powerStationsApi.list({ limit: 100 }, { signal })).items,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const availableCountQuery = useQuery({
    queryKey: QUERY_KEYS.powerStations({ scope: 'available-count' }),
    queryFn: async ({ signal }) => (await powerStationsApi.getAvailable({}, { signal })).count,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const mineQuery = useQuery({
    queryKey: QUERY_KEYS.powerStations({ scope: 'mine' }),
    queryFn: async ({ signal }) => (await powerStationsApi.getMyPosts({}, { signal })).items,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const nearQuery = useQuery({
    queryKey: QUERY_KEYS.powerStations({ scope: 'near', radius }),
    queryFn: async ({ signal }) =>
      (await powerStationsApi.getNearLocation({ radius }, { signal })).items,
    enabled: tab === 'near' && hasLocation,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const myStation = (mineQuery.data || []).map(readStation)[0] || null;

  const activeQuery = { all: allQuery, available: allQuery, near: nearQuery, mine: mineQuery }[tab];

  const items = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return (activeQuery.data || [])
      .map(readStation)
      .filter((station) => {
        if (tab === 'available' && station.availability !== 'available') return false;
        if (typeFilter && station.type !== typeFilter) return false;
        if (availabilityFilter && station.availability !== availabilityFilter) return false;
        if (!term) return true;
        return [station.name, station.locationName, station.barangay, station.type, station.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [activeQuery.data, tab, typeFilter, availabilityFilter, debouncedSearch]);

  const deleteMutation = useMutation({
    mutationFn: (id) => powerStationsApi.remove(id),
    onSuccess: () => {
      toast.success('Power station post deleted.', { title: 'Deleted' });
      queryClient.invalidateQueries({ queryKey: ['power-stations'] });
      setDeleting(null);
    },
  });

  const openCreate = () => {
    if (myStation) {
      setEditing(myStation);
    } else {
      setEditing(null);
    }
    setFormOpen(true);
  };

  const isEmpty = tab === 'near' && !hasLocation ? true : items.length === 0;

  const stationMap = (
    <AppMap center={coords || undefined} zoom={coords ? 13 : undefined} className="h-full w-full">
      <FitPoints items={items} />
      {hasLocation ? <RadiusCircle center={coords} radius={tab === 'near' ? radius : 2000} /> : null}
      <MapPoints items={items} toneFor={(item) => availabilityTone(item.availability)}>
        {(item) => (
          <div className="min-w-[12rem]">
            <p className="font-bold text-navy-900">{item.name}</p>
            {item.locationName ? <p className="text-xs text-navy-500">{item.locationName}</p> : null}
            <div className="mt-1 flex flex-wrap gap-1">
              {item.type ? (
                <Badge tone="neutral" size="sm">
                  {humanize(item.type)}
                </Badge>
              ) : null}
              <Badge tone={availabilityTone(item.availability)} size="sm">
                {humanize(item.availability, 'Unknown')}
              </Badge>
            </div>
            {Number.isFinite(item.distance) && item.distance > 0 ? (
              <p className="mt-2 text-xs font-semibold text-navy-600">{formatDistance(item.distance)} away</p>
            ) : null}
          </div>
        )}
      </MapPoints>
      <MapLegend
        title="Availability"
        items={[
          { label: 'Available', tone: 'success' },
          { label: 'Busy', tone: 'warning' },
          { label: 'Offline / maintenance', tone: 'danger' },
        ]}
      />
    </AppMap>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Power Stations"
        description={
          myStation
            ? 'You have one station post. Keep its availability up to date for your neighbours.'
            : 'Browse power stations, check availability and add your own post.'
        }
        actions={
          <Button
            variant="primary"
            icon={myStation ? Pencil : Plus}
            onClick={openCreate}
            loading={mineQuery.isLoading}
          >
            {myStation ? 'Edit my station' : 'Post a station'}
          </Button>
        }
      />

      <Tabs
        tabs={TABS.map((item) =>
          item.value === 'available' ? { ...item, count: availableCountQuery.data } : item
        )}
        value={tab}
        onChange={setTab}
        ariaLabel="Power station filters"
      />

      <MapWorkspace
        map={items.length ? stationMap : null}
        mapTitle="Station map"
        mapDescription={`${items.length} station${items.length === 1 ? '' : 's'} plotted. Click a pin for details.`}
      >
      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            placeholder="Search stations"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            label="Station type"
            placeholder="All types"
            options={STATION_TYPES}
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          />
          <Select
            label="Availability"
            placeholder="Any availability"
            options={[
              { id: 'available', name: 'Available' },
              { id: 'busy', name: 'Busy' },
              { id: 'offline', name: 'Offline' },
              { id: 'maintenance', name: 'Under maintenance' },
            ]}
            value={availabilityFilter}
            onChange={(event) => setAvailabilityFilter(event.target.value)}
          />
          {tab === 'near' ? (
            <Select
              label="Radius"
              options={RADIUS_OPTIONS}
              value={String(radius)}
              onChange={(event) => setRadius(Number(event.target.value))}
              hint="Centred on your saved location."
            />
          ) : (
            <div className="flex items-end">
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  setSearch('');
                  setTypeFilter('');
                  setAvailabilityFilter('');
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy-500">
          {activeQuery.isLoading
            ? 'Loading stations…'
            : `${items.length} station${items.length === 1 ? '' : 's'}${
                tab === 'near' && hasLocation ? ` within ${formatDistance(radius)}` : ''
              }`}
        </p>
      </div>

        <DataView
          isLoading={activeQuery.isLoading}
          error={activeQuery.isError}
          errorMessage={toUserMessage(activeQuery.error)}
          onRetry={() => activeQuery.refetch()}
          loadingLabel="Loading power stations…"
          items={items}
          isEmpty={isEmpty}
          empty={{
            icon: Plug,
            title:
              tab === 'near' && !hasLocation
                ? 'No location saved yet'
                : tab === 'mine'
                  ? 'You have not posted a station yet'
                  : 'No power stations found',
            description:
              tab === 'near' && !hasLocation
                ? 'Save your location so PowerGuide can find the closest available stations.'
                : tab === 'mine'
                  ? 'Tell your neighbours about a power bank, generator or charging station you run.'
                  : 'Try another filter, or be the first to post a station in your area.',
            action:
              tab === 'near' && !hasLocation ? (
                <Button to="/dashboard/location" variant="primary">
                  Set my location
                </Button>
              ) : tab === 'mine' ? (
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  Post a station
                </Button>
              ) : null,
          }}
          renderCard={(station) => {
            const owned = station.createdBy !== null && String(station.createdBy) === String(user?.id);
            return (
              <RecordCard
                icon={Plug}
                iconTone={availabilityTone(station.availability) === 'success' ? 'success' : 'danger'}
                title={station.name}
                subtitle={station.locationName || station.barangay || 'No location provided'}
                badges={[
                  {
                    label: humanize(station.availability, 'Unknown availability'),
                    tone: availabilityTone(station.availability),
                  },
                  station.type ? { label: humanize(station.type), tone: 'neutral' } : null,
                  station.accessType ? { label: humanize(station.accessType), tone: 'neutral' } : null,
                  owned ? { label: 'My post', tone: 'primary' } : null,
                ].filter(Boolean)}
                description={station.description}
                meta={[
                  Number.isFinite(item_distance(station))
                    ? { label: 'Distance', value: formatDistance(item_distance(station)) }
                    : null,
                  station.operatingHours
                    ? { label: 'Hours', value: station.operatingHours }
                    : null,
                  station.chargingType ? { label: 'Charging', value: station.chargingType } : null,
                  station.createdAt
                    ? { label: 'Posted', value: formatDateTime(station.createdAt) }
                    : null,
                ].filter(Boolean)}
                actions={
                  owned ? (
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
                  ) : null
                }
              />
            );
          }}
        />
      </MapWorkspace>

      <PowerStationFormModal
        open={formOpen}
        station={editing}
        barangays={barangays}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this power station post?"
        description="The station will be removed from the community map and list. This cannot be undone."
        confirmLabel="Delete post"
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

/** `distance` is only meaningful when the API actually computed one. */
function item_distance(station) {
  return Number.isFinite(station.distance) && station.distance > 0 ? station.distance : null;
}
