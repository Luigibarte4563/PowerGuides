import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ZoomControl } from 'react-leaflet';
import { AlertTriangle, CalendarClock, MapPin, Plus, Waves } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import AppMap, {
  FitPoints,
  MapLegend,
  MapPin as MapPinMarker,
  MapPoints,
  RadiusCircle,
} from '@/components/Map';
import MapWorkspace, { FeedActions, FeedPills, FeedToggle } from '@/components/MapWorkspace';
import { useReference } from '@/context/ReferenceContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import { floodsApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readFlood, withDistance } from '@/utils/records';
import { DEFAULT_RADIUS_METERS, RADIUS_OPTIONS, severityTone, statusTone } from '@/utils/constants';
import { formatDateTime, formatDistance, formatTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import FloodFormModal, { FLOOD_LEVEL_OPTIONS } from './components/FloodFormModal';

/**
 * Module I - flood reports: list, map and create.
 *
 * The map mirrors whatever the list shows - every report on "All reports" (framed
 * with `FitPoints`), and only those inside the radius on "Nearby" (framed on the
 * saved location). `get.php` returns latitude/longitude for every row, so no
 * separate geo call is needed; distance from the saved location is computed
 * client-side with `withDistance`.
 */
const LEVEL_LEGEND = [
  { label: 'Low', tone: 'success' },
  { label: 'Moderate', tone: 'warning' },
  { label: 'High / severe', tone: 'danger' },
  { label: 'Not rated', tone: 'neutral' },
];

export default function Floods() {
  const { barangays } = useReference();
  const { coords, hasLocation } = useSavedLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METERS);
  const [formOpen, setFormOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const isNearby = tab === 'nearby';

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // The barangay/level filters are applied client-side below, so they are kept out
  // of this key - otherwise every keystroke would refetch the same unfiltered set.
  const listQuery = useQuery({
    queryKey: QUERY_KEYS.floods({ scope: 'all' }),
    queryFn: async ({ signal }) => (await floodsApi.list({}, { signal })).items,
    retry: 1,
  });

  const nearbyQuery = useQuery({
    queryKey: QUERY_KEYS.floods({ scope: 'nearby', lat: coords?.lat, lng: coords?.lng, radius }),
    queryFn: async ({ signal }) => {
      const { items } = await floodsApi.getNearby({ ...coords, radius }, { signal });
      return items;
    },
    enabled: isNearby && Boolean(coords),
    retry: 1,
  });

  const activeQuery = isNearby ? nearbyQuery : listQuery;

  const items = (activeQuery.data || [])
    .map((record) => withDistance(readFlood(record), coords))
    .filter((flood) => {
      if (!isNearby) {
        if (barangayFilter && humanize(flood.barangay) !== humanize(barangayFilter)) return false;
        if (severityFilter && flood.severity !== severityFilter) return false;
      }
      const term = debouncedSearch.trim().toLowerCase();
      if (!term) return true;
      return [flood.locationName, flood.barangay, flood.description, flood.severity]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    })
    .sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0));

  // Reports the map can actually plot.
  const plotted = useMemo(
    () => items.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    [items]
  );

  // Frame the reports AND the saved point, so "you" is never off-screen.
  const framedPoints = useMemo(
    () => (hasLocation ? [...plotted, { lat: coords.lat, lng: coords.lng }] : plotted),
    [plotted, hasLocation, coords]
  );

  const mapSummary =
    plotted.length === 0
      ? 'No reports with coordinates match your filters yet.'
      : `${plotted.length} report${plotted.length === 1 ? '' : 's'} plotted${
          isNearby ? ` within ${formatDistance(radius)} of you` : ' across Dagupan'
        }.`;

  // Feed stat tiles, counted the same way the list filters do.
  const highCount = items.filter((item) =>
    ['high', 'severe'].includes(String(item.severity).toLowerCase())
  ).length;
  const barangayCount = new Set(items.map((item) => item.barangay).filter(Boolean)).size;

  const floodMap = (
    <AppMap
      // "Nearby" stays framed on the saved point; "All reports" lets FitPoints
      // frame every plotted report instead.
      center={isNearby && hasLocation ? coords : undefined}
      zoom={isNearby && hasLocation ? 14 : 13}
      zoomControl={false}
      className="h-full w-full"
    >
      <ZoomControl position="bottomright" />
      {isNearby ? null : <FitPoints items={framedPoints} />}
      {isNearby && hasLocation ? <RadiusCircle center={coords} radius={radius} /> : null}
      <MapPoints items={plotted} toneFor={(item) => (item.severity ? severityTone(item.severity) : 'neutral')}>
        {(item) => (
          <div className="min-w-[12rem]">
            <p className="font-bold text-navy-900">
              {item.locationName || item.barangay || 'Flood report'}
            </p>
            {item.barangay && item.locationName ? (
              <p className="mt-0.5 text-xs text-navy-500">{item.barangay}</p>
            ) : null}
            <p className="mt-1 text-xs text-navy-600">{item.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.severity ? (
                <Badge tone={severityTone(item.severity)} size="sm">
                  {humanize(item.severity)}
                </Badge>
              ) : null}
              {item.status ? (
                <Badge tone={statusTone(item.status)} size="sm">
                  {humanize(item.status)}
                </Badge>
              ) : null}
              {Number.isFinite(item.distance) ? (
                <Badge tone="neutral" size="sm">
                  {formatDistance(item.distance)} away
                </Badge>
              ) : null}
            </div>
          </div>
        )}
      </MapPoints>
      {hasLocation ? (
        <MapPinMarker position={coords} tone="success" size={30}>
          <p className="text-xs font-semibold text-navy-700">Your saved location</p>
        </MapPinMarker>
      ) : null}
      <MapLegend
        title="Flood level"
        items={[
          ...LEVEL_LEGEND,
          ...(hasLocation ? [{ label: 'Your location', tone: 'success' }] : []),
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
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setFormOpen(true)}
            className="rounded-xl px-5 shadow-[0_8px_24px_rgba(255,187,2,0.18)]"
          >
            Report Flood
          </Button>
        }
        search={search}
        onSearchChange={setSearch}
        onClearSearch={() => setSearch('')}
        searchId="flood-search"
        searchLabel="Search flood reports"
        searchPlaceholder="Search location, barangay, description…"
      />

      <MapWorkspace
        map={floodMap}
        mapLabel="Flood map"
        mapTitle="Live Flood Feed"
        mapSubtitle={`${mapSummary}${activeQuery.dataUpdatedAt ? ` · updated ${formatTime(activeQuery.dataUpdatedAt)}` : ''}`}
        toggle={
          <FeedToggle
            ariaLabel="Flood report scope"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All reports', count: (listQuery.data || []).length },
              {
                value: 'nearby',
                label: 'Nearby',
                count: nearbyQuery.data ? nearbyQuery.data.length : undefined,
              },
            ]}
          />
        }
        stats={[
          { label: 'Reports', value: items.length, icon: Waves, color: '#22D3EE' },
          { label: 'High / severe', value: highCount, icon: AlertTriangle, color: '#FF2E1F' },
          { label: 'Barangays', value: barangayCount, icon: MapPin, color: '#FFBB02' },
        ]}
        pills={
          <FeedPills
            ariaLabel="Filter by flood level"
            value={severityFilter || 'all'}
            onChange={(value) => setSeverityFilter(value === 'all' ? '' : value)}
            options={[{ value: 'all', label: 'All' }, ...FLOOD_LEVEL_OPTIONS]}
          />
        }
        filters={
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Select
              aria-label="Filter by barangay"
              placeholder="All barangays"
              options={barangays}
              value={barangayFilter}
              onChange={(event) => setBarangayFilter(event.target.value)}
              className="h-9 py-0 text-xs"
            />
            {isNearby ? (
              <Select
                aria-label="Search radius"
                options={RADIUS_OPTIONS}
                value={String(radius)}
                onChange={(event) => setRadius(Number(event.target.value))}
                className="h-9 py-0 text-xs"
              />
            ) : null}
          </div>
        }
        plottedCount={plotted.length}
        mapEmpty={!activeQuery.isLoading && !activeQuery.isError && plotted.length === 0}
        mapEmptyLabel="No mapped flood reports yet"
      >
        <DataView
        isLoading={activeQuery.isLoading}
        error={activeQuery.isError}
        errorMessage={toUserMessage(activeQuery.error)}
        onRetry={() => activeQuery.refetch()}
        loadingLabel="Loading flood reports…"
        items={items}
        isEmpty={isNearby && !hasLocation ? true : items.length === 0}
        empty={{
          icon: isNearby && !hasLocation ? MapPin : Waves,
          title: isNearby && !hasLocation ? 'No location saved yet' : 'No flood reports found',
          description:
            isNearby && !hasLocation
              ? 'Save your location so we can show flood reports closest to you.'
              : 'No one has reported flooding for this filter. If you see rising water, please report it.',
          action:
            isNearby && !hasLocation ? (
              <Button to="/dashboard/location" variant="primary">
                Set my location
              </Button>
            ) : (
              <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
                Report Flood
              </Button>
            ),
        }}
        renderCard={(flood) => (
          <RecordCard
            icon={Waves}
            iconTone="info"
            title={flood.locationName || flood.barangay || 'Flood report'}
            subtitle={`Reported ${formatDateTime(flood.createdAt)}`}
            badges={[
              flood.severity ? { label: humanize(flood.severity), tone: severityTone(flood.severity) } : null,
              flood.status ? { label: humanize(flood.status), tone: statusTone(flood.status) } : null,
              Number.isFinite(flood.distance)
                ? { label: formatDistance(flood.distance), tone: 'neutral' }
                : null,
            ].filter(Boolean)}
            description={flood.description}
            meta={[
              Number.isFinite(flood.depthCm) ? { label: 'Depth', value: `${flood.depthCm} cm` } : null,
              flood.createdAt ? { label: 'Reported', value: formatDateTime(flood.createdAt), icon: CalendarClock } : null,
            ].filter(Boolean)}
          />
        )}
      />
      </MapWorkspace>

      <FloodFormModal open={formOpen} onClose={() => setFormOpen(false)} defaultLocation={coords} />
    </div>
  );
}
