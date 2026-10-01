import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import FormModal from '@/components/FormModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { InfoNote } from '@/components/ui/Alert';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import {
  linemanAssignmentsApi,
  ACTIVE_ASSIGNMENT_STATUS,
  INACTIVE_ASSIGNMENT_STATUS,
} from '@/api';
import { useLinemenList } from '@/hooks/useLinemanAssignments';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validateRequired } from '@/utils/validators';

const FIELD_ORDER = ['linemanId', 'barangayId', 'status'];

const EMPTY = {
  linemanId: '',
  barangayId: '',
  status: ACTIVE_ASSIGNMENT_STATUS,
};

function toFormValues(assignment) {
  if (!assignment) return EMPTY;
  return {
    linemanId: String(assignment.linemanId ?? ''),
    barangayId: String(assignment.barangayId ?? ''),
    status: assignment.status || ACTIVE_ASSIGNMENT_STATUS,
  };
}

/**
 * Create and edit a lineman assignment.
 *
 * Both modes post to different endpoints: `create.php` on a new pairing, `update.php`
 * when editing. update.php is a PARTIAL update, so only the fields that actually changed
 * are sent - a status-only edit must not also restate the lineman and barangay, or the
 * server would re-validate them and could reject an edit that had nothing to do with them.
 *
 * Nothing about who may be assigned is decided here. The server re-reads the target's
 * role from `roles` on every call, so this form can only ever offer what it was given.
 *
 * `barangays` from reference context are normalised as `{ id: <NAME>, rowId: <db id> }`
 * (see ReferenceContext), so the option value is the NAME while `rowId` carries the id
 * that `barangay_id` actually wants. Sending the name would be rejected with 400.
 */
export default function AssignmentFormModal({ open, assignment, onClose, onSaved }) {
  const { barangays, isLoading: refLoading } = useReference();
  const linemenQuery = useLinemenList({ enabled: open });
  const toast = useToast();

  const isEdit = Boolean(assignment);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setValues(toFormValues(assignment));
    setErrors({});
  }, [open, assignment]);

  const set = (field) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
  };

  const linemanOptions = useMemo(
    () =>
      (linemenQuery.data || []).map((person) => ({
        value: String(person.id),
        label: person.email ? `${person.name} · ${person.email}` : person.name,
      })),
    [linemenQuery.data]
  );

  /*
   * `value` is the barangay NAME because that is what the normalised reference option
   * carries, so the reverse lookup finds the row whose `rowId` is the real id.
   */
  const barangayOptions = useMemo(
    () =>
      (barangays || []).map((option) => ({
        value: String(option.rowId ?? ''),
        label: option.name,
      })),
    [barangays]
  );

  const selectedBarangay = (barangays || []).find(
    (option) => String(option.rowId) === String(values.barangayId)
  );

  const validationErrors = useMemo(
    () =>
      collectErrors({
        linemanId: () => validateRequired(values.linemanId, 'A lineman'),
        barangayId: () => validateRequired(values.barangayId, 'A barangay'),
        status: () => validateRequired(values.status, 'A status'),
      }),
    [values]
  );

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEdit
        ? linemanAssignmentsApi.update({ id: assignment.id, ...payload })
        : linemanAssignmentsApi.create(payload),
    onSuccess: (result) => {
      toast.success(result?.message || 'Assignment saved.', { title: 'Assignment saved' });
      onSaved?.(result);
      onClose();
    },
  });

  const submit = async (event) => {
    event?.preventDefault();
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    const payload = {
      linemanId: Number(values.linemanId),
      barangayId: Number(values.barangayId),
    };

    if (isEdit) {
      // Send only what moved, so an unchanged field is never re-submitted needlessly.
      if (Number(values.linemanId) !== Number(assignment.linemanId)) {
        payload.linemanId = Number(values.linemanId);
      }
      if (Number(values.barangayId) !== Number(assignment.barangayId)) {
        payload.barangayId = Number(values.barangayId);
      }
      if (values.status !== assignment.status) {
        payload.status = values.status;
      }
      // Nothing changed at all - nothing to ask the server to do.
      if (Object.keys(payload).length === 0) {
        setErrors({ status: 'Nothing to change. Pick a different lineman, barangay or status.' });
        return;
      }
    }

    try {
      await mutation.mutateAsync(payload);
    } catch (error) {
      setErrors(toFieldErrors(error, FIELD_ORDER));
    }
  };

  const formError = mutation.isError ? toUserMessage(mutation.error) : '';

  const linemenError = linemenQuery.isError
    ? 'The list of linemen could not be loaded. Check your connection and try again.'
    : '';

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit assignment' : 'Assign a lineman'}
      description={
        isEdit
          ? 'Move the lineman to another barangay or change the status. The outage access this grants updates immediately.'
          : 'The lineman will be able to view and work on outage reports in the chosen barangay.'
      }
      submitLabel={isEdit ? 'Save changes' : 'Assign'}
      submitting={mutation.isPending}
      error={formError}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Lineman"
          required
          options={linemanOptions}
          placeholder={linemenQuery.isLoading ? 'Loading linemen…' : 'Select a lineman'}
          loading={linemenQuery.isLoading}
          disabled={mutation.isPending}
          value={values.linemanId}
          onChange={set('linemanId')}
          error={errors.linemanId}
          hint={linemenError || 'Only accounts with the lineman role can be assigned.'}
        />

        <Select
          label="Barangay"
          required
          options={barangayOptions}
          placeholder={refLoading ? 'Loading barangays…' : 'Select a barangay'}
          loading={refLoading}
          disabled={mutation.isPending}
          value={values.barangayId}
          onChange={set('barangayId')}
          error={errors.barangayId}
          hint={selectedBarangay ? `Current: ${selectedBarangay.name}` : undefined}
        />

        {isEdit ? (
          <Select
            label="Status"
            required
            options={[
              { value: ACTIVE_ASSIGNMENT_STATUS, label: 'Active' },
              { value: INACTIVE_ASSIGNMENT_STATUS, label: 'Inactive' },
            ]}
            value={values.status}
            onChange={set('status')}
            disabled={mutation.isPending}
            error={errors.status}
            hint="An inactive assignment grants no outage access."
          />
        ) : null}
      </div>

      <InfoNote>
        Assigning the same pair again reactivates the existing record instead of creating
        a duplicate, so the history of who was assigned when is always kept.
      </InfoNote>

      {linemenQuery.isError ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => linemenQuery.refetch()}
            loading={linemenQuery.isFetching}
          >
            Reload linemen
          </Button>
        </div>
      ) : null}
    </FormModal>
  );
}