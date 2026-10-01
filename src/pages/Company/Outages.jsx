import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  Building2,
  CalendarClock,
  Eye,
  Globe2,
  MapPin,
  Search,
  Zap,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Pagination from '@/components/Pagination';
import TruncateText from '@/components/TruncateText';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useCompanyOutageList } from '@/hooks/useCompanyOutages';
import { useMyAssignments } from '@/hooks/useLinemanAssignments';
import { companyOutagesApi, MANAGEABLE_STATUSES } from '@/api';
import { COMPANY_PAGE_SIZE, COMPANY_QUERY_KEYS, severityTone, statusTone } from '@/utils/constants';
import { readCompanyOutage } from '@/utils/records';
import { formatDateTime, formatRelativeTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import BulkStatusDialog from './components/BulkStatusDialog';

const SCOPES = [
  { value: 'scoped', label: 'Company view', icon: Zap },
  { value: 'raw', label: 'All reports (raw)', icon: Eye },
];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'severity', label: 'Highest severity' },
];

/** Severities ordered most to least severe, for the "highest severity" sort. */
const SEVERITY_RANK = { critical: 0, high: 1, moderate: 2, medium: 2, low: 3, minor: 3 };

/**
 * Module OUT - outage report management (FR-OUT-1, FR-OUT-2, FR-OUT-10, FR-OUT-11).
 *
 * Two endpoints sit behind the tab strip:
 *   `scoped` -> `outage_report_electric_com/get.php`, the company list. It filters on
 *               `status`, `severity` and `is_active`.
 *   `raw`    -> `outage/get.php` (FR-OUT-10), the unfiltered staff list. It adds
 *               `report_key` and swaps `active` for `category` / `barangay`.
 * Neither supports a date range, keyword search, sorting or pagination, so search,
 * the date range, the sort and the paging are all client-side over the returned rows.
 * The affected count shown in a bulk confirmation is therefore the count of rows the
 * client can see, and the server's own `affected` is reported back after saving.
 */
export default function Outages() {
  const { isManager, role, isStaff } = useAuth();
  const { statuses, severityLevels, outageCategories, barangays, isLoading: refLoading } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [scope, setScope] = useState('scoped');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [severity, setSeverity] = useState('');
  const [category, setCategory] = useState('');
  const [barangay, setBarangay] = useState('');
  const [assignedBarangay, setAssignedBarangay] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [bulk, setBulk] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  const isRaw = scope === 'raw';

  /*
   * A lineman's scope is set by the BACKEND: both endpoints below already exclude any
   * report in a barangay they are not actively assigned to, so nothing here can widen it.
   *
   * This dropdown is only a convenience over that already-filtered list - it narrows to
   * one of their own assigned barangays, never to another. It reads the same `my.php`
   * rows the server scopes with, so the two cannot disagree. Managers and admins skip
   * the query entirely (`my.php` would answer 403 for them).
   */
  const isLineman = role === 'lineman' && isStaff;
  const myAssignmentsQuery = useMyAssignments({ enabled: isLineman });
  const assignedBarangays = useMemo(
    () =>
      (myAssignmentsQuery.data || []).map((assignment) => ({
        value: String(assignment.barangayId),
        label: assignment.barangayName,
      })),
    [myAssignmentsQuery.data]
  );

  // Keep the status filter in the URL so an Overview summary card can deep-link here.
  useEffect(() => {
    const current = searchParams.get('status') || '';
    if (status === current) return;
    const next = new URLSearchParams(searchParams);
    if (status) next.set('status', status);
    else next.delete('status');
    setSearchParams(next, { replace: true });
  }, [status, searchParams, setSearchParams]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [scope, status, severity, category, barangay, assignedBarangay, debouncedSearch, fromDate, toDate, sort]);

  const listQuery = useCompanyOutageList({
    scope,
    status: status || undefined,
    severity: severity || undefined,
    active: undefined,
    category: isRaw ? category || undefined : undefined,
    barangay: isRaw ? barangay || undefined : undefined,
  });

  const rows = useMemo(() => (listQuery.data || []).map(readCompanyOutage), [listQuery.data]);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    const matches = rows.filter((row) => {
      // Convenience filter over the already-scoped rows. `outage/get.php` takes a
      // barangay NAME and only on the raw tab, and the company endpoint takes none at
      // all, so this matches on the row's own barangay id - which the API now returns.
      if (assignedBarangay && String(row.barangayId) !== assignedBarangay) return false;

      if (term) {
        const haystack = [row.locationName, row.barangay, row.description, row.category, row.reportKey, row.reporter]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
        if (!haystack) return false;
      }

      if (from !== null || to !== null) {
        const stamp = new Date(row.createdAt || 0).getTime();
        if (Number.isNaN(stamp)) return true;
        if (from !== null && stamp < from) return false;
        if (to !== null && stamp > to) return false;
      }
      return true;
    });

    const sorted = [...matches];
    if (sort === 'oldest') {
      sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (sort === 'severity') {
      sorted.sort(
        (a, b) =>
          (SEVERITY_RANK[String(a.severity ?? '').toLowerCase()] ?? 9) -
          (SEVERITY_RANK[String(b.severity ?? '').toLowerCase()] ?? 9)
      );
    } else {
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return sorted;
  }, [rows, debouncedSearch, fromDate, toDate, sort, assignedBarangay]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / COMPANY_PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * COMPANY_PAGE_SIZE, page * COMPANY_PAGE_SIZE);

  const singleMutation = useMutation({
    mutationFn: ({ id, nextStatus }) => companyOutagesApi.updateSingle({ id, status: nextStatus }),
    onSuccess: (_result, variables) => {
      toast.success(`Report moved to ${humanize(variables.nextStatus)}.`, { title: 'Status updated' });
      setStatusTarget(null);
      // FR-OUT-11: the whole outage cache is invalidated so the list, the counts and
      // the Overview cards all agree.
      queryClient.invalidateQueries({ queryKey: ['company-outages'] });
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.summary });
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The status could not be changed.'), { title: 'Update failed' });
    },
  });

  const bulkDone = ({ scopeLabel, status: nextStatus, affected }) => {
    toast.success(`${affected} report${affected === 1 ? '' : 's'} in ${scopeLabel} moved to ${humanize(nextStatus)}.`, {
      title: 'Bulk update complete',
    });
    queryClient.invalidateQueries({ queryKey: ['company-outages'] });
    queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.summary });
  };

  const clearFilters = () => {
    setStatus('');
    setSeverity('');
    setCategory('');
    setBarangay('');
    setAssignedBarangay('');
    setSearch('');
    setFromDate('');
    setToDate('');
    setSort('newest');
  };

  const anyFilter =
    status ||
    severity ||
    category ||
    barangay ||
    assignedBarangay ||
    search ||
    fromDate ||
    toDate ||
    sort !== 'newest';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outage Reports"
        description="Review, verify and update every outage report across Dagupan."
        actions={
          isManager ? (
            <>
              <Button variant="outline" icon={Building2} onClick={() => setBulk('barangay')}>
                Update barangay
              </Button>
              <Button variant="danger" icon={Globe2} onClick={() => setBulk('dagupan')}>
                Update all
              </Button>
            </>
          ) : null
        }
      />

      <Tabs
        tabs={SCOPES}
        value={scope}
        onChange={setScope}
        ariaLabel="Report list scope"
      />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Search"
            placeholder="Location, description, reference"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            label="Status"
            options={statuses}
            placeholder="All statuses"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            loading={refLoading}
          />
          <Select
            label="Severity"
            options={severityLevels}
            placeholder="All severities"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            loading={refLoading}
          />
          {isRaw ? (
            <Select
              label="Category"
              options={outageCategories}
              placeholder="All categories"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              loading={refLoading}
            />
          ) : null}
          {isRaw ? (
            <Select
              label="Barangay"
              options={barangays}
              placeholder="All barangays"
              value={barangay}
              onChange={(event) => setBarangay(event.target.value)}
              loading={refLoading}
            />
          ) : null}
          {isLineman ? (
            <Select
              label="My assigned barangays"
              options={assignedBarangays}
              placeholder="All my assigned barangays"
              value={assignedBarangay}
              onChange={(event) => setAssignedBarangay(event.target.value)}
              loading={myAssignmentsQuery.isLoading}
              hint={
                myAssignmentsQuery.isError
                  ? 'Your assignments could not be loaded, but the list below is still limited by the server.'
                  : 'The server already limits this list to your assigned barangays.'
              }
            />
          ) : null}
          <Input
            label="Reported from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <Input
            label="Reported to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
          <Select
            label="Sort"
            options={SORTS}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          />
          <div className="flex items-end">
            <Button variant="outline" fullWidth onClick={clearFilters} disabled={!anyFilter}>
              Clear filters
            </Button>
          </div>
        </CardBody>
      </Card>

      <DataView
        isLoading={listQuery.isLoading}
        error={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        loadingLabel="Loading outage reports…"
        items={pageRows}
        empty={{
          icon: Search,
          title: anyFilter ? 'No reports match these filters' : 'No outage reports yet',
          description: anyFilter
            ? 'Try widening the date range or clearing a filter.'
            : 'Community outage reports will appear here as soon as they are filed.',
          action: anyFilter ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : null,
        }}
        renderCard={(outage) => (
          <RecordCard
            to={`/company/outages/${outage.id}`}
            icon={Zap}
            iconTone={outage.severity ? severityTone(outage.severity) : 'primary'}
            title={outage.locationName || outage.barangay || 'Unspecified location'}
            subtitle={[outage.barangay, outage.reporter, `reported ${formatRelativeTime(outage.createdAt)}`]
              .filter(Boolean)
              .join(' · ')}
            badges={[
              outage.severity
                ? { label: humanize(outage.severity), tone: severityTone(outage.severity) }
                : null,
              outage.status ? { label: humanize(outage.status), tone: statusTone(outage.status) } : null,
              outage.isVerified ? { label: 'Verified', tone: 'info' } : null,
            ]}
            description={outage.description}
            meta={[
              { label: 'Category', value: humanize(outage.category, 'Uncategorised') },
              outage.affectedHouses
                ? { label: 'Houses affected', value: String(outage.affectedHouses) }
                : null,
              { label: 'Reported', value: formatDateTime(outage.createdAt), icon: CalendarClock },
            ].filter(Boolean)}
            actions={
              <Button size="sm" variant="outline" icon={ArrowUpDown} onClick={() => setStatusTarget(outage)}>
                Change status
              </Button>
            }
          />
        )}
        renderTable={(visible) => (
          <div className="rounded-card border border-navy-100 bg-white shadow-card">
            <Table>
              <THead>
                <tr>
                  <TH>Location</TH>
                  <TH>Barangay</TH>
                  <TH>Category</TH>
                  <TH>Severity</TH>
                  <TH>Status</TH>
                  <TH>Reporter</TH>
                  <TH>Reported</TH>
                  <TH align="right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {visible.map((outage) => (
                  <TR key={outage.id}>
                    <TD>
                      {/* One line, ellipsised, with a "See all" toggle - the longest
                          location in the database is 95 characters, which would otherwise
                          stretch the whole table. The link wraps only the clipped text; the
                          toggle is a sibling, because a <button> inside an <a> is invalid
                          HTML and unreachable by keyboard. */}
                      <TruncateText
                        to={`/company/outages/${outage.id}`}
                        text={outage.locationName || 'Unspecified'}
                      />
                      {outage.reportKey ? (
                        <p className="mt-0.5 text-xs text-navy-400">{outage.reportKey}</p>
                      ) : null}
                    </TD>
                    <TD className="text-sm">{outage.barangay || '—'}</TD>
                    <TD className="text-sm">{humanize(outage.category, '—')}</TD>
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
                      {outage.isVerified ? (
                        <Badge tone="info" className="ml-1">
                          Verified
                        </Badge>
                      ) : null}
                    </TD>
                    <TD className="text-sm text-navy-500">{outage.reporter}</TD>
                    <TD className="whitespace-nowrap text-xs text-navy-500">
                      {formatDateTime(outage.createdAt)}
                    </TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={MapPin}
                          to={`/company/outages/${outage.id}`}
                          aria-label={`Open report ${outage.reportKey || outage.id}`}
                        >
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={ArrowUpDown}
                          onClick={() => setStatusTarget(outage)}
                          aria-label={`Change status of report ${outage.reportKey || outage.id}`}
                        >
                          Status
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={COMPANY_PAGE_SIZE}
              onChange={setPage}
            />
          </div>
        )}
      />

      <p className="text-xs text-navy-400">
        {isRaw
          ? 'Raw view: every report, including reports from any company, with reference keys.'
          : 'Company view: reports visible to the utility. The API returns all matching rows, so search, sorting, the date range and paging happen in your browser.'}
      </p>

      <SingleStatusDialog
        outage={statusTarget}
        onClose={() => setStatusTarget(null)}
        onSubmit={(nextStatus) =>
          singleMutation.mutateAsync({ id: statusTarget.id, nextStatus })
        }
        loading={singleMutation.isPending}
      />

      <BulkStatusDialog
        open={Boolean(bulk)}
        scope={bulk || 'barangay'}
        reports={rows}
        onClose={() => setBulk(null)}
        onCompleted={bulkDone}
      />
    </div>
  );
}

/** FR-OUT-6 - change one report's status, restricted to the whitelisted values. */
function SingleStatusDialog({ outage, onClose, onSubmit, loading }) {
  const [nextStatus, setNextStatus] = useState('');

  useEffect(() => {
    setNextStatus('');
  }, [outage?.id]);

  return (
    <Modal
      open={Boolean(outage)}
      onClose={loading ? undefined : onClose}
      title="Change report status"
      size="sm"
      closeOnBackdrop={!loading}
      description={
        outage
          ? `Currently ${humanize(outage.status, 'unset')} - ${outage.locationName || outage.barangay || 'this report'}.`
          : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(nextStatus)}
            loading={loading}
            disabled={!nextStatus || nextStatus === outage?.status}
          >
            Update status
          </Button>
        </>
      }
    >
      <Select
        label="New status"
        required
        options={MANAGEABLE_STATUSES}
        placeholder="Select a status"
        value={nextStatus}
        onChange={(event) => setNextStatus(event.target.value)}
        disabled={loading}
        hint="Marking a report resolved also clears its active flag on the server."
      />
    </Modal>
  );
}
