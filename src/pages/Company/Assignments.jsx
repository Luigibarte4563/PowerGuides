import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2, UserCheck } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { linemanAssignmentsApi } from '@/api';
import { useAssignmentList, useInvalidateAssignments } from '@/hooks/useLinemanAssignments';
import { COMPANY_PAGE_SIZE, COMPANY_QUERY_KEYS } from '@/utils/constants';
import { formatDateTime } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import AssignmentFormModal from './components/AssignmentFormModal';

/**
 * Module ASSIGN - lineman to barangay assignments (`/company/assignments`).
 *
 * The whole page is manager-only: `lineman_assignment/{get,create,update,delete,linemen}`
 * all require `electric_company` or `admin`, and `my.php` (the lineman's own view) is a
 * separate screen. A lineman who reaches this URL gets the access notice rather than a
 * list of 403s, which is why `enabled: isManager` keeps the requests off the wire.
 *
 * Assignment rows are the source of truth, not this screen: the backend scopes a
 * lineman's outage endpoints from the same table, so an edit here changes what they can
 * do immediately. Every mutation therefore invalidates the whole `lineman-assignments`
 * prefix, which also refreshes `my.php` for whoever is signed in.
 */
export default function Assignments() {
  const { isManager, role } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const invalidateAssignments = useInvalidateAssignments();

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deactivating, setDeactivating] = useState(null);

  const listQuery = useAssignmentList({ status: status || undefined }, { enabled: isManager });

  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const pageCount = Math.max(1, Math.ceil(rows.length / COMPANY_PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * COMPANY_PAGE_SIZE, page * COMPANY_PAGE_SIZE),
    [rows, page]
  );

  const activeCount = rows.filter((row) => row.status === 'active').length;

  const afterChange = () => {
    invalidateAssignments();
    // A lineman's outage lists are filtered by these rows server-side, so they have to be
    // refetched too or the table would keep showing reports the lineman can no longer open.
    queryClient.invalidateQueries({ queryKey: ['company-outages'] });
    queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.summary });
  };

  const deactivateMutation = useMutation({
    mutationFn: (id) => linemanAssignmentsApi.remove(id),
    onSuccess: (result) => {
      toast.success(result?.message || 'Assignment deactivated.', {
        title: 'Assignment removed',
      });
      setDeactivating(null);
      afterChange();
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The assignment could not be deactivated.'), {
        title: 'Action failed',
      });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (assignment) => {
    setEditing(assignment);
    setFormOpen(true);
  };

  if (!isManager) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Lineman Assignments"
          description="Assign field linemen to the barangays they cover."
        />
        <Card>
          <CardBody>
            <p className="text-sm text-navy-600">
              {role === 'lineman'
                ? 'Your assigned barangays are listed on your own dashboard. Assigning linemen is limited to electric company and admin accounts.'
                : 'Assigning linemen is limited to electric company and admin accounts.'}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lineman Assignments"
        description="Assign field linemen to the barangays they cover. A lineman can only view and work on outage reports in an actively assigned barangay."
        actions={
          isManager ? (
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              Assign a lineman
            </Button>
          ) : null
        }
      />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Status"
            aria-label="Filter assignments by status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            placeholder="All statuses"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setStatus('');
                setPage(1);
              }}
              disabled={!status}
            >
              Clear filters
            </Button>
          </div>
        </CardBody>
      </Card>

      <DataView
        isLoading={listQuery.isLoading}
        error={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        loadingLabel="Loading lineman assignments…"
        items={pageRows}
        empty={{
          icon: UserCheck,
          title: 'No lineman assignments found.',
          description: status
            ? 'No assignment has that status yet.'
            : 'Assign a lineman to a barangay and they will be able to work on the outage reports there.',
          action: status ? null : (
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              Assign a lineman
            </Button>
          ),
        }}
        renderCard={(assignment) => (
          <RecordCard
            icon={UserCheck}
            iconTone={assignment.status === 'active' ? 'success' : 'neutral'}
            title={assignment.linemanName || 'Unknown lineman'}
            subtitle={assignment.barangayName || '—'}
            badges={[
              {
                label: assignment.status === 'active' ? 'Active' : 'Inactive',
                tone: assignment.status === 'active' ? 'success' : 'neutral',
              },
            ]}
            meta={[
              { label: 'Assigned', value: formatDateTime(assignment.assignedAt) },
              assignment.assignedByName
                ? { label: 'By', value: assignment.assignedByName }
                : null,
            ].filter(Boolean)}
            actions={
              <>
                <Button size="sm" variant="outline" icon={Pencil} onClick={() => openEdit(assignment)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  className="text-danger-600"
                  onClick={() => setDeactivating(assignment)}
                  disabled={assignment.status !== 'active'}
                >
                  Remove
                </Button>
              </>
            }
          />
        )}
        renderTable={(visible) => (
          <div className="rounded-card border border-navy-100 bg-white shadow-card">
            <Table>
              <THead>
                <tr>
                  <TH>Lineman</TH>
                  <TH>Barangay</TH>
                  <TH>Status</TH>
                  <TH>Assigned Date</TH>
                  <TH>Assigned By</TH>
                  <TH align="right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {visible.map((assignment) => (
                  <TR key={assignment.id}>
                    <TD>
                      <span className="font-semibold text-navy-900">
                        {assignment.linemanName || 'Unknown lineman'}
                      </span>
                      {assignment.linemanEmail ? (
                        <p className="mt-0.5 text-xs text-navy-400">{assignment.linemanEmail}</p>
                      ) : null}
                    </TD>
                    <TD className="text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-navy-400" aria-hidden="true" />
                        {assignment.barangayName || '—'}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone={assignment.status === 'active' ? 'success' : 'neutral'}>
                        {assignment.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-navy-500">
                      {formatDateTime(assignment.assignedAt)}
                    </TD>
                    <TD className="text-sm text-navy-500">
                      {assignment.assignedByName || '—'}
                    </TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Pencil}
                          onClick={() => openEdit(assignment)}
                          aria-label={`Edit assignment of ${assignment.linemanName} to ${assignment.barangayName}`}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          className="text-danger-600"
                          onClick={() => setDeactivating(assignment)}
                          disabled={assignment.status !== 'active'}
                          aria-label={`Remove ${assignment.linemanName} from ${assignment.barangayName}`}
                        >
                          Remove
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
              total={rows.length}
              pageSize={COMPANY_PAGE_SIZE}
              onChange={setPage}
            />
          </div>
        )}
      />

      {rows.length > 0 ? (
        <p className="text-xs text-navy-400">
          {activeCount} active assignment{activeCount === 1 ? '' : 's'} of {rows.length}. Removing
          an assignment takes effect immediately - the lineman loses access to that
          barangay&apos;s outages.
        </p>
      ) : null}

      <AssignmentFormModal
        open={formOpen}
        assignment={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={afterChange}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Remove this assignment?"
        description={
          deactivating
            ? `${deactivating.linemanName} will no longer be able to view or work on outage reports in ${deactivating.barangayName}. The record is kept for history.`
            : ''
        }
        confirmLabel="Remove assignment"
        loading={deactivateMutation.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={async () => {
          await deactivateMutation.mutateAsync(deactivating.id);
        }}
      />
    </div>
  );
}