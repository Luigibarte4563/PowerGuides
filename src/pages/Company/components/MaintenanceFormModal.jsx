import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import FormModal from '@/components/FormModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input, Textarea } from '@/components/ui/Input';
import { InfoNote } from '@/components/ui/Alert';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { maintenanceApi, MAINTAINABLE_STATUSES } from '@/api';
import { COMPANY_QUERY_KEYS } from '@/utils/constants';
import { readMaintenance } from '@/utils/records';
import { humanize } from '@/utils/formatters';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import {
  clearFieldError,
  collectErrors,
  hasErrors,
  validateRequired,
} from '@/utils/validators';

/** Radius options in metres; `create.php` defaults to 2000, `update.php` to 500. */
const RADIUS_OPTIONS = [
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 2000, label: '2 km' },
  { value: 5000, label: '5 km' },
];

const FIELD_ORDER = [
  'maintenanceDate',
  'startTime',
  'endTime',
  'barangays',
  'description',
  'radius',
];

const EMPTY = {
  maintenanceDate: '',
  startTime: '',
  endTime: '',
  description: '',
  radius: 2000,
  status: 'upcoming',
  barangays: [],
};

function toFormValues(schedule) {
  if (!schedule) return EMPTY;
  return {
    maintenanceDate: schedule.date || '',
    startTime: (schedule.startTime || '').slice(0, 5),
    endTime: (schedule.endTime || '').slice(0, 5),
    description: schedule.description || '',
    radius: Number(schedule.radius) || 2000,
    status: schedule.status || 'upcoming',
    barangays: schedule.locations.map((location) => location.barangay).filter(Boolean),
  };
}

/**
 * Explain the notification outcome instead of just printing a number.
 *
 * `users_notified: 0` used to be indistinguishable between "nobody was in range" and
 * "nobody on the system has set a location", which is why nobody could tell why residents
 * were not hearing about a schedule. The server now returns a breakdown, so a zero can be
 * explained, and an update that changed nothing says so instead of implying a broadcast.
 */
function describeNotification(result) {
  if (result && result.residents_notified === false) {
    return ' Nothing resident-facing changed, so nobody was notified again.';
  }

  const notified = Number(result?.users_notified ?? 0);
  const breakdown = result?.notification_breakdown || {};
  const noLocation = Number(breakdown.no_location ?? 0);
  const outOfArea = Number(breakdown.out_of_area ?? 0);
  const degraded = breakdown.degraded === true;

  if (notified === 0) {
    if (noLocation > 0) {
      return ` No resident was notified: ${noLocation} have no saved location, and ${outOfArea} sit outside the affected area.`;
    }
    if (outOfArea > 0) {
      return ` No resident was notified: all ${outOfArea} sit outside the affected area.`;
    }
    if (degraded) {
      return ' The affected area could not be geocoded, so nobody could be matched reliably.';
    }
    return ' No resident was notified.';
  }

  let text = ` ${notified} resident${notified === 1 ? '' : 's'} notified.`;
  if (noLocation > 0) {
    text += ` ${noLocation} more could not be reached - they have no saved location.`;
  }
  return text;
}

/**
 * FR-MNT-2 / FR-MNT-3 / FR-MNT-7 - create and edit a maintenance schedule.
 *
 * Both endpoints take the same window fields plus a `barangays` array of NAMES (the
 * server geocodes each one and rejects unknown names by creating them, so the options
 * come from `reference/get.php` and only real barangays are submitted).
 *
 * FR-MNT-7 - "notify affected residents" is not a parameter. Both endpoints notify
 * every `user` with a saved location inside `radius` automatically, so the checkbox
 * is an explanation of what will happen rather than a switch, and the number the
 * server reports back is shown after saving.
 *
 * KNOWN GAP: `update.php` answers HTTP 500 for ordinary validation problems
 * ("Maintenance date, start time, end time are required", "Invalid date/time values",
 * ...). The message is still shown verbatim, so a 500 from this form is surfaced as
 * the input problem it usually is rather than a generic server error.
 */
