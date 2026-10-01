import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { MANAGEABLE_STATUSES } from '@/api';
import { humanize } from '@/utils/formatters';

/**
 * Change one outage report's status, restricted to the whitelisted values.
 *
 * Shared by the company outage list and the "My Assigned Barangays" dialog so both offer
 * exactly the same statuses, the same confirmation step and the same wording. The list is
 * `MANAGEABLE_STATUSES` rather than whatever `reference/get.php` publishes, because it is
 * `update_single.php`'s own server-side whitelist - offering anything else would produce a
 * 400 rather than a status change.
 *
 * The props are deliberately shape-agnostic (`reportLabel` / `currentStatus`) instead of
 * taking a report object: the company page works on normalised camelCase rows while
 * `outage/get.php` returns snake_case, and this dialog has no reason to know either.
 *
 * Changing status writes through `update_single.php`, which on `resolved` also stamps
 * `resolved_at` and clears `is_active`. That is called out in the hint rather than done
 * here, because it is the server's behaviour and not this form's.
 */
export default function StatusChangeDialog({
  open,
  reportLabel,
  currentStatus,
  onSubmit,
  onClose,
  loading = false,
}) {
  const [nextStatus, setNextStatus] = useState('');

  // Reset per report, so reopening for a different report never offers a stale choice.
  useEffect(() => {
    if (!open) setNextStatus('');
  }, [open, reportLabel]);

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title="Change report status"
      size="sm"
      closeOnBackdrop={!loading}
      description={
        open
          ? `Currently ${humanize(currentStatus, 'unset')} - ${reportLabel || 'this report'}.`
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
            disabled={!nextStatus || nextStatus === currentStatus}
          >
            Update status
          </Button>
        </>
      }
    >
      <Select
        label="New status"
        required
        options={MANAGEABLE_STATUSES.map((value) => ({ value, label: humanize(value) }))}
        placeholder="Select a status"
        value={nextStatus}
        onChange={(event) => setNextStatus(event.target.value)}
        disabled={loading}
        hint="Marking a report resolved also clears its active flag on the server."
      />
    </Modal>
  );
}