import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, Waves } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import AppMap, { FitPoints, MapLegend, MapPoints, RadiusCircle } from '@/components/Map';
import MapWorkspace from '@/components/MapWorkspace';
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
import { formatDateTime, formatDistance, humanize } from '@/utils/formatters';
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
    <AppMap zoom={13} className="h-full w-full">
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
    <div className="space-y-6">
      <PageHeader
        title="Risk Areas"
        description="Open flood reports and unresolved electrical hazards across Dagupan, in one view."
      />

      {hasLocation && !locationLooksWrong ? (
        <Card>
          <CardHeader description="Narrows the risks already loaded from your saved location. It does not limit what we fetch.">
            Distance from you
          </CardHeader>
          <CardBody className="space-y-3">
            <label htmlFor="risk-radius" className="block text-sm font-semibold text-navy-800">
              Within {formatDistance(radius)} of you
            </label>
            <input
              id="risk-radius"
              type="range"
              min="250"
              max="10000"
              step="250"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-navy-100 accent-primary-500"
            />
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRadius(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    radius === option.value
                      ? 'border-primary-400 bg-primary-100 text-primary-800'
                      : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {locationLooksWrong ? (
        <Card>
          <CardBody>
            <div className="rounded-card border border-warning-200 bg-warning-50 p-6 text-center">
              <ShieldAlert className="mx-auto h-6 w-6 text-warning-700" aria-hidden="true" />
              <p className="mt-2 text-base font-bold text-warning-800">Your saved location is outside Dagupan</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-navy-700">
                Your saved point is far outside the city, so the distance filter and map would be measuring
                the wrong place. This usually means the address was matched to a location in another country.
                Please set your location again.
              </p>
              <Button to="/dashboard/location" variant="primary" className="mt-4">
                Fix my location
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <MapWorkspace
            map={isLoading ? <p className="p-6 text-center text-sm text-navy-500">Loading risk areas…</p> : total > 0 ? riskMap : null}
            mapTitle="Risk map"
            mapDescription={isLoading ? '' : mapSummary}
            mapFooter={
              hasLocation && !locationLooksWrong ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-navy-600">Within</span>
                  {RADIUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRadius(option.value)}
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
              ) : null
            }
          >

          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryTile label="Open risks" value={total} isLoading={isLoading} tone="navy" />
            <SummaryTile label="Open floods" value={floods.length} isLoading={isLoading} tone="info" />
            <SummaryTile label="Unresolved hazards" value={hazards.length} isLoading={isLoading} tone="danger" />
          </div>

          {isError ? (
            <ErrorState
              message={toUserMessage(floodQuery.error || hazardQuery.error)}
              onRetry={() => {
                floodQuery.refetch();
                hazardQuery.refetch();
              }}
            />
          ) : null}

          {!isLoading && total === 0 && totalCitywide > 0 && hasLocation ? (
            <Card>
              <CardBody>
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
              </CardBody>
            </Card>
          ) : null}

          {!isLoading && totalCitywide === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={ShieldAlert}
                  title="All clear across Dagupan"
                  description="No open flood reports or unresolved electrical hazards anywhere in the city. Keep checking back after heavy rain."
                />
              </CardBody>
            </Card>
          ) : null}

          <div className="space-y-4">
            <RiskList
              title="Open floods"
              icon={Waves}
              tone="info"
              items={floods}
              isLoading={isLoading}
              emptyLabel="No open flood reports here."
            />
            <RiskList
              title="Unresolved electrical hazards"
              icon={AlertTriangle}
              tone="danger"
              items={hazards}
              isLoading={isLoading}
              emptyLabel="No unresolved electrical hazards here."
            />
          </div>
          </MapWorkspace>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, isLoading, tone }) {
  const tones = {
    info: 'bg-info-50 text-info-700 border-info-200',
    danger: 'bg-danger-50 text-danger-700 border-danger-200',
    navy: 'bg-navy-50 text-navy-800 border-navy-200',
  };

  return (
    <div className={`rounded-card border p-5 shadow-card ${tones[tone]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{isLoading ? '—' : value}</p>
    </div>
  );
}

function RiskList({ title, icon: Icon, tone, items, isLoading, emptyLabel }) {
  return (
    <Card>
      <CardHeader description={isLoading ? 'Loading…' : `${items.length} within range`}>{title}</CardHeader>
      <CardBody className="space-y-3">
        {isLoading ? (
          <LoadingState label="Loading…" />
        ) : items.length === 0 ? (
          <p className="rounded-card border border-dashed border-navy-200 bg-canvas p-5 text-center text-sm text-navy-500">
            {emptyLabel}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex items-start gap-3 rounded-card border border-navy-100 p-4"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${
                    tone === 'info' ? 'bg-info-50 text-info-700' : 'bg-danger-50 text-danger-700'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-navy-900">{item.label}</h3>
                    <div className="flex flex-wrap gap-1">
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
                  </div>
                  <p className="mt-1 text-sm text-navy-600">{item.description}</p>
                  <p className="mt-1 text-xs text-navy-400">{formatDateTime(item.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
