import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Flame, Layers, Save, Search, Waves } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { InfoNote } from '@/components/ui/Alert';
import { LoadingState } from '@/components/ui/States';
import AppMap, {
  HEAT_GRADIENT,
  HeatLayer,
  MapCircle,
  MapHitAreas,
  MapLegend,
  MapPoints,
  MapView,
} from '@/components/Map';
import MapWorkspace from '@/components/MapWorkspace';
import MapPicker from '@/components/MapPicker';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { CLUSTER_FORECAST_LEVELS, getNearbyRisks, heatmapApi, floodsApi, hazardsApi } from '@/api';
import { COMPANY_QUERY_KEYS, DEFAULT_RADIUS_METERS, QUERY_KEYS, RADIUS_OPTIONS } from '@/utils/constants';
import { readCluster, readFlood, readHazard, readRisk } from '@/utils/records';
import { DEFAULT_CENTER, formatDate, formatDistance, formatTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';

/**
 * Module MAP - situational awareness (FR-MAP-1 .. FR-MAP-6).
 *
 * Four independently toggleable layers over one map:
 *   heatmap   `heatmap/get.php` by barangay, weighted by report_count (FR-MAP-1)
 *   clusters  `cluster/get.php` as radius circles (FR-MAP-2)
 *   floods    `flood_report/get.php` pins (FR-MAP-4)
 *   hazards   `electrical_hazard/get.php` pins (FR-MAP-4)
 * plus a point/radius risk query (FR-MAP-5) and a cluster store form (FR-MAP-3).
 *
 * `flood_report/get.php` and `electrical_hazard/get.php` have no open-only filter, so
 * every row comes back and the "only open" switch filters `status` client-side - the
 * two values `risk/get_nearby.php` itself excludes.
 */
const LAYERS = [
  { key: 'heatmap', label: 'Outage heatmap', color: HEAT_GRADIENT[0.6] },
  { key: 'clusters', label: 'Outage clusters', color: '#F59E0B' },
  { key: 'floods', label: 'Flood reports', color: '#22D3EE' },
  { key: 'hazards', label: 'Electrical hazards', color: '#FF2E1F' },
];

const CLOSED_FLOOD_STATUSES = ['cleared'];
const CLOSED_HAZARD_STATUSES = ['resolved'];

const LOOKBACK_OPTIONS = [
  { value: 1, label: 'Last 24 hours' },
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
];

export default function MapRisk() {
  const { barangays } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [enabled, setEnabled] = useState({ heatmap: true, clusters: true, floods: true, hazards: true });
  const [openOnly, setOpenOnly] = useState(true);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [probe, setProbe] = useState(null);
  const [probeRadius, setProbeRadius] = useState(DEFAULT_RADIUS_METERS);
  const [clusterDraft, setClusterDraft] = useState({
    barangay: '',
    forecastLevel: 'low',
    radius: DEFAULT_RADIUS_METERS,
    reportCount: 1,
  });

  const heatmapQuery = useQuery({
    queryKey: [...QUERY_KEYS.heatmap, lookbackDays],
    queryFn: async ({ signal }) => heatmapApi.getHeatmap({ days: lookbackDays }, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const clusterQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.clusters({}),
    queryFn: async ({ signal }) => (await heatmapApi.getClusters({}, { signal })).items.map(readCluster),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const floodQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.outages({ layer: 'floods' }),
    queryFn: async ({ signal }) => (await floodsApi.list({}, { signal })).items.map(readFlood),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const hazardQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.hazards({ layer: 'map' }),
    queryFn: async ({ signal }) => (await hazardsApi.list({}, { signal })).items.map(readHazard),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const clusters = useMemo(
    () =>
      (clusterQuery.data || []).filter(
        (cluster) => Number.isFinite(cluster.lat) && Number.isFinite(cluster.lng)
      ),
    [clusterQuery.data]
  );

  const floods = useMemo(
    () =>
      (floodQuery.data || []).filter(
        (flood) =>
          !openOnly || !CLOSED_FLOOD_STATUSES.includes(String(flood.status ?? '').toLowerCase())
      ),
    [floodQuery.data, openOnly]
  );

  const hazards = useMemo(
    () =>
      (hazardQuery.data || []).filter(
        (hazard) =>
          !openOnly || !CLOSED_HAZARD_STATUSES.includes(String(hazard.status ?? '').toLowerCase())
      ),
    [hazardQuery.data, openOnly]
  );

  const riskQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.outages({ risk: probe, radius: probeRadius }),
    queryFn: async ({ signal }) => getNearbyRisks({ ...probe, radius: probeRadius }, { signal }),
    enabled: Boolean(probe),
    retry: 1,
  });

  const storeMutation = useMutation({
    mutationFn: (payload) => heatmapApi.storeCluster(payload),
    onSuccess: (result) => {
      toast.success(
        result?.cluster_id ? `Cluster #${result.cluster_id} saved.` : 'Cluster saved.',
        { title: 'Cluster stored' }
      );
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.clusters({}) });
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The cluster could not be saved.'), { title: 'Save failed' });
    },
  });

  // `barangay_id` is a REQUIRED numeric id in `cluster/store.php` and cannot be
  // derived from a dropped pin, so the barangay is chosen explicitly. The reference
  // list keeps the row id as `rowId`.
  const selectedBarangay = useMemo(
    () => (barangays || []).find((option) => option.name === clusterDraft.barangay) || null,
    [barangays, clusterDraft.barangay]
  );
  const canStore = Boolean(probe) && Number(selectedBarangay?.rowId) > 0;

  const storeCluster = () => {
    if (!probe) return;
    storeMutation.mutate({
      barangay_id: Number(selectedBarangay.rowId),
      latitude: probe.lat,
      longitude: probe.lng,
      radius_meters: Number(clusterDraft.radius) || 500,
      report_count: Number(clusterDraft.reportCount) || 1,
      affected_houses: 0,
      forecast_level: clusterDraft.forecastLevel,
      report_ids: [],
    });
  };

  const legendItems = LAYERS.filter((layer) => enabled[layer.key]).map((layer) => ({
    label: layer.label,
    color: layer.color,
  }));

  const plottedTotal =
    (enabled.heatmap ? heatmapQuery.data?.points?.length || 0 : 0) +
    (enabled.clusters ? clusters.length : 0) +
    (enabled.floods ? floods.length : 0) +
    (enabled.hazards ? hazards.length : 0);

  const riskMap = (
    <AppMap zoom={DEFAULT_CENTER.zoom} className="h-full w-full">
      {enabled.heatmap ? <HeatLayer points={heatmapQuery.data?.points || []} /> : null}

      {enabled.clusters
        ? clusters.map((cluster) => (
            <MapCircle
              key={cluster.id}
              center={cluster}
              radius={cluster.radiusMeters || 500}
            >
              <ClusterPopup cluster={cluster} />
            </MapCircle>
          ))
        : null}

      <MapPoints items={enabled.floods ? floods : []} toneFor={() => 'info'} glyphFor={() => 'F'}>
        {(flood) => <RiskPopup item={readRisk(flood.raw, 'flood')} />}
      </MapPoints>

      <MapPoints
        items={enabled.hazards ? hazards : []}
        toneFor={(hazard) =>
          ['critical', 'high'].includes(String(hazard.severity).toLowerCase())
            ? 'danger'
            : 'warning'
        }
        glyphFor={() => 'H'}
      >
        {(hazard) => <RiskPopup item={readRisk(hazard.raw, 'hazard')} />}
      </MapPoints>

      {/* The heatmap canvas has no hit targets, so invisible areas are laid over
          it to make each blob clickable. */}
      <MapHitAreas items={enabled.heatmap ? heatmapQuery.data?.points || [] : []} radius={34}>
        {(point) => (
          <div className="min-w-[12rem]">
            <p className="font-bold text-navy-900">{point.label}</p>
            <p className="mt-0.5 text-xs text-navy-500">
              {point.reportCount} report{point.reportCount === 1 ? '' : 's'} in the last{' '}
              {heatmapQuery.data?.lookbackDays ?? lookbackDays} days
            </p>
            {point.forecastLevel ? (
              <Badge tone={forecastTone(point.forecastLevel)} size="sm" className="mt-2">
                Forecast: {humanize(point.forecastLevel)}
              </Badge>
            ) : null}
          </div>
        )}
      </MapHitAreas>

      {probe ? <MapView center={probe} zoom={14} /> : null}
      {probe ? (
        <MapCircle center={probe} radius={probeRadius} color="#22D3EE" fillOpacity={0.06} />
      ) : null}

      <MapLegend title="Layers" items={legendItems} position="top" />
    </AppMap>
  );

  return (
    <div
      data-theme="dark"
      className="min-h-full bg-[#03041A] px-4 pb-8 pt-5 font-montserrat text-white lg:px-8 lg:pt-6"
    >
      <MapWorkspace
        map={riskMap}
        mapLabel="Map & risk"
        mapTitle="Situational Awareness"
        mapSubtitle={`${plottedTotal} plotted${
          heatmapQuery.dataUpdatedAt ? ` · updated ${formatTime(heatmapQuery.dataUpdatedAt)}` : ''
        }`}
        stats={[
          { label: 'Floods', value: floods.length, icon: Waves, color: '#22D3EE' },
          { label: 'Hazards', value: hazards.length, icon: AlertTriangle, color: '#FF2E1F' },
          { label: 'Clusters', value: clusters.length, icon: Layers, color: '#FFBB02' },
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
        filters={
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Select
              aria-label="Heatmap lookback"
              options={LOOKBACK_OPTIONS}
              value={String(lookbackDays)}
              onChange={(event) => setLookbackDays(Number(event.target.value))}
              className="h-9 py-0 text-xs"
            />
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-[#1C1D30]/60 px-2.5 text-[10px] font-bold text-white/60">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(event) => setOpenOnly(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-transparent"
              />
              Open only
            </label>
          </div>
        }
        plottedCount={plottedTotal}
        mapEmpty={
          !heatmapQuery.isLoading && !floodQuery.isLoading && !hazardQuery.isLoading && plottedTotal === 0
        }
        mapEmptyLabel="Nothing plotted yet"
      >
        <div className="space-y-2">
          <section className="rounded-xl border border-white/5 bg-[#1C1D30]/35 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-white">
                <Search className="h-3.5 w-3.5 text-[#FFBB02]" aria-hidden="true" />
                Risk lookup
              </p>
              <span className="shrink-0 text-[9px] font-medium text-white/35">around a point</span>
            </div>

            <div className="mt-2">
              <MapPicker
                label="Pick a centre point"
                value={probe}
                onChange={setProbe}
                height="h-44"
                showGeolocate={false}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1">
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setProbeRadius(option.value)}
                  aria-pressed={probeRadius === option.value}
                  className={`h-7 rounded-full border px-2.5 text-[9px] font-bold transition ${
                    probeRadius === option.value
                      ? 'border-[#FFBB02]/40 bg-[#FFBB02]/15 text-[#FFBB02]'
                      : 'border-white/10 bg-transparent text-white/45 hover:border-white/20 hover:text-white/70'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {!probe ? (
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                Pick a point to run a combined flood and hazard risk query against it.
              </p>
            ) : riskQuery.isLoading ? (
              <LoadingState label="Checking risk…" />
            ) : riskQuery.isError ? (
              <InfoNote>{toUserMessage(riskQuery.error, 'The risk lookup failed.')}</InfoNote>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={riskQuery.data.counts.floods ? 'info' : 'neutral'} size="sm">
                    {riskQuery.data.counts.floods} flood{riskQuery.data.counts.floods === 1 ? '' : 's'}
                  </Badge>
                  <Badge tone={riskQuery.data.counts.hazards ? 'danger' : 'neutral'} size="sm">
                    {riskQuery.data.counts.hazards} hazard{riskQuery.data.counts.hazards === 1 ? '' : 's'}
                  </Badge>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    within {formatDistance(riskQuery.data.radius ?? probeRadius)}
                  </span>
                </div>
                {riskQuery.data.risks.length === 0 ? (
                  <p className="text-[11px] leading-relaxed text-white/40">
                    Nothing open within that radius. The API only counts floods that are not cleared and
                    hazards that are not resolved.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {riskQuery.data.risks.slice(0, 8).map((risk) => {
                      const item = readRisk(risk, risk.__kind);
                      return (
                        <li
                          key={`${item.kind}-${item.id}`}
                          className="rounded-xl border border-white/5 bg-[#03041A]/40 p-2"
                        >
                          <p className="truncate text-[13px] font-bold leading-tight text-white">{item.label}</p>
                          <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-white/40">
                            {item.kind === 'flood' ? 'Flood' : 'Hazard'} · {humanize(item.severity, 'unrated')} ·{' '}
                            {item.barangay || 'unknown area'}
                            {Number.isFinite(risk.distance) ? ` · ${formatDistance(risk.distance)}` : ''}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-white/5 bg-[#1C1D30]/35 p-2.5">
            <p className="text-[13px] font-bold text-white">Save a cluster</p>
            <p className="mt-0.5 text-[9px] font-medium text-white/35">Persisted centred on the probed point</p>
            <div className="mt-2 space-y-2">
              <Select
                label="Barangay"
                required
                options={barangays}
                placeholder="Select a barangay"
                value={clusterDraft.barangay}
                onChange={(event) =>
                  setClusterDraft((current) => ({ ...current, barangay: event.target.value }))
                }
                hint="The endpoint needs a numeric barangay id, which cannot be derived from the point."
              />
              <Select
                label="Forecast level"
                options={CLUSTER_FORECAST_LEVELS}
                value={clusterDraft.forecastLevel}
                onChange={(event) =>
                  setClusterDraft((current) => ({ ...current, forecastLevel: event.target.value }))
                }
              />
              <Select
                label="Cluster radius"
                options={RADIUS_OPTIONS}
                value={String(clusterDraft.radius)}
                onChange={(event) =>
                  setClusterDraft((current) => ({ ...current, radius: Number(event.target.value) }))
                }
              />
              <Select
                label="Reports in cluster"
                options={[1, 5, 10, 25, 50, 100].map((value) => ({ value, label: String(value) }))}
                value={String(clusterDraft.reportCount)}
                onChange={(event) =>
                  setClusterDraft((current) => ({ ...current, reportCount: Number(event.target.value) }))
                }
              />
              <Button
                size="sm"
                icon={Save}
                onClick={storeCluster}
                loading={storeMutation.isPending}
                disabled={!canStore}
              >
                Store cluster here
              </Button>
              {!probe ? (
                <InfoNote>Pick a centre point in the risk lookup panel first.</InfoNote>
              ) : !selectedBarangay ? (
                <InfoNote>Choose a barangay - the endpoint rejects a cluster without one.</InfoNote>
              ) : null}
              <p className="text-[9px] leading-relaxed text-white/35">
                The server always records a stored cluster as active, and it does not accept a status or a
                set of linked report ids from this screen.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-white/5 bg-[#1C1D30]/35 p-2.5">
            <p className="text-[13px] font-bold text-white">Stored clusters ({clusters.length})</p>
            {clusterQuery.isLoading ? (
              <LoadingState label="Loading clusters…" />
            ) : clusters.length === 0 ? (
              <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                No stored clusters yet. Save one above and it will appear here and on the map.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {clusters.slice(0, 10).map((cluster) => (
                  <li
                    key={cluster.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-white/5 bg-[#03041A]/40 p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold leading-tight text-white">{cluster.label}</p>
                      <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-white/40">
                        {cluster.count} report{cluster.count === 1 ? '' : 's'} ·{' '}
                        {cluster.radiusMeters ? formatDistance(cluster.radiusMeters) : 'no radius'}
                        {cluster.clusterDate ? ` · ${formatDate(cluster.clusterDate)}` : ''}
                      </p>
                    </div>
                    {cluster.forecastLevel ? (
                      <Badge tone={forecastTone(cluster.forecastLevel)} size="sm">
                        {humanize(cluster.forecastLevel)}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </MapWorkspace>
    </div>
  );
}

/** `forecast_level` is the API's own vocabulary: low | moderate | high | critical. */
function forecastTone(level) {
  const key = String(level ?? '').toLowerCase();
  if (key === 'critical' || key === 'high') return 'danger';
  if (key === 'moderate') return 'warning';
  return 'success';
}

function ClusterPopup({ cluster }) {
  return (
    <div className="min-w-[13rem]">
      <p className="font-bold text-navy-900">{cluster.label}</p>
      <p className="mt-0.5 text-xs text-navy-500">
        {cluster.count} report{cluster.count === 1 ? '' : 's'} ·{' '}
        {cluster.radiusMeters ? formatDistance(cluster.radiusMeters) : 'no radius'}
      </p>
      {cluster.barangay || cluster.clusterDate ? (
        <p className="mt-1 text-xs text-navy-600">
          {[cluster.barangay, formatDate(cluster.clusterDate)].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {cluster.forecastLevel ? (
        <Badge tone={forecastTone(cluster.forecastLevel)} size="sm" className="mt-2">
          Forecast: {humanize(cluster.forecastLevel)}
        </Badge>
      ) : null}
    </div>
  );
}

function RiskPopup({ item }) {
  return (
    <div className="min-w-[13rem]">
      <p className="font-bold text-navy-900">{item.label}</p>
      <p className="mt-0.5 text-xs text-navy-500">
        {item.kind === 'flood' ? 'Flood report' : 'Electrical hazard'} · {humanize(item.severity, 'unrated')}
      </p>
      {item.barangay ? <p className="mt-1 text-xs text-navy-600">{item.barangay}</p> : null}
      {item.description ? (
        <p className="mt-1 line-clamp-3 text-xs text-navy-600">{item.description}</p>
      ) : null}
      <p className="mt-1 text-xs text-navy-400">{formatDate(item.createdAt)}</p>
    </div>
  );
}
