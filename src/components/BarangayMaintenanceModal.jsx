import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Wrench } from 'lucide-react';
import Modal from './ui/Modal';
import Badge from './ui/Badge';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { TBody, TD, TH, THead, TR, Table } from './ui/Table';
import DataView from './DataView';
import { maintenanceApi, MAINTAINABLE_STATUSES } from '@/api';
import { readMaintenance } from '@/utils/records';
import { statusTone } from '@/utils/constants';
import { formatDate, formatTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import { useToast } from '@/context/ToastContext';

/**
 * The maintenance schedules covering one assigned barangay, in a dialog.
 *
 * Opened from "My Assigned Barangays" next to "View outages", so a lineman whose
 * assignment says maintenance work can see which schedules touch their barangay without
 * leaving the page.
 *
 * Backed by the SAME endpoint everyone reads (`maintenance/get.php` - residents
 * included): maintenance has no per-assignment scoping on reads, only outage endpoints
 * are scoped through `auth/lineman_access.php`. The barangay filter here is therefore a
 * client-side convenience over a list the lineman can already read in full.
 *
 * Status changes are different: `maintenance/update.php` admits a lineman for STATUS-ONLY
 * updates when an active assignment with work_type 'maintenance' or 'both' covers one of
 * the schedule's barangays. The backend re-checks all of that, so `canChangeStatus` here
 * only hides a button the server would refuse anyway.
 */
export default function BarangayMaintenanceModal({
  open,
  barangayName,
  onClose,
  canChangeStatus = false,
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusTarget, setStatusTarget] = useState(null);
  const [nextStatus, setNextStatus] = useState('');

  const query = useQuery({
    queryKey: ['barangay-maintenance', barangayName],
    queryFn: ({ signal }) => maintenanceApi.list({}, { signal }),
    enabled: open && Boolean(barangayName),
  });

  const schedules = useMemo(
    () =>
      (query.data?.items || [])
        .map(readMaintenance)
        .filter((schedule) =>
          schedule.locations.some(
            (location) => location.barangay === barangayName
          )
        ),
    [query.data, barangayName]
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => maintenanceApi.setStatus(id, status),
    onSuccess: (result) => {
      toast.success(result?.message || 'Maintenance status updated.', {
        title: 'Status updated',
      });
      setStatusTarget(null);
      setNextStatus('');
      queryClient.invalidateQueries({ queryKey: ['barangay-maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['company-maintenance'] });
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The status could not be changed.'), {
        title: 'Update failed',
      });
    },
  });

  const openStatusDialog = (schedule) => {
    setStatusTarget(schedule);
    setNextStatus(schedule.status || '');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Maintenance schedules"
      description={
        barangayName
          ? `${barangayName} - schedules published by the utility that cover this barangay.`
          : undefined
      }
    >
      <DataView
        isLoading={query.isLoading}
        error={query.isError}
        onRetry={() => query.refetch()}
        loadingLabel="Loading maintenance schedules…"
        items={schedules}
        empty={{
          icon: Wrench,
          title: 'No maintenance scheduled here.',
          description: `There are no maintenance schedules covering ${
            barangayName || 'this barangay'
          } right now.`,
        }}
        renderCard={(schedule) => (
          <div className="rounded-card border border-navy-100 bg-white p-4 shadow-card dark:border-navy-700 dark:bg-navy-800">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm font-bold text-navy-900 dark:text-white">
                {schedule.title}
              </p>
              <Badge tone={statusTone(schedule.status)}>{humanize(schedule.status)}</Badge>
            </div>
            <p className="mt-2 text-xs text-navy-500 dark:text-navy-400">
              {formatDate(schedule.date)} · {formatTime(schedule.startTime)} –{' '}
              {formatTime(schedule.endTime)}
              {schedule.company ? ` · posted by ${schedule.company}` : ''}
            </p>
            {schedule.description ? (
              <p className="mt-2 text-sm text-navy-600 dark:text-navy-300">{schedule.description}</p>
            ) : null}
            {canChangeStatus ? (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openStatusDialog(schedule)}
                  aria-label={`Update status of ${schedule.title}`}
                >
                  Update status
                </Button>
              </div>
            ) : null}
          </div>
        )}
        renderTable={(visible) => (
          <div className="overflow-hidden rounded-card border border-navy-100 dark:border-navy-700">
            <Table>
              <THead>
                <tr>
                  <TH>Schedule</TH>
                  <TH>Status</TH>
                  <TH>Window</TH>
                  <TH>Date</TH>
                  <TH>Posted by</TH>
                  <TH align="right">Action</TH>
                </tr>
              </THead>
              <TBody>
                {visible.map((schedule) => (
                  <TR key={schedule.id}>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-navy-900 dark:text-white">
                        <MapPin className="h-3.5 w-3.5 text-navy-400 dark:text-navy-500" aria-hidden="true" />
                        {schedule.title}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone={statusTone(schedule.status)}>{humanize(schedule.status)}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-navy-600 dark:text-navy-300">
                      {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-navy-500 dark:text-navy-400">
                      {formatDate(schedule.date)}
                    </TD>
                    <TD className="text-sm text-navy-500 dark:text-navy-400">
                      {schedule.company || '—'}
                    </TD>
                    <TD align="right">
                      {canChangeStatus ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openStatusDialog(schedule)}
                          aria-label={`Update status of ${schedule.title}`}
                        >
                          Status
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      />

      {!query.isLoading && !query.isError && schedules.length > 0 ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-navy-500 dark:text-navy-400">
          <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          {schedules.length} schedule{schedules.length === 1 ? '' : 's'} cover
          {schedules.length === 1 ? 's' : ''} {barangayName}.{' '}
          {canChangeStatus
            ? 'You can move a status; planning the schedule is an electric company and admin action.'
            : 'Maintenance is read-only - planning it is an electric company and admin action.'}
        </p>
      ) : null}

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        size="sm"
        title="Update status"
        description={statusTarget?.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusTarget(null)} disabled={statusMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={statusMutation.isPending}
              disabled={!nextStatus || nextStatus === statusTarget?.status}
              onClick={() => statusMutation.mutateAsync({ id: statusTarget.id, status: nextStatus })}
            >
              Save status
            </Button>
          </>
        }
      >
        <Select
          label="New status"
          aria-label="New maintenance status"
          required
          options={MAINTAINABLE_STATUSES.map((value) => ({ value, label: humanize(value) }))}
          value={nextStatus}
          onChange={(event) => setNextStatus(event.target.value)}
          error={statusMutation.isError ? toUserMessage(statusMutation.error) : undefined}
          hint="Linemen can move the status only - the schedule itself stays as the company set it."
        />
      </Modal>
    </Modal>
  );
}
