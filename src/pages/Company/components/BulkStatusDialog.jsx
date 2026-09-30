import { useMemo, useState } from 'react';
import { Building2, Globe2, ShieldAlert } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useReference } from '@/context/ReferenceContext';
import { companyOutagesApi, MANAGEABLE_STATUSES } from '@/api';
import { toUserMessage } from '@/utils/errorMessage';
import { humanize } from '@/utils/formatters';

/**
 * FR-OUT-7 / FR-OUT-8 / FR-OUT-9 - bulk status changes.
 *
 * `update_barangay.php` and `update_dagupan.php` have NO status whitelist - an
 * unrecognised value silently resolves to `active` through `getStatusId()`. So the
 * options are the exact list `update_single.php` enforces, and the confirmation states
 * the scope and the number of rows that will change.
 *
 * The affected count is derived from the reports already on screen, so it is an
 * approximation of what the server will touch: the endpoints apply their update to
 * the whole table (dagupan) or the whole barangay, including rows a filter may have
 * hidden. The copy says "at least" for that reason. `affected` from the response is
 * the authoritative figure and is reported back by the caller.
 */
export default function BulkStatusDialog({
  open,
  scope = 'barangay',
  reports = [],
  onClose,
  onCompleted,
}) {
  const { barangays } = useReference();
  const [barangay, setBarangay] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isCityWide = scope === 'dagupan';
  const affected = useMemo(() => {
    if (isCityWide) return reports.length;
    if (!barangay) return null;
    return reports.filter(
      (report) =>
        String(report?.barangay ?? '').trim().toLowerCase() === barangay.trim().toLowerCase()
    ).length;
  }, [reports, barangay, isCityWide]);

  const canSubmit = Boolean(status) && (isCityWide || Boolean(barangay));

  const reset = () => {
    setBarangay('');
    setStatus('');
    setError('');
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const result = isCityWide
        ? await companyOutagesApi.updateDagupan({ status })
        : await companyOutagesApi.updateBarangay({ barangay: barangay.trim(), status });

      onCompleted?.({
        scope: isCityWide ? 'dagupan' : 'barangay',
        scopeLabel: isCityWide ? 'all of Dagupan City' : barangay.trim(),
        status,
        affected: Number(result?.affected ?? affected ?? 0),
      });
      reset();
      onClose();
    } catch (submitError) {
      setError(toUserMessage(submitError, 'The bulk update could not be completed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : handleClose}
      title={isCityWide ? 'Update every report in Dagupan' : 'Update a whole barangay'}
      description={
        isCityWide
          ? 'This rewrites the status of EVERY outage report in the database, with no barangay filter.'
          : 'This rewrites the status of every outage report in the selected barangay.'
      }
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon={ShieldAlert}
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            {isCityWide ? 'Update all reports' : 'Update barangay'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {isCityWide ? (
          <div className="flex items-start gap-2.5 rounded-control border border-warning-200 bg-warning-50 p-3.5 text-sm text-navy-700">
            <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
            <p>
              City-wide. There is no way to undo this in the app, and it is not limited to the reports
              currently filtered on screen.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-control bg-navy-50 p-3.5 text-sm text-navy-700">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden="true" />
            <p>
              Barangay scope. The name is matched against the barangay list and the reports in it are all
              updated, whether or not they match your current filters.
            </p>
          </div>
        )}

        {!isCityWide ? (
          <Select
            label="Barangay"
            required
            options={barangays}
            placeholder="Select a barangay"
            value={barangay}
            onChange={(event) => setBarangay(event.target.value)}
            disabled={submitting}
          />
        ) : null}

        <Select
          label="New status"
          required
          options={MANAGEABLE_STATUSES}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          disabled={submitting}
          hint="These are the only statuses the API accepts for an update."
        />

        <div className="rounded-control border border-navy-200 bg-canvas p-3.5">
          <p className="text-sm font-semibold text-navy-900">Confirm the scope</p>
          <ul className="mt-2 space-y-1 text-sm text-navy-600">
            <li>
              Scope:{' '}
              <span className="font-semibold">
                {isCityWide ? 'All of Dagupan City' : barangay.trim() || 'No barangay selected'}
              </span>
            </li>
            <li>
              New status:{' '}
              <span className="font-semibold">{status ? humanize(status) : 'Not chosen'}</span>
            </li>
            <li>
              Reports matching your current filters:{' '}
              <span className="font-semibold">
                {isCityWide ? reports.length : affected === null ? '—' : affected}
              </span>
            </li>
          </ul>
          <p className="mt-2 text-xs text-navy-400">
            Reports hidden by the current filters are still updated by the server, so the number it
            reports back after saving may be higher.
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-control bg-danger-50 p-3 text-sm font-medium text-danger-700">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