export default function MaintenanceFormModal({ open, schedule, onClose, onSaved }) {
  const { barangays, isLoading: refLoading } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();

  const isEdit = Boolean(schedule);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setValues(toFormValues(schedule ? readMaintenance(schedule.raw || schedule) : null));
    setErrors({});
  }, [open, schedule]);

  const set = (field) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
  };

  const toggleBarangay = (name) => {
    setValues((current) => ({
      ...current,
      barangays: current.barangays.includes(name)
        ? current.barangays.filter((item) => item !== name)
        : [...current.barangays, name],
    }));
    setErrors((current) => clearFieldError(current, 'barangays'));
  };

  const validationErrors = useMemo(
    () =>
      collectErrors({
        maintenanceDate: () => validateRequired(values.maintenanceDate, 'The maintenance date'),
        startTime: () => validateRequired(values.startTime, 'A start time'),
        endTime: () => validateRequired(values.endTime, 'An end time'),
        barangays: () =>
          values.barangays.length === 0 ? 'Select at least one barangay.' : null,
        // End must be after start - the endpoint compares the two times and rejects
        // an inverted window, so catching it here saves a round trip.
        endAfterStart: () => {
          if (!values.startTime || !values.endTime) return null;
          return values.endTime <= values.startTime
            ? 'The end time must be after the start time.'
            : null;
        },
      }),
    [values]
  );

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? maintenanceApi.update(payload) : maintenanceApi.create(payload),
    onSuccess: (result) => {
      toast.success(
        `${isEdit ? 'Schedule updated' : 'Schedule created'}.${describeNotification(result)}`,
        { title: isEdit ? 'Maintenance updated' : 'Maintenance scheduled' }
      );
      queryClient.invalidateQueries({ queryKey: ['company-maintenance'] });
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.summary });
      onSaved?.(result);
      onClose();
    },
  });

  const submit = async (event) => {
    event?.preventDefault();
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    const payload = {
      maintenance_date: values.maintenanceDate,
      start_time: values.startTime,
      end_time: values.endTime,
      description: values.description.trim(),
      radius: Number(values.radius) || 2000,
      barangays: values.barangays,
    };
    if (isEdit) {
      payload.maintenance_id = readMaintenance(schedule.raw || schedule).id;
      // `update.php` only honours a status from its own list; anything else is
      // derived from the window, so the picker is limited to that list.
      if (MAINTAINABLE_STATUSES.includes(values.status)) payload.status = values.status;
    }

    try {
      await mutation.mutateAsync(payload);
    } catch (error) {
      setErrors(toFieldErrors(error, FIELD_ORDER));
    }
  };

  const formError = mutation.isError ? toUserMessage(mutation.error) : '';

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit maintenance schedule' : 'Schedule maintenance'}
      description={
        isEdit
          ? 'Adjust the window, the status or the affected areas. Residents are only notified when something they care about changes.'
          : 'Pick the date, the window and the affected barangays.'
      }
      submitLabel={isEdit ? 'Save changes' : 'Create schedule'}
      submitting={mutation.isPending}
      error={formError}
      onSubmit={submit}
      footerExtra={
        <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-navy-400">
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {isEdit
            ? 'Notifies residents when something changes'
            : 'Creating notifies residents in range'}
        </span>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Maintenance date"
          type="date"
          required
          value={values.maintenanceDate}
          onChange={set('maintenanceDate')}
          error={errors.maintenanceDate}
        />
        {isEdit ? (
          <Select
            label="Status"
            options={MAINTAINABLE_STATUSES.map((value) => ({
              value,
              label: humanize(value),
            }))}
            value={values.status}
            onChange={set('status')}
            hint="Changing this notifies the residents in range. Saving without changing anything does not notify anyone again."
          />
        ) : null}
        <Input
          label="Start time"
          type="time"
          required
          value={values.startTime}
          onChange={set('startTime')}
          error={errors.startTime}
        />
        <Input
          label="End time"
          type="time"
          required
          value={values.endTime}
          onChange={set('endTime')}
          error={errors.endTime || errors.endAfterStart}
        />
        <Select
          label="Notify radius"
          options={RADIUS_OPTIONS}
          value={String(values.radius)}
          onChange={set('radius')}
          hint="Residents with a saved location inside this radius are notified automatically."
        />
        <div className="sm:col-span-2">
          <Textarea
            label="Description"
            rows={3}
            value={values.description}
            onChange={set('description')}
            placeholder="What the crew will be doing and anything residents should prepare."
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-navy-800">
          Affected barangays
          <span className="ml-0.5 text-danger-600" aria-hidden="true">
            *
          </span>
        </legend>
        <p className="mt-1 text-xs text-navy-400">
          Each selected barangay is geocoded so it can be drawn on the maintenance map.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(barangays || []).map((option) => {
            const selected = values.barangays.includes(option.name);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleBarangay(option.name)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? 'border-primary-400 bg-primary-100 text-primary-800'
                    : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                }`}
              >
                {option.name}
              </button>
            );
          })}
        </div>
        {errors.barangays ? (
          <p className="mt-2 text-xs font-medium text-danger-600" role="alert">
            {errors.barangays}
          </p>
        ) : null}
        {refLoading ? (
          <p className="mt-2 text-xs text-navy-400">Loading the barangay list…</p>
        ) : null}
      </fieldset>

      {isEdit ? (
        <InfoNote>
          Saving replaces the affected areas for this schedule. Deleting it also removes the
          notifications it sent.
        </InfoNote>
      ) : null}
    </FormModal>
  );
}
