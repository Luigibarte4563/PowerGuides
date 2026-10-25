import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ZoomControl } from 'react-leaflet';
import { Flame, Layers, MapPin } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
import AppMap, {
  FitPoints,
  HEAT_LEGEND,
  HeatLayer,
  MapHitAreas,
  MapLegend,
  MapPoints,
} from '@/components/Map';
import MapWorkspace, { FeedActions, FeedStatTiles } from '@/components/MapWorkspace';
import { heatmapApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readCluster } from '@/utils/records';
import { formatNumber, formatTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import { severityTone } from '@/utils/constants';

const LAYERS = [
  { key: 'heatmap', label: 'Outage heatmap', description: 'Intensity of reported outages' },
  { key: 'clusters', label: 'Clusters', description: 'Grouped hotspots stored by the API' },
];

/**
 * Module L - heatmap and clusters. Read only, and city-wide.
 *
 * There is deliberately no radius and no saved location on this page. The map
 * frames every plotted point in Dagupan rather than a circle around the user, so a
 * saved location that geocoded to the wrong country cannot leave the page showing
 * an empty region - and the heatmap needs no personal data at all. (`radius`
 * remains a parameter of `heatmap/get.php`, but it is only a clustering distance
 * and is unused in the `by_barangay` mode this page requests.)
 */
export default function Heatmap() {
  const [enabled, setEnabled] = useState({ heatmap: true, clusters: true });

  const [heatmapQuery, clustersQuery] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.heatmap,
        queryFn: async ({ signal }) => (await heatmapApi.getHeatmap({}, { signal })).points,
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
      {
        queryKey: QUERY_KEYS.clusters,
        queryFn: async ({ signal }) => (await heatmapApi.getClusters({}, { signal })).items.map(readCluster),
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    ],
  });

  // Memoised so `framedPoints` below does not get a new array identity on every
  // render, which would make FitPoints refit the map each time.
  const points = useMemo(() => heatmapQuery.data || [], [heatmapQuery.data]);
  const clusters = useMemo(() => clustersQuery.data || [], [clustersQuery.data]);
  const plottedClusters = clusters.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  const isLoading = heatmapQuery.isLoading || clustersQuery.isLoading;
  const error = heatmapQuery.error || clustersQuery.error;
  const refetch = () => {
    heatmapQuery.refetch();
    clustersQuery.refetch();
  };

  // Everything with coordinates, so the viewport covers the whole city whatever
  // layers happen to be switched on. Memoised because FitPoints refits on change.
  const framedPoints = useMemo(
    () => [
      ...points.map((point) => ({ lat: point.lat, lng: point.lng })),
      ...plottedClusters.map((cluster) => ({ lat: cluster.lat, lng: cluster.lng })),
    ],
    [points, plottedClusters]
  );

  const heatMap = (
    <AppMap zoom={13} zoomControl={false} className="h-full w-full">
      <ZoomControl position="bottomright" />
      {/* Frames the whole city from whatever is plotted. */}
      <FitPoints items={framedPoints} />

      {enabled.heatmap && points.length ? (
        <HeatLayer points={points} radius={30} blur={18} minOpacity={0.6} />
      ) : null}

      {/*
        leaflet.heat draws a canvas, so the blobs cannot be clicked. These
        transparent targets sit over the same coordinates and reveal the per-area
        report count. Sized by intensity so the target matches the blob aimed at.
      */}
      {enabled.heatmap && points.length ? (
        <MapHitAreas items={points} radiusFor={(point) => 30 + (Number(point.intensity) || 0.2) * 46}>
          {(point) => {
            const houses = Number(point.raw?.affected_houses) || 0;
            return (
              <div className="min-w-[13rem]">
                <p className="font-bold text-navy-900">{point.label}</p>
                <p className="mt-1 text-sm font-bold text-navy-800">
                  {formatNumber(point.reportCount)} report{point.reportCount === 1 ? '' : 's'} in this area
                </p>
                {houses > 0 ? (
                  <p className="text-xs text-navy-600">
                    {formatNumber(houses)} household{houses === 1 ? '' : 's'} affected
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {point.forecastLevel ? (
                    <Badge tone={severityTone(point.forecastLevel)} size="sm">
                      {humanize(point.forecastLevel)} forecast
                    </Badge>
                  ) : null}
                  {Number.isFinite(Number(point.severityScore)) ? (
                    <Badge tone="neutral" size="sm">
                      Severity {formatNumber(point.severityScore)}
                    </Badge>
                  ) : null}
                  {Number.isFinite(Number(point.confidenceScore)) ? (
                    <Badge tone="neutral" size="sm">
                      {formatNumber(point.confidenceScore)}% confirmed
                    </Badge>
                  ) : null}
                </div>
              </div>
            );
          }}
        </MapHitAreas>
      ) : null}

      {enabled.clusters && plottedClusters.length ? (
        <MapPoints
          items={plottedClusters}
          size={Math.max(24, Math.min(52, 20 + (plottedClusters[0]?.count || 1) * 2))}
          toneFor={(item) => (item.forecastLevel ? severityTone(item.forecastLevel) : 'danger')}
        >
          {(item) => (
            <div className="min-w-[12rem]">
              <p className="font-bold text-navy-900">{item.label}</p>
              <p className="text-xs text-navy-500">{formatNumber(item.count)} reports</p>
              {item.severity ? (
                <Badge tone={severityTone(item.severity)} size="sm" className="mt-1">
                  {humanize(item.forecastLevel)}
                </Badge>
              ) : null}
            </div>
          )}
        </MapPoints>
      ) : null}

      <MapLegend
        title="Legend"
        items={[...HEAT_LEGEND, ...(enabled.clusters ? [{ label: 'Cluster', tone: 'danger' }] : [])]}
      />
    </AppMap>
  );

  const topClusterCount = clusters.reduce((highest, cluster) => Math.max(highest, cluster.count || 0), 0);
  const plottedTotal = points.length + plottedClusters.length;

  return (
    <div
      data-theme="dark"
      className="min-h-full bg-[#03041A] px-4 pb-8 pt-5 font-montserrat text-white lg:px-8 lg:pt-6"
    >
      <FeedActions
        actions={
          <Button variant="outline" icon={Layers} onClick={refetch} loading={isLoading}>
            Refresh layers
          </Button>
        }
      />

      <MapWorkspace
        map={heatMap}
        mapLabel="Outage heatmap"
        mapTitle="Live Heatmap Feed"
        mapSubtitle={`${formatNumber(plottedTotal)} plotted${
          heatmapQuery.dataUpdatedAt ? ` · updated ${formatTime(heatmapQuery.dataUpdatedAt)}` : ''
        }`}
        stats={[
          { label: 'Heat points', value: points.length, icon: Flame, color: '#FF2E1F' },
          { label: 'Clusters', value: clusters.length, icon: MapPin, color: '#22D3EE' },
          { label: 'Top cluster', value: topClusterCount, icon: Flame, color: '#FFBB02' },
        ]}
        pills={
          /* Layer switches are independent toggles, not a single choice, so they
             use the pill styling with per-pill pressed state. */
          <div className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label="Map layers">
            {LAYERS.map((layer) => (
              <button
                key={layer.key}
                type="button"
                onClick={() => setEnabled((current) => ({ ...current, [layer.key]: !current[layer.key] }))}
                aria-pressed={enabled[layer.key]}
                className={`h-7 rounded-full border px-2.5 text-[9px] font-bold transition ${
                  enabled[layer.key]
                    ? 'border-[#FFBB02]/40 bg-[#FFBB02]/15 text-[#FFBB02]'
                    : 'border-white/10 bg-transparent text-white/45 hover:border-white/20 hover:text-white/70'
                }`}
              >
                {layer.label}
              </button>
            ))}
          </div>
        }
        plottedCount={plottedTotal}
        mapEmpty={!isLoading && !error && plottedTotal === 0}
        mapEmptyLabel="No heatmap data yet"
      >
        {error ? <ErrorState message={toUserMessage(error)} onRetry={refetch} /> : null}

        {isLoading ? (
          <LoadingState label="Loading map layers…" />
        ) : clusters.length ? (
          <ul className="space-y-2">
            {[...clusters]
              .sort((a, b) => (b.count || 0) - (a.count || 0))
              .slice(0, 10)
              .map((cluster) => (
                <li
                  key={cluster.id ?? cluster.label}
                  className="rounded-xl border border-white/5 bg-[#1C1D30]/35 p-2.5 transition duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-bold text-white">{cluster.label}</p>
                    <Badge
                      tone={cluster.forecastLevel ? severityTone(cluster.forecastLevel) : 'neutral'}
                      size="sm"
                    >
                      {formatNumber(cluster.count)} reports
                    </Badge>
                  </div>
                  {cluster.forecastLevel ? (
                    <p className="mt-0.5 text-[11px] text-white/50">
                      {humanize(cluster.forecastLevel)} forecast
                    </p>
                  ) : null}
                </li>
              ))}
          </ul>
        ) : !error ? (
          <p className="text-[11px] leading-relaxed text-white/40">
            No clusters stored yet. Heat intensity still shows where reports concentrate.
          </p>
        ) : null}
      </MapWorkspace>
    </div>
  );
}
