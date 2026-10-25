import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ZoomControl } from 'react-leaflet';
import { AlertTriangle, ShieldAlert, Waves } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import AppMap, { FitPoints, MapLegend, MapPoints, RadiusCircle } from '@/components/Map';
import MapWorkspace, { FeedPills, FeedStatTiles } from '@/components/MapWorkspace';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import { floodsApi, hazardsApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readRisk, withDistance } from '@/utils/records';
import {
  DEFAULT_RADIUS_METERS,
  RADIUS_OPTIONS,
  isOpenStatus,
  isOutsideServiceArea,
  severityTone,
  statusTone,
} from '@/utils/constants';
import { formatDateTime, formatDistance, formatTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';

/**
 * Module K - risk areas: open flood reports + unresolved electrical hazards
 * anywhere in Dagupan, in one view.
 *
 * Deliberately NOT fetched by radius. `risk/get_nearby.php` needs a saved
 * location, so a point that geocoded to the wrong country returns an empty result
 * that reads as "all clear". This page instead always loads both whole-city feeds
 * (`flood_report/get.php` and `electrical_hazard/get.php`, neither of which has a
 * default filter or a LIMIT) and keeps "still open" the same way the server did,
 * via `isOpenStatus`.
 *
 * The saved location is now only used to optionally narrow the ALREADY-loaded set
 * client-side, and a location outside the service area is surfaced rather than
 * quietly returning nothing.
 */
export default function RiskAreas() {
  const { coords, hasLocation } = useSavedLocation();
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METERS);

  const locationLooksWrong = isOutsideServiceArea(coords);

  const floodQuery = useQuery({
    queryKey: QUERY_KEYS.floods({ scope: 'risk-areas' }),
    queryFn: async ({ signal }) => (await floodsApi.list({}, { signal })).items,
    retry: 1,
  });

  const hazardQuery = useQuery({
    queryKey: QUERY_KEYS.hazards({ scope: 'risk-areas' }),
    queryFn: async ({ signal }) => (await hazardsApi.list({}, { signal })).items,
    retry: 1,
  });

  const isLoading = floodQuery.isLoading || hazardQuery.isLoading;
  const isError = floodQuery.isError && hazardQuery.isError;

  // Server used to filter these (flood status != 'cleared', hazard != 'resolved');
  // reproduce it here now that the whole city is loaded.
  const allFloods = useMemo(
    () =>
      (floodQuery.data || [])
        .map((record) => withDistance(readRisk(record, 'flood'), coords))
        .filter((flood) => isOpenStatus(flood.status)),
    [floodQuery.data, coords]
  );

  const allHazards = useMemo(
    () =>
      (hazardQuery.data || [])
        .map((record) => withDistance(readRisk(record, 'hazard'), coords))
        .filter((hazard) => isOpenStatus(hazard.status)),
    [hazardQuery.data, coords]
  );

  // The radius narrows what is already loaded; it never drives a request.
  // Inlined rather than passed as a helper so the memos stay dependency-complete.
  const floods = useMemo(
    () =>
      hasLocation
        ? allFloods.filter((item) => !Number.isFinite(item.distance) || item.distance <= Number(radius))
        : allFloods,
    [allFloods, hasLocation, radius]
  );
  const hazards = useMemo(
    () =>
      hasLocation
        ? allHazards.filter((item) => !Number.isFinite(item.distance) || item.distance <= Number(radius))
        : allHazards,
    [allHazards, hasLocation, radius]
  );
  const total = floods.length + hazards.length;
  const totalCitywide = allFloods.length + allHazards.length;

  // One merged feed, newest first - the Outages layout shows a single stream.
  const risks = useMemo(
    () => [...floods, ...hazards].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [floods, hazards]
  );

  const plotted = [
    ...floods.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    ...hazards.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
  ];

  const toneFor = (item) =>
    item.kind === 'flood' ? 'info' : item.severity ? severityTone(item.severity) : 'danger';

  const mapSummary = `${plotted.length} risk${plotted.length === 1 ? '' : 's'} plotted${
    hasLocation && !locationLooksWrong ? ` within ${formatDistance(radius)} of you` : ' across Dagupan'
  }.`;

  const riskMap = (
    <AppMap zoom={13} zoomControl={false} className="h-full w-full">
      <ZoomControl position="bottomright" />
      {/* FitPoints frames the risks; the radius circle is a reference for the
          distance filter, not a fetch bound. */}
      <FitPoints items={plotted} />
      {hasLocation && !locationLooksWrong ? <RadiusCircle center={coords} radius={radius} /> : null}
      <MapPoints items={plotted} toneFor={toneFor}>
        {(item) => (
          <div className="min-w-[13rem]">
            <p className="flex items-center gap-1.5 font-bold text-navy-900">
              {item.kind === 'flood' ? (
                <Waves className="h-4 w-4 text-info-600" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-danger-600" aria-hidden="true" />
              )}
              {item.label}
            </p>
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
      <MapLegend
        title="Risk type"
        items={[
          { label: 'Open flood', tone: 'info' },
          { label: 'Electrical hazard', tone: 'danger' },
          ...(hasLocation && !locationLooksWrong ? [{ label: 'Your location', tone: 'success' }] : []),
        ]}
      />
    </AppMap>
  );


  return (
    <div
      data-theme="dark"
      className="min-h-full bg-[#03041A] px-4 pb-8 pt-5 font-montserrat text-white lg:px-8 lg:pt-6"
    >
      {locationLooksWrong ? (
        <div className="rounded-2xl border border-[#FFBB02]/25 bg-[#FFBB02]/10 p-6 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-[#FFBB02]" aria-hidden="true" />
          <p className="mt-2 text-base font-bold text-white">Your saved location is outside Dagupan</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-white/60">
            Your saved point is far outside the city, so the distance filter and map would be measuring
            the wrong place. This usually means the address was matched to a location in another country.
            Please set your location again.
          </p>
          <Button to="/dashboard/location" variant="primary" className="mt-4">
            Fix my location
          </Button>
        </div>
      ) : (
        <MapWorkspace
          map={riskMap}
          mapLabel="Risk map"
          mapTitle="Live Risk Feed"
          mapSubtitle={`${mapSummary}${
            floodQuery.dataUpdatedAt ? ` · updated ${formatTime(floodQuery.dataUpdatedAt)}` : ''
          }`}
          stats={[
            { label: 'Open risks', value: total, icon: ShieldAlert, color: '#FFBB02' },
            { label: 'Open floods', value: floods.length, icon: Waves, color: '#22D3EE' },
            { label: 'Hazards', value: hazards.length, icon: AlertTriangle, color: '#FF2E1F' },
          ]}
          pills={
            hasLocation && !locationLooksWrong ? (
              <FeedPills
                ariaLabel="Distance from you"
                value={String(radius)}
                onChange={(value) => setRadius(Number(value))}
                options={RADIUS_OPTIONS}
              />
            ) : null
          }
          plottedCount={plotted.length}
          mapEmpty={!isLoading && plotted.length === 0}
          mapEmptyLabel="No open risks plotted yet"
        >
          {isError ? (
            <ErrorState
              message={toUserMessage(floodQuery.error || hazardQuery.error)}
              onRetry={() => {
                floodQuery.refetch();
                hazardQuery.refetch();
              }}
            />
          ) : isLoading ? (
            <LoadingState label="Loading risk areas…" />
          ) : total === 0 ? (
            totalCitywide > 0 && hasLocation ? (
              <EmptyState
                icon={ShieldAlert}
                title={`Nothing open within ${formatDistance(radius)}`}
                description={`There ${totalCitywide === 1 ? 'is' : 'are'} ${totalCitywide} open risk${
                  totalCitywide === 1 ? '' : 's'
                } in Dagupan, just further away. Widen the distance to see ${totalCitywide === 1 ? 'it' : 'them'}.`}
                action={
                  <Button variant="primary" onClick={() => setRadius(10000)}>
                    Show all {totalCitywide}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ShieldAlert}
                title="All clear across Dagupan"
                description="No open flood reports or unresolved electrical hazards anywhere in the city. Keep checking back after heavy rain."
              />
            )
          ) : (
            <ul className="space-y-2">
              {risks.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="rounded-xl border border-white/5 bg-[#1C1D30]/35 p-2.5 transition duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          item.kind === 'flood' ? 'bg-[#22D3EE]' : 'bg-[#FF2E1F]'
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[8px] font-extrabold tracking-[0.12em] ${
                          item.kind === 'flood'
                            ? 'border-[#22D3EE]/20 bg-[#22D3EE]/10 text-[#22D3EE]'
                            : 'border-[#FF2E1F]/20 bg-[#FF2E1F]/10 text-[#FF2E1F]'
                        }`}
                      >
                        {item.kind === 'flood' ? 'FLOOD' : 'HAZARD'}
                      </span>
                      {item.severity ? (
                        <Badge tone={severityTone(item.severity)} size="sm">
                          {humanize(item.severity)}
                        </Badge>
                      ) : null}
                      {Number.isFinite(item.distance) ? (
                        <Badge tone="neutral" size="sm">
                          {formatDistance(item.distance)}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[8.5px] font-medium text-white/35">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-1 truncate text-[13px] font-bold leading-tight text-white">
                    {item.label}
                  </h3>
                  {item.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-white/50">
                      {item.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </MapWorkspace>
      )}
    </div>
  );
}
