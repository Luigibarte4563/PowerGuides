import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Plus, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import AppMap, { FitPoints, MapLegend, MapPoints } from '@/components/Map';
import MapWorkspace from '@/components/MapWorkspace';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import { hazardsApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { isOwnedBy, readHazard } from '@/utils/records';
import { severityTone, statusTone } from '@/utils/constants';
import { formatDateTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import HazardFormModal, { HAZARD_SEVERITY_OPTIONS } from './components/HazardFormModal';
import { HAZARD_STATUSES } from '@/api';

const HAZARD_STATUS_OPTIONS = HAZARD_STATUSES.map((status) => ({ id: status, name: humanize(status) }));

const SEVERITY_LEGEND = [
  { label: 'Low', tone: 'success' },
  { label: 'Moderate', tone: 'warning' },
  { label: 'High', tone: 'danger' },
  { label: 'Critical', tone: 'danger' },
  { label: 'Not rated', tone: 'neutral' },
];

/**
 * Module J - electrical hazards across Dagupan: list, map, create and an
 * owner-only status update.
 *
 * Deliberately NOT radius-scoped. `get_nearby.php` needs a saved location, and a
 * location that geocoded to the wrong country returns an empty list that reads as
 * "no hazards in your area". This page instead always loads the whole city feed
 * from `get.php` (no default filter, no LIMIT) and frames the map on the hazards
 * themselves, so the answer to "are there hazards in Dagupan?" never depends on
 * where the user happens to be.
 */
export default function Hazards() {
  const { user } = useAuth();
  const { hazardTypes } = useReference();
  const { coords } = useSavedLocation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Filters are applied client-side below, so they are kept out of this key -
  // otherwise every keystroke would refetch the same unfiltered city-wide set.
  const listQuery = useQuery({
    queryKey: QUERY_KEYS.hazards({ scope: 'all' }),
    queryFn: async ({ signal }) => (await hazardsApi.list({}, { signal })).items,
    retry: 1,
  });

  const items = (listQuery.data || [])
    .map((record) => readHazard(record))
    .filter((hazard) => {
      if (typeFilter && humanize(hazard.hazardType) !== humanize(typeFilter)) return false;
      if (severityFilter && humanize(hazard.severity) !== humanize(severityFilter)) return false;
      if (statusFilter && hazard.status !== statusFilter) return false;
      const term = debouncedSearch.trim().toLowerCase();
      if (!term) return true;
      return [hazard.hazardType, hazard.description, hazard.locationName, hazard.barangay]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    })
    .sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0));

  // Hazards the map can plot.
  const plotted = useMemo(
    () => items.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    [items]
  );
  const unlocatedCount = items.length - plotted.length;

  const mapSummary =
    plotted.length === 0
      ? 'No hazards with coordinates match your filters yet.'
      : `${plotted.length} hazard${plotted.length === 1 ? '' : 's'} plotted across Dagupan.`;

  const hazardMap = (
    <AppMap zoom={13} className="h-full w-full">
      {/* No explicit centre: FitPoints frames the hazards themselves. */}
      <FitPoints items={plotted} />
      <MapPoints items={plotted} toneFor={(item) => (item.severity ? severityTone(item.severity) : 'neutral')}>
        {(item) => (
          <div className="min-w-[13rem]">
            <p className="font-bold text-navy-900">{item.hazardType || 'Electrical hazard'}</p>
            {item.barangay || item.locationName ? (
              <p className="mt-0.5 text-xs text-navy-500">
                {[item.locationName, item.barangay].filter(Boolean).join(' · ')}
              </p>
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
            </div>
          </div>
        )}
      </MapPoints>
      <MapLegend title="Severity" items={SEVERITY_LEGEND} />
    </AppMap>
  );

  const statusMutation = useMutation({
    mutationFn: ({ hazardId, status }) => hazardsApi.updateStatus({ hazard_id: hazardId, status }),
    onSuccess: () => {
      toast.success('Hazard status updated.', { title: 'Updated' });
      queryClient.invalidateQueries({ queryKey: ['hazards'] });
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      setStatusTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Electrical Hazards"
        description="Downed wires, exposed cables and sparking connections reported by the community."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
            Report Hazard
          </Button>
        }
      />

      <MapWorkspace
        map={hazardMap}
        mapTitle="Hazard map"
        mapDescription={mapSummary}
        mapFooter={
          unlocatedCount > 0 ? (
            <p className="text-xs text-navy-500">
              {unlocatedCount} hazard{unlocatedCount === 1 ? '' : 's'} in this list{' '}
              {unlocatedCount === 1 ? 'has' : 'have'} no coordinates, so{' '}
              {unlocatedCount === 1 ? 'it is' : 'they are'} listed but not plotted.
            </p>
          ) : null
        }
      >

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Input
            label="Search"
            placeholder="Search hazards"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            label="Hazard type"
            placeholder="All types"
            options={hazardTypes}
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          />
          <Select
            label="Severity"
            placeholder="All severities"
            options={HAZARD_SEVERITY_OPTIONS}
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
          />
          <Select
            label="Status"
            placeholder="All statuses"
            options={HAZARD_STATUS_OPTIONS}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setSearch('');
                setTypeFilter('');
                setSeverityFilter('');
                setStatusFilter('');
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
        loadingLabel="Loading electrical hazards…"
        items={items}
        isEmpty={items.length === 0}
        empty={{
          icon: AlertTriangle,
          title: 'No hazards reported for this filter',
          description:
            'That is good news. If you spot a downed wire or exposed cable, please report it so your neighbours know.',
          action: (
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
              Report Hazard
            </Button>
          ),
        }}
        renderCard={(hazard) => {
          const owned = isOwnedBy(hazard.raw, user);
          return (
            <RecordCard
              icon={AlertTriangle}
              iconTone={hazard.severity ? severityTone(hazard.severity) : 'danger'}
              title={hazard.hazardType || 'Electrical hazard'}
              subtitle={hazard.locationName || hazard.barangay || 'No landmark given'}
              badges={[
                hazard.severity ? { label: humanize(hazard.severity), tone: severityTone(hazard.severity) } : null,
                hazard.status ? { label: humanize(hazard.status), tone: statusTone(hazard.status) } : null,
                owned ? { label: 'My report', tone: 'primary' } : null,
              ].filter(Boolean)}
              description={hazard.description}
              meta={[
                hazard.createdAt
                  ? { label: 'Reported', value: formatDateTime(hazard.createdAt), icon: CalendarClock }
                  : null,
              ].filter(Boolean)}
              actions={
                owned ? (
                  <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => setStatusTarget(hazard)}>
                    Update status
                  </Button>
                ) : null
              }
            />
          );
        }}
      />
      </MapWorkspace>

      <HazardFormModal open={formOpen} onClose={() => setFormOpen(false)} defaultLocation={coords} />

      <StatusModal
        hazard={statusTarget}
        loading={statusMutation.isPending}
        onClose={() => setStatusTarget(null)}
        onSubmit={(status) => statusMutation.mutate({ id: statusTarget.id, status })}
      />
    </div>
  );
}

/** Owner-only status update (`electrical_hazard/update_status.php`). */
function StatusModal({ hazard, loading, onClose, onSubmit }) {
  const [status, setStatus] = useState('');

  useEffect(() => {
    setStatus(hazard?.status || '');
  }, [hazard]);

  return (
    <Modal
      open={Boolean(hazard)}
      onClose={onClose}
      title="Update hazard status"
      description={hazard ? 'Let the community know whether this hazard is still a problem.' : ''}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(status)} loading={loading} disabled={!status}>
            Save status
          </Button>
        </>
      }
    >
      <Select
        label="Status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        options={HAZARD_STATUS_OPTIONS}
        placeholder="Select a status"
      />
    </Modal>
  );
}
