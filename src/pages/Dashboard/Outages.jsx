import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarClock, Eye, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import AppMap, {
  FitPoints,
  MapLegend,
  MapPin as MapPinMarker,
  MapPoints,
  RadiusCircle,
} from '@/components/Map';
import MapWorkspace from '@/components/MapWorkspace';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import { outagesApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { isOwnedBy, readOutage, withDistance } from '@/utils/records';
import {
  DEFAULT_RADIUS_METERS,
  RADIUS_OPTIONS,
  severityTone,
  statusTone,
} from '@/utils/constants';
import { formatDateTime, formatDistance, formatRelativeTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import OutageFormModal from './components/OutageFormModal';

/**
 * Module B - outage reports.
 *
 * `get_active.php` / `get_resolve.php` only return COUNTS, so the Active and Resolved
 * tabs filter `get.php` by `status` instead. `get.php` rows carry no user id, so
 * ownership is resolved by intersecting the ids with `get_my_report.php` - and
 * `get_detail.php` returns 403 for reports you do not own, so the detail link is only
 * offered on your own reports.
 *
 * The map view plots the same rows the list view shows (`get.php` returns
 * `latitude`/`longitude`), so no dedicated geo endpoint is needed; distance from
 * the saved location is computed client-side with `withDistance`.
 */
const TABS = [
  { value: 'all', label: 'All', icon: Zap },
  { value: 'active', label: 'Active', icon: Zap },
  { value: 'resolved', label: 'Resolved', icon: CalendarClock },
  { value: 'mine', label: 'My Reports', icon: Eye },
];

const SEVERITY_LEGEND = [
  { label: 'Critical / high', tone: 'danger' },
  { label: 'Moderate', tone: 'warning' },
  { label: 'Low / minor', tone: 'success' },
  { label: 'Not rated', tone: 'neutral' },
];

export default function Outages() {
  const { outageCategories, statuses } = useReference();
  const { coords, hasLocation } = useSavedLocation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('tab') || 'all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  // Quick actions from the overview open the create modal (?new=1).
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filters = useMemo(
    () => ({
      status: tab === 'active' ? 'active' : tab === 'resolved' ? 'resolved' : statusFilter || undefined,
      category: categoryFilter || undefined,
    }),
    [tab, statusFilter, categoryFilter]
  );

  const listQuery = useQuery({
    queryKey: QUERY_KEYS.outages({ tab, ...filters }),
    queryFn: async ({ signal }) => {
      if (tab === 'mine') return (await outagesApi.getMyReports({}, { signal })).items;
      return (await outagesApi.list(filters, { signal })).items;
    },
    retry: 1,
  });

  // Ownership set (rows from get.php have no user_id).
  const myReportsQuery = useQuery({
    queryKey: QUERY_KEYS.outages({ scope: 'mine-ids' }),
    queryFn: async ({ signal }) => {
      const { items } = await outagesApi.getMyReports({}, { signal });
      return items.map((item) => readOutage(item).id);
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
  const myIds = myReportsQuery.data || [];

  const items = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return (listQuery.data || [])
      .map(readOutage)
      .filter((outage) => {
        if (!term) return true;
        return [outage.locationName, outage.barangay, outage.description, outage.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [listQuery.data, debouncedSearch]);

  // Rows the map can plot, with a client-side distance when a location is saved.
  const mapped = useMemo(
    () =>
      items
        .filter((outage) => Number.isFinite(outage.lat) && Number.isFinite(outage.lng))
        .map((outage) => withDistance(outage, coords)),
    [items, coords]
  );

  const plotted = useMemo(() => {
    if (!hasLocation) return mapped;
    return mapped.filter(
      (outage) => !Number.isFinite(outage.distance) || outage.distance <= Number(radius)
    );
  }, [mapped, hasLocation, radius]);

  const unlocatedCount = items.length - mapped.length;

  const mapSummary =
    mapped.length === 0
      ? 'None of the reports matching your filters carry coordinates yet.'
      : `${plotted.length} of ${mapped.length} located report${mapped.length === 1 ? '' : 's'} plotted${
          hasLocation ? ` within ${formatDistance(radius)} of you` : ''
        }.`;

  const outageMap =
    mapped.length === 0 ? (
      <p className="h-full overflow-y-auto p-8 text-center text-sm text-navy-500">
        {listQuery.isLoading
          ? 'Loading outage reports…'
          : 'No outage reports with coordinates match your filters. Reports appear here once they are pinned to a location.'}
      </p>
    ) : (
      <AppMap zoom={13} className="h-full w-full">
        {/* No explicit centre: <FitPoints> owns the viewport so the map frames the
            plotted reports rather than just the saved point. */}
        <FitPoints items={plotted.length ? plotted : mapped} />
        {hasLocation ? <RadiusCircle center={coords} radius={radius} /> : null}
        <MapPoints
          items={plotted}
          toneFor={(outage) => (outage.severity ? severityTone(outage.severity) : 'neutral')}
        >
          {(outage) => {
            const owned = isOwnedBy(outage, null, { myIds });
            return (
              <div className="min-w-[13rem]">
                <p className="font-bold text-navy-900">
                  {outage.locationName || outage.barangay || 'Outage report'}
                </p>
                {outage.reportKey ? (
                  <p className="mt-0.5 text-xs text-navy-400">{outage.reportKey}</p>
                ) : null}
                <p className="mt-1 text-xs text-navy-600">{outage.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {outage.severity ? (
                    <Badge tone={severityTone(outage.severity)} size="sm">
                      {humanize(outage.severity)}
                    </Badge>
                  ) : null}
                  {outage.status ? (
                    <Badge tone={statusTone(outage.status)} size="sm">
                      {humanize(outage.status)}
                    </Badge>
                  ) : null}
                  {Number.isFinite(outage.distance) ? (
                    <Badge tone="neutral" size="sm">
                      {formatDistance(outage.distance)} away
                    </Badge>
                  ) : null}
                </div>
                {owned ? (
                  <Link
                    to={`/dashboard/outages/${outage.id}`}
                    className="mt-2 inline-block text-xs font-semibold text-primary-700 hover:text-primary-800"
                  >
                    View report →
                  </Link>
                ) : null}
              </div>
            );
          }}
        </MapPoints>
        {hasLocation ? (
          <MapPinMarker position={coords} tone="success" size={32}>
            <p className="text-xs font-semibold text-navy-700">Your saved location</p>
          </MapPinMarker>
        ) : null}
        <MapLegend
          title="Severity"
          items={[
            ...SEVERITY_LEGEND,
            ...(hasLocation ? [{ label: 'Your location', tone: 'success' }] : []),
          ]}
        />
      </AppMap>
    );

  const counts = useQuery({
    queryKey: QUERY_KEYS.outages({ scope: 'counts' }),
    queryFn: async ({ signal }) => {
      const [active, resolved] = await Promise.all([
        outagesApi.getActive({}, { signal }),
        outagesApi.getResolved({}, { signal }),
      ]);
      return { active: active.count, resolved: resolved.count };
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => outagesApi.remove(id),
    onSuccess: () => {
      toast.success('Your report was cancelled.', { title: 'Cancelled' });
      queryClient.invalidateQueries({ queryKey: ['outages'] });
      setDeleting(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (outage) => {
    setEditing(outage);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outage Reports"
        description="Report power outages and follow them until they are resolved."
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            Report Outage
          </Button>
        }
      />

      <Tabs
        tabs={TABS.map((item) => {
          if (item.value === 'active') return { ...item, count: counts.data?.active };
          if (item.value === 'resolved') return { ...item, count: counts.data?.resolved };
          if (item.value === 'mine') return { ...item, count: myIds.length };
          return item;
        })}
        value={tab}
        onChange={setTab}
        ariaLabel="Outage report filters"
      />

      <MapWorkspace
        map={outageMap}
        mapTitle="Outage map"
        mapDescription={mapSummary}
        mapFooter={
          hasLocation ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-navy-600">Radius</span>
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
          ) : unlocatedCount > 0 ? (
            <p className="text-xs text-navy-500">
              {unlocatedCount} report{unlocatedCount === 1 ? '' : 's'} in this list{' '}
              {unlocatedCount === 1 ? 'has' : 'have'} no coordinates, so{' '}
              {unlocatedCount === 1 ? 'it is' : 'they are'} listed but not plotted.
            </p>
          ) : null
        }
      >
        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Search"
              placeholder="Search locations and descriptions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              label="Status"
              placeholder="All statuses"
              options={statuses}
              value={tab === 'all' || tab === 'mine' ? statusFilter : ''}
              onChange={(event) => setStatusFilter(event.target.value)}
              disabled={tab === 'active' || tab === 'resolved'}
              hint={tab === 'active' || tab === 'resolved' ? 'Fixed by the selected tab.' : undefined}
            />
            <Select
              label="Category"
              placeholder="All categories"
              options={outageCategories}
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            />
            <div className="flex items-end">
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setCategoryFilter('');
                }}
              >
                Clear filters
              </Button>
            </div>
          </CardBody>
        </Card>

        <DataView
        isLoading={listQuery.isLoading}
        error={listQuery.isError}
        errorMessage={toUserMessage(listQuery.error)}
        onRetry={() => listQuery.refetch()}
        loadingLabel="Loading outage reports…"
        items={items}
        empty={{
          icon: Zap,
          title:
            tab === 'mine'
              ? 'You have not reported any outages yet'
              : tab === 'active'
                ? 'No active outages right now'
                : tab === 'resolved'
                  ? 'No resolved outages yet'
                  : 'No outage reports yet',
          description:
            tab === 'mine'
              ? 'When you report an outage it appears here so you can track it to resolution.'
              : 'Be the first to report what is happening in your area.',
          action: (
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              Report an outage
            </Button>
          ),
        }}
        renderCard={(outage) => {
          const owned = isOwnedBy(outage, null, { myIds });
          return (
            <RecordCard
              to={owned ? `/dashboard/outages/${outage.id}` : undefined}
              icon={Zap}
              iconTone={outage.severity ? severityTone(outage.severity) : 'primary'}
              title={outage.locationName || outage.barangay || 'Outage report'}
              subtitle={`${humanize(outage.category, 'Uncategorised')} · reported ${formatRelativeTime(outage.createdAt)}`}
              badges={[
                outage.severity ? { label: humanize(outage.severity), tone: severityTone(outage.severity) } : null,
                outage.status ? { label: humanize(outage.status), tone: statusTone(outage.status) } : null,
                owned ? { label: 'My report', tone: 'primary' } : null,
              ]}
              description={outage.description}
              meta={[
                { label: 'Reported', value: formatDateTime(outage.createdAt), icon: CalendarClock },
                outage.barangay ? { label: 'Barangay', value: outage.barangay } : null,
              ].filter(Boolean)}
              actions={
                owned ? (
                  <>
                    <Button size="sm" variant="outline" icon={Pencil} onClick={() => openEdit(outage)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      className="text-danger-600"
                      onClick={() => setDeleting(outage)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : null
              }
            />
          );
        }}
        renderTable={(rows) => (
          <div className="rounded-card border border-navy-100 bg-white shadow-card">
            <Table>
              <THead>
                <tr>
                  <TH>Location</TH>
                  <TH>Category</TH>
                  <TH>Severity</TH>
                  <TH>Status</TH>
                  <TH>Reported</TH>
                  <TH align="right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((outage) => {
                  const owned = isOwnedBy(outage, null, { myIds });
                  return (
                    <TR key={outage.id}>
                      <TD>
                        {owned ? (
                          <Link
                            to={`/dashboard/outages/${outage.id}`}
                            className="rounded font-semibold text-navy-900 hover:text-primary-600"
                          >
                            {outage.locationName || outage.barangay || 'Unspecified'}
                          </Link>
                        ) : (
                          <span className="font-semibold text-navy-900">
                            {outage.locationName || outage.barangay || 'Unspecified'}
                          </span>
                        )}
                        <p className="mt-0.5 max-w-xs truncate text-xs text-navy-500">
                          {outage.reportKey ? `${outage.reportKey} · ` : ''}
                          {outage.description || 'No description'}
                        </p>
                      </TD>
                      <TD>{humanize(outage.category, '—')}</TD>
                      <TD>
                        {outage.severity ? (
                          <Badge tone={severityTone(outage.severity)}>{humanize(outage.severity)}</Badge>
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD>
                        {outage.status ? (
                          <Badge tone={statusTone(outage.status)}>{humanize(outage.status)}</Badge>
                        ) : (
                          '—'
                        )}
                        {owned ? (
                          <Badge tone="primary" className="ml-1">
                            Mine
                          </Badge>
                        ) : null}
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-navy-500">
                        {formatDateTime(outage.createdAt)}
                      </TD>
                      <TD align="right">
                        {owned ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Pencil}
                              onClick={() => openEdit(outage)}
                              aria-label={`Edit report ${outage.reportKey || outage.id}`}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Trash2}
                              className="text-danger-600"
                              onClick={() => setDeleting(outage)}
                              aria-label={`Cancel report ${outage.reportKey || outage.id}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-navy-300">Read only</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      />
      </MapWorkspace>

      <OutageFormModal
        open={formOpen}
        outage={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Cancel this outage report?"
        description="Your report is withdrawn from the community feed. This cannot be undone."
        confirmLabel="Cancel report"
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}
