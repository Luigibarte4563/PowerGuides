import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Crosshair, MapPin, ShieldCheck, XCircle } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Pagination from '@/components/Pagination';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table';
import { InfoNote } from '@/components/ui/Alert';
import { LoadingState } from '@/components/ui/States';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import AppMap, {
  FitPoints,
  MapCircle,
  MapLegend,
  MapPin as MapPinMarker,
  MapPoints,
  MapView,
} from '@/components/Map';
import MapPicker from '@/components/MapPicker';
import MapWorkspace from '@/components/MapWorkspace';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { hazardsApi, HAZARD_STATUSES } from '@/api';
import {
  COMPANY_PAGE_SIZE,
  COMPANY_QUERY_KEYS,
  DEFAULT_RADIUS_METERS,
  RADIUS_OPTIONS,
  severityTone,
  statusTone,
} from '@/utils/constants';
import { readHazard, resolveImageUrl, withDistance } from '@/utils/records';
import { formatDateTime, formatDistance, formatRelativeTime, hasCoordinates, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';

const TABS = [
  { value: 'all', label: 'All hazards', icon: AlertTriangle },
  { value: 'reported', label: 'Reported', icon: MapPin },
  { value: 'verified', label: 'Verified', icon: ShieldCheck },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2 },
];

const STATUS_ACTIONS = {
  reported: { label: 'Mark verified', value: 'verified', icon: ShieldCheck, tone: 'primary' },
  verified: { label: 'Mark resolved', value: 'resolved', icon: CheckCircle2, tone: 'success' },
  resolved: { label: 'Reopen', value: 'reported', icon: XCircle, tone: 'outline' },
};

/**
 * Module HAZ - electrical hazard review (FR-HAZ-1, FR-HAZ-2, FR-HAZ-3).
 *
 * `electrical_hazard/get.php` has no role check, but `update_status.php` lets a staff
 * role change ANY hazard (not just the reporter's), so both actions are offered to
 * every dashboard user here.
 *
 * The status enum is a hard schema constraint (`reported | verified | resolved`), not
 * reference data, so the picker is built from `HAZARD_STATUSES`; severity and barangay
 * filters come from `reference/get.php` as usual (FR-REF-2).
 *
 * Reopening a resolved hazard is supported by the endpoint (it only stamps
 * `resolved_at` when moving TO resolved, and never clears it), so the server keeps a
 * stale resolution timestamp on a reopened record - surfaced in the confirm copy
 * rather than hidden.
 *
 * FR-HAZ-3 gets its own panel at the bottom rather than a filter above: it is a different
 * endpoint (`get_nearby.php`), it takes a point and a radius instead of the list's filters,
 * and it is the only one of the two that reports how far away each hazard is.
 */
export default function Hazards() {
  const { barangays, severityLevels } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('all');
  const [severity, setSeverity] = useState('');
  const [barangay, setBarangay] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [probe, setProbe] = useState(null);
  const [probeRadius, setProbeRadius] = useState(DEFAULT_RADIUS_METERS);
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.hazards({ tab, severity, barangay }),
    queryFn: async ({ signal }) =>
      (await hazardsApi.list(
        {
          status: tab === 'all' ? undefined : tab,
          severity: severity || undefined,
          barangay: barangay || undefined,
        },
        { signal }
      )).items.map(readHazard),
    retry: 1,
  });

  const rows = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return (listQuery.data || []).filter((hazard) => {
      if (!term) return true;
      return [hazard.locationName, hazard.barangay, hazard.description, hazard.hazardType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [listQuery.data, debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil(rows.length / COMPANY_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * COMPANY_PAGE_SIZE, page * COMPANY_PAGE_SIZE);

  const statusMutation = useMutation({
    mutationFn: ({ hazardId, status }) => hazardsApi.updateStatus({ hazard_id: hazardId, status }),
    onSuccess: (_result, variables) => {
      toast.success(`Hazard moved to ${humanize(variables.status)}.`, { title: 'Status updated' });
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.hazards({}) });
      // The map layer and the risk query read the same table.
      queryClient.invalidateQueries({ queryKey: ['company-outages'] });
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The hazard status could not be changed.'), {
        title: 'Update failed',
      });
    },
  });

  const mapped = useMemo(
    () => rows.filter((hazard) => Number.isFinite(hazard.lat) && Number.isFinite(hazard.lng)),
    [rows]
  );

  /**
   * FR-HAZ-3 - `electrical_hazard/get_nearby.php` around a point the user picks.
   *
   * A separate request from the list above because this endpoint returns `distance` per
   * row, which is what makes the answer useful ("which of these is closest to the crew"),
   * and because it re-reads the radius the picker was last set to. Results are ordered
   * by that distance rather than by the list's own ordering.
   */
  const nearbyQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.hazards({ nearby: probe, radius: probeRadius }),
    queryFn: async ({ signal }) =>
      (await hazardsApi.getNearby({ ...probe, radius: probeRadius }, { signal })).items.map(readHazard),
    enabled: Boolean(probe),
    retry: 1,
  });

  const nearby = useMemo(() => {
    const list = nearbyQuery.data || [];
    if (!probe || !hasCoordinates(probe.lat, probe.lng)) return list;
    // `get_nearby.php` supplies `distance`; `withDistance` fills it in when it does not,
    // so a row is never shown with an unknown distance. Nearest first is the useful order
    // for a crew deciding where to go.
    return list
      .map((hazard) => withDistance(hazard, probe))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [nearbyQuery.data, probe]);

  const nearbyPoints = useMemo(
    () => nearby.filter((hazard) => Number.isFinite(hazard.lat) && Number.isFinite(hazard.lng)),
    [nearby]
  );

  // The hazard map keeps showing the list; picking a point only feeds the lookup panel.
  const probeMap =
    !probe || !hasCoordinates(probe.lat, probe.lng) ? null : (
      <AppMap zoom={15} className="h-full w-full">
        <MapView center={probe} />
        <FitPoints items={nearbyPoints} />
        <MapPoints items={nearbyPoints} toneFor={() => 'danger'} glyphFor={() => 'H'}>
          {(hazard) => (
            <div className="min-w-[12rem]">
              <p className="font-bold text-navy-900">
                {hazard.locationName || hazard.barangay || 'Electrical hazard'}
              </p>
              <p className="mt-0.5 text-xs text-navy-500">
                {[hazard.barangay, hazard.distance ? formatDistance(hazard.distance) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {hazard.severity ? (
                <Badge tone={severityTone(hazard.severity)} size="sm" className="mt-2">
                  {humanize(hazard.severity)}
                </Badge>
              ) : null}
            </div>
          )}
        </MapPoints>
        <MapCircle center={probe} radius={probeRadius} color="#2563EB" fillOpacity={0.06} />
        <MapPinMarker position={probe} tone="primary">
          <p className="font-bold text-navy-900">Search centre</p>
          <p className="mt-0.5 text-xs text-navy-500">
            {probe.lat.toFixed(5)}, {probe.lng.toFixed(5)}
          </p>
        </MapPinMarker>
        <MapLegend
          title="Distance"
          items={
            nearbyPoints.length
              ? nearbyPoints.slice(0, 5).map((hazard, index) => ({
                  label: hazard.distance ? formatDistance(hazard.distance) : `Result ${index + 1}`,
                  tone: index === 0 ? 'danger' : index < 3 ? 'warning' : 'neutral',
                }))
              : [{ label: 'Nothing in range', tone: 'neutral' }]
          }
        />
      </AppMap>
    );

  const hazardMap =
    mapped.length === 0 ? (
      <p className="h-full overflow-y-auto p-8 text-center text-sm text-navy-500">
        {listQuery.isLoading
          ? 'Loading hazards…'
          : 'No hazard matching these filters carries coordinates yet.'}
      </p>
    ) : (
      <AppMap zoom={12} className="h-full w-full">
        <FitPoints items={mapped} />
        <MapPoints
          items={mapped}
          toneFor={(hazard) =>
            ['critical', 'high'].includes(String(hazard.severity).toLowerCase())
              ? 'danger'
              : String(hazard.severity).toLowerCase() === 'moderate'
                ? 'warning'
                : 'success'
          }
          glyphFor={() => 'H'}
        >
          {(hazard) => (
            <div className="min-w-[13rem]">
              <p className="font-bold text-navy-900">
                {hazard.locationName || hazard.barangay || 'Electrical hazard'}
              </p>
              <p className="mt-0.5 text-xs text-navy-500">
                {[humanize(hazard.hazardType, 'Hazard'), hazard.barangay].filter(Boolean).join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {hazard.severity ? (
                  <Badge tone={severityTone(hazard.severity)} size="sm">
                    {humanize(hazard.severity)}
                  </Badge>
                ) : null}
                {hazard.status ? (
                  <Badge tone={statusTone(hazard.status)} size="sm">
                    {humanize(hazard.status)}
                  </Badge>
                ) : null}
              </div>
            </div>
          )}
        </MapPoints>
        <MapLegend
          title="Severity"
          items={[
            { label: 'Critical / high', tone: 'danger' },
            { label: 'Moderate', tone: 'warning' },
            { label: 'Low', tone: 'success' },
          ]}
        />
      </AppMap>
    );

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hazard Review"
        description="Triage the electrical hazards residents reported and confirm or close them."
      />

      <Tabs
        tabs={TABS}
        value={tab}
        onChange={(value) => {
          setTab(value);
          resetPage();
        }}
        ariaLabel="Hazard status"
      />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-4">
          <Input
            label="Search"
            type="search"
            placeholder="Location, type or description"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
          />
          <Select
            label="Severity"
            options={severityLevels}
            placeholder="All severities"
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value);
              resetPage();
            }}
          />
          <Select
            label="Barangay"
            options={barangays}
            placeholder="All barangays"
            value={barangay}
            onChange={(event) => {
              setBarangay(event.target.value);
              resetPage();
            }}
          />
        </CardBody>
      </Card>

      <MapWorkspace
        map={hazardMap}
        mapTitle="Hazard map"
        mapDescription={`${mapped.length} of ${rows.length} hazard${rows.length === 1 ? '' : 's'} plotted.`}
      >
        <DataView
          isLoading={listQuery.isLoading}
          error={listQuery.isError}
          onRetry={() => listQuery.refetch()}
          loadingLabel="Loading hazards…"
          items={pageRows}
          empty={{
            icon: ShieldCheck,
            title: 'No hazards here',
            description:
              'Nothing matching these filters. Electrical hazards reported by residents appear in this list.',
          }}
          renderCard={(hazard) => {
            const action = STATUS_ACTIONS[String(hazard.status ?? '').toLowerCase()];
            return (
              <RecordCard
                icon={AlertTriangle}
                iconTone={severityTone(hazard.severity)}
                title={hazard.locationName || hazard.barangay || 'Electrical hazard'}
                subtitle={[
                  humanize(hazard.hazardType, 'Hazard'),
                  hazard.barangay,
                  `reported ${formatRelativeTime(hazard.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                badges={[
                  hazard.severity
                    ? { label: humanize(hazard.severity), tone: severityTone(hazard.severity) }
                    : null,
                  hazard.status ? { label: humanize(hazard.status), tone: statusTone(hazard.status) } : null,
                ]}
                description={hazard.description}
                meta={[{ label: 'Reported', value: formatDateTime(hazard.createdAt) }]}
                actions={
                  action ? (
                    <Button
                      size="sm"
                      variant={action.tone}
                      icon={action.icon}
                      loading={statusMutation.isPending && statusMutation.variables?.hazardId === hazard.id}
                      onClick={() =>
                        statusMutation.mutate({ hazardId: hazard.id, status: action.value })
                      }
                    >
                      {action.label}
                    </Button>
                  ) : null
                }
              >
                {hazard.image ? (
                  <a
                    href={resolveImageUrl(hazard.image)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block"
                  >
                    <img
                      src={resolveImageUrl(hazard.image)}
                      alt="Hazard evidence"
                      loading="lazy"
                      className="h-32 w-full rounded-control border border-navy-100 object-cover"
                    />
                  </a>
                ) : null}
              </RecordCard>
            );
          }}
          renderTable={(visible) => (
            <div className="rounded-card border border-navy-100 bg-white shadow-card">
              <Table>
                <THead>
                  <tr>
                    <TH>Location</TH>
                    <TH>Barangay</TH>
                    <TH>Type</TH>
                    <TH>Severity</TH>
                    <TH>Status</TH>
                    <TH>Reported</TH>
                    <TH align="right">Action</TH>
                  </tr>
                </THead>
                <TBody>
                  {visible.map((hazard) => {
                    const action = STATUS_ACTIONS[String(hazard.status ?? '').toLowerCase()];
                    return (
                      <TR key={hazard.id}>
                        <TD>
                          <span className="font-semibold text-navy-900">
                            {hazard.locationName || 'Unspecified'}
                          </span>
                          {hazard.description ? (
                            <p className="mt-0.5 max-w-xs truncate text-xs text-navy-500">
                              {hazard.description}
                            </p>
                          ) : null}
                        </TD>
                        <TD className="text-sm">{hazard.barangay || '—'}</TD>
                        <TD className="text-sm">{humanize(hazard.hazardType, '—')}</TD>
                        <TD>
                          <Badge tone={severityTone(hazard.severity)}>
                            {humanize(hazard.severity, '—')}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge tone={statusTone(hazard.status)}>{humanize(hazard.status, '—')}</Badge>
                        </TD>
                        <TD className="whitespace-nowrap text-xs text-navy-500">
                          {formatDateTime(hazard.createdAt)}
                        </TD>
                        <TD align="right">
                          {action ? (
                            <Button
                              size="sm"
                              variant={action.tone}
                              icon={action.icon}
                              loading={statusMutation.isPending && statusMutation.variables?.hazardId === hazard.id}
                              onClick={() =>
                                statusMutation.mutate({ hazardId: hazard.id, status: action.value })
                              }
                            >
                              {action.label}
                            </Button>
                          ) : (
                            <span className="text-xs text-navy-300">No further action</span>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
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

      {/* FR-HAZ-3 - the point/radius lookup, kept out of the filter card above because
          it is a separate endpoint with its own answer rather than a filter on the list. */}
      <Card>
        <CardHeader description="electrical_hazard/get_nearby.php around any point, nearest first.">
          <span className="inline-flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Hazards near a point
          </span>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-3">
              <MapPicker
                label="Pick a centre point"
                value={probe}
                onChange={setProbe}
                height="h-56"
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-navy-600">Radius</span>
                {RADIUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProbeRadius(option.value)}
                    aria-pressed={probeRadius === option.value}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                      probeRadius === option.value
                        ? 'border-primary-400 bg-primary-100 text-primary-800'
                        : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                {probe ? (
                  <Button size="sm" variant="ghost" onClick={() => setProbe(null)}>
                    Clear point
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              {/* `h-72` rather than `h-full`: this map sits in a normal flow card, not in
                  `MapWorkspace`'s fixed-height pane, so it needs its own height. */}
              {probe ? (
                <div className="h-72 w-full overflow-hidden rounded-card border border-navy-200">
                  {probeMap}
                </div>
              ) : null}
              {!probe ? (
                <p className="text-sm text-navy-500">
                  Pick a point on the map to search for hazards around it. The lookup is a
                  separate call from the list, so it ignores the filters above.
                </p>
              ) : nearbyQuery.isLoading ? (
                <LoadingState label="Checking nearby hazards…" />
              ) : nearbyQuery.isError ? (
                <InfoNote>
                  {toUserMessage(nearbyQuery.error, 'The nearby hazard lookup failed.')}{' '}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => nearbyQuery.refetch()}
                  >
                    Try again
                  </button>
                  .
                </InfoNote>
              ) : nearby.length === 0 ? (
                <p className="text-sm text-navy-500">
                  No hazards within {formatDistance(probeRadius)} of that point.
                </p>
              ) : (
                <>
                  <p className="text-xs text-navy-500">
                    {nearby.length} hazard{nearby.length === 1 ? '' : 's'} within{' '}
                    {formatDistance(probeRadius)}, nearest first.
                  </p>
                  <ul className="space-y-2">
                    {nearby.slice(0, 8).map((hazard) => (
                      <li key={hazard.id} className="rounded-control border border-navy-100 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-navy-900">
                            {hazard.locationName || hazard.barangay || 'Electrical hazard'}
                          </p>
                          <span className="shrink-0 text-xs font-semibold text-navy-600">
                            {hazard.distance === null ? '—' : formatDistance(hazard.distance)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-navy-500">
                          {[
                            humanize(hazard.hazardType, 'Hazard'),
                            hazard.barangay,
                            `reported ${formatRelativeTime(hazard.createdAt)}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {hazard.severity ? (
                            <Badge tone={severityTone(hazard.severity)} size="sm">
                              {humanize(hazard.severity)}
                            </Badge>
                          ) : null}
                          {hazard.status ? (
                            <Badge tone={statusTone(hazard.status)} size="sm">
                              {humanize(hazard.status)}
                            </Badge>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {nearby.length > 8 ? (
                    <p className="text-xs text-navy-400">
                      Showing the 8 closest of {nearby.length}. Narrow the radius to see fewer.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <InfoNote>
            This endpoint has no status filter and drops the image proof from each row, so it is
            a situational aid for dispatching a crew. Confirming or closing a hazard still
            happens on the list above.
          </InfoNote>
        </CardBody>
      </Card>

      <p className="text-xs text-navy-400">
        Statuses are the database enum: {HAZARD_STATUSES.map((value) => humanize(value)).join(', ')}.
        Reopening a resolved hazard does not clear its stored resolution timestamp.
      </p>
    </div>
  );
}
