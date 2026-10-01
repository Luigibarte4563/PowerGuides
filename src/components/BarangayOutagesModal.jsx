import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpDown, MapPin, Zap } from 'lucide-react';
import Modal from './ui/Modal';
import Badge from './ui/Badge';
import { Button } from './ui/Button';
import { TBody, TD, TH, THead, TR, Table } from './ui/Table';
import DataView from './DataView';
import StatusChangeDialog from './StatusChangeDialog';
import { companyOutagesApi } from '@/api';
import { useCompanyOutageList } from '@/hooks/useCompanyOutages';
import { useToast } from '@/context/ToastContext';
import { severityTone, statusTone, COMPANY_QUERY_KEYS } from '@/utils/constants';
import { formatDateTime, formatNumber, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';

/**
 * The outage reports inside one assigned barangay, in a dialog.
 *
 * Opened from "My Assigned Barangays" so a lineman can see what they are covering without
 * leaving the page - previously this was a link to the company outage list, which threw
 * away the barangay they had just picked and put them in a screen full of other reports.
 *
 * The data comes from `outage/get.php?barangay=<name>`, which is the right endpoint for
 * two reasons: it admits `lineman`, and `lineman_scope_sql()` already restricts it to the
 * caller's ACTIVE assignments. That second point is what makes the dialog safe - the
 * barangay name here comes from `my.php`, but even a tampered one cannot widen the result,
 * because the scope predicate is ANDed with the barangay filter server side. An assigned
 * barangay with no reports simply comes back empty.
 *
 * `enabled` waits for the dialog to be open and a name to exist, so nothing is fetched
 * until the lineman actually asks for a barangay.
 *
 * The lineman can also move a report's status from here. That writes through
 * `outage_report_electric_com/update_single.php`, whose `require_outage_access()` check
 * re-applies the same assignment scope as the read above - so the dialog cannot be used to
 * change a report outside the lineman's barangays, even though it was reached from a list
 * that was already scoped.
 */
export default function BarangayOutagesModal({ open, barangayName, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusTarget, setStatusTarget] = useState(null);

  const query = useCompanyOutageList(
    { scope: 'raw', barangay: barangayName },
    { enabled: open && Boolean(barangayName) }
  );

  const reports = useMemo(() => query.data || [], [query.data]);

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }) => companyOutagesApi.updateSingle({ id, status: nextStatus }),
    onSuccess: (_result, variables) => {
      toast.success(`Report moved to ${humanize(variables.nextStatus)}.`, {
        title: 'Status updated',
      });
      setStatusTarget(null);
      // The whole outage cache goes, so this dialog, the company list and the Overview
      // cards cannot disagree about what status this report is in.
      queryClient.invalidateQueries({ queryKey: ['company-outages'] });
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.summary });
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The status could not be changed.'), {
        title: 'Update failed',
      });
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Outage reports"
      description={
        barangayName
          ? `${barangayName} - reports you can view and work on in this barangay.`
          : undefined
      }
    >
      <DataView
        isLoading={query.isLoading}
        error={query.isError}
        onRetry={() => query.refetch()}
        loadingLabel="Loading outage reports…"
        items={reports}
        empty={{
          icon: Zap,
          title: 'No outage reports here.',
          description: `There are no outage reports in ${barangayName || 'this barangay'} right now.`,
        }}
        renderCard={(report) => (
          <div className="rounded-card border border-navy-100 bg-white p-4 shadow-card dark:border-navy-700 dark:bg-navy-800">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm font-bold text-navy-900 dark:text-white">
                {report.location_name || 'Unnamed location'}
              </p>
              <Badge tone={statusTone(report.status)}>{humanize(report.status)}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={severityTone(report.severity)}>{humanize(report.severity)}</Badge>
              <Badge tone="info">{humanize(report.category)}</Badge>
              <Badge tone="neutral">{humanize(report.hazard_type)}</Badge>
            </div>
            <p className="mt-2 text-xs text-navy-500 dark:text-navy-400">
              Reported {formatDateTime(report.created_at)}
              {report.affected_houses ? ` - ${formatNumber(report.affected_houses)} houses affected` : ''}
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                icon={ArrowUpDown}
                onClick={() => setStatusTarget(report)}
                aria-label={`Change status for ${report.location_name}`}
              >
                Change status
              </Button>
            </div>
          </div>
        )}
        renderTable={(visible) => (
          <div className="overflow-hidden rounded-card border border-navy-100 dark:border-navy-700">
            <Table>
              <THead>
                <tr>
                  <TH>Location</TH>
                  <TH>Status</TH>
                  <TH>Severity</TH>
                  <TH>Category</TH>
                  <TH>Hazard</TH>
                  <TH>Houses</TH>
                  <TH>Reported</TH>
                  <TH align="right">Action</TH>
                </tr>
              </THead>
              <TBody>
                {visible.map((report) => (
                  <TR key={report.id}>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-navy-900 dark:text-white">
                        <MapPin className="h-3.5 w-3.5 text-navy-400" aria-hidden="true" />
                        {report.location_name || 'Unnamed location'}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone={statusTone(report.status)}>{humanize(report.status)}</Badge>
                    </TD>
                    <TD>
                      <Badge tone={severityTone(report.severity)}>{humanize(report.severity)}</Badge>
                    </TD>
                    <TD className="text-sm text-navy-600 dark:text-navy-300">
                      {humanize(report.category)}
                    </TD>
                    <TD className="text-sm text-navy-600 dark:text-navy-300">
                      {humanize(report.hazard_type)}
                    </TD>
                    <TD className="text-sm text-navy-600 dark:text-navy-300">
                      {report.affected_houses ? formatNumber(report.affected_houses) : '-'}
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-navy-500 dark:text-navy-400">
                      {formatDateTime(report.created_at)}
                    </TD>
                    <TD align="right">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={ArrowUpDown}
                        onClick={() => setStatusTarget(report)}
                        aria-label={`Change status for ${report.location_name}`}
                      >
                        Change
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      />

      {/*
        A count the lineman did not have to leave the page to get. Rendered outside
        DataView so it survives the loading/empty branches above.
      */}
      {!query.isLoading && !query.isError && reports.length > 0 ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-navy-500 dark:text-navy-400">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {reports.length} report{reports.length === 1 ? '' : 's'} in {barangayName}. These are
          the reports your assignment covers.
        </p>
      ) : null}

      <StatusChangeDialog
        open={Boolean(statusTarget)}
        reportLabel={statusTarget?.location_name}
        currentStatus={statusTarget?.status}
        onClose={() => setStatusTarget(null)}
        onSubmit={(nextStatus) =>
          statusMutation.mutateAsync({ id: statusTarget.id, nextStatus })
        }
        loading={statusMutation.isPending}
      />
    </Modal>
  );
}