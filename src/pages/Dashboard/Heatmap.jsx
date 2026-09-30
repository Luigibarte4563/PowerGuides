import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Flame, Info, Layers, MapPin } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';
import AppMap, {
  FitPoints,
  HEAT_LEGEND,
  HeatLayer,
  MapHitAreas,
  MapLegend,
  MapPoints,
} from '@/components/Map';
import MapWorkspace from '@/components/MapWorkspace';
import { heatmapApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readCluster } from '@/utils/records';
import { formatNumber, humanize } from '@/utils/formatters';
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
    <AppMap zoom={13} className="h-full w-full">
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Heatmap & Clusters"
        description="A visual picture of where outages concentrate across Dagupan."
        actions={
          <Button variant="outline" icon={Layers} onClick={refetch} loading={isLoading}>
            Refresh layers
          </Button>
        }
      />

      <MapWorkspace
        map={heatMap}
        mapTitle="Outage intensity"
        mapDescription={isLoading ? '' : `${formatNumber(points.length)} heat point${points.length === 1 ? '' : 's'} across Dagupan`}
        mapAction={
          <Button variant="outline" size="sm" onClick={refetch} loading={isLoading}>
            Refresh
          </Button>
        }
        mapFooter={
          <p className="text-xs text-navy-500">
            Warmer colours mean more reports in that area. Click a hot area to see how many reports it
            covers, or click a cluster pin for its total.
          </p>
        }
      >
        {error ? <ErrorState message={toUserMessage(error)} onRetry={refetch} /> : null}

        {isLoading ? (
          <Card>
            <CardBody>
              <LoadingState label="Loading map layers…" />
            </CardBody>
          </Card>
        ) : null}

          <Card>
            <CardHeader description="Turn layers on or off.">Layers</CardHeader>
            <CardBody className="space-y-2">
              {LAYERS.map((layer) => (
                <label
                  key={layer.key}
                  className="flex cursor-pointer items-start gap-3 rounded-control border border-navy-100 p-3 transition hover:bg-navy-50"
                >
                  <input
                    type="checkbox"
                    checked={enabled[layer.key]}
                    onChange={(event) =>
                      setEnabled((current) => ({ ...current, [layer.key]: event.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-navy-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-navy-800">{layer.label}</span>
                    <span className="block text-xs text-navy-500">{layer.description}</span>
                  </span>
                </label>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Layer summary</CardHeader>
            <CardBody className="space-y-3 text-sm">
              <SummaryRow
                icon={Flame}
                label="Heatmap points"
                value={heatmapQuery.isLoading ? '—' : formatNumber(points.length)}
              />
              <SummaryRow
                icon={MapPin}
                label="Clusters"
                value={clustersQuery.isLoading ? '—' : formatNumber(clusters.length)}
              />
            </CardBody>
          </Card>

          {clusters.length ? (
            <Card>
              <CardHeader>Top clusters</CardHeader>
              <CardBody>
                <ul className="space-y-2">
                  {[...clusters]
                    .sort((a, b) => (b.count || 0) - (a.count || 0))
                    .slice(0, 6)
                    .map((cluster) => (
                      <li key={cluster.id ?? cluster.label} className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm text-navy-700">{cluster.label}</span>
                        <Badge tone={cluster.forecastLevel ? severityTone(cluster.forecastLevel) : 'neutral'} size="sm">
                          {formatNumber(cluster.count)} reports
                        </Badge>
                      </li>
                    ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
      </MapWorkspace>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-navy-600">
        <Icon className="h-4 w-4 text-navy-400" aria-hidden="true" />
        {label}
      </span>
      <span className="font-semibold text-navy-900">{value}</span>
    </div>
  );
}
