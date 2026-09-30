import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import FormModal from '@/components/FormModal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/context/ToastContext';
import { powerStationsApi } from '@/api';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validateRequired } from '@/utils/validators';
import {
  STATION_ACCESS_TYPES,
  STATION_AVAILABILITY,
  STATION_TYPES,
} from '@/pages/Dashboard/components/PowerStationFormModal';

const FIELD_ORDER = ['stationName', 'locationName', 'stationType', 'accessType', 'availabilityStatus'];

const EMPTY = {
  stationName: '',
  locationName: '',
  stationType: 'power_station',
  accessType: 'free',
  availabilityStatus: 'available',
  barangayName: '',
  operatingHours: '',
  chargingType: '',
  description: '',
};

function toFormValues(station) {
  if (!station) return EMPTY;
  return {
    stationName: station.name ?? '',
    locationName: station.locationName || station.address || '',
    stationType: station.type || 'power_station',
    accessType: station.accessType || 'free',
    availabilityStatus: station.availability || 'available',
    barangayName: station.barangay || '',
    operatingHours: station.operatingHours || '',
    chargingType: station.chargingType || '',
    description: station.description || '',
  };
}

/**
 * FR-PWR-2 / FR-PWR-3 - create and edit a power station.
 *
 * Shares the enum lists with the resident modal; the difference is that this one
 * RESETS when the modal is reopened for a different station. The resident modal seeds
 * `useState` once, which is fine when it only ever opens for "my own" post, but the
 * company list opens it for whichever row was clicked - without a reset, editing
 * station B would pre-fill station A's name.
 *
 * Coordinates are geocoded server-side from `location_name`; the endpoint rejects the
 * save with a 404 if the address cannot be resolved, and that message is shown as-is.
 * `update.php` also clears `barangay_id` when `barangay_name` is sent empty, so an
 * existing barangay is always submitted rather than left blank by accident.
 */
export default function PowerStationFormModal({
  open,
  onClose,
  station = null,
  barangays = [],
  invalidateKeys = ['power-stations'],
}) {
  const isEdit = Boolean(station?.id);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setValues(toFormValues(station));
    setErrors({});
    setFormError('');
  }, [open, station]);

  const save = useMutation({
    mutationFn: (payload) =>
      isEdit ? powerStationsApi.update(payload) : powerStationsApi.create(payload),
    onSuccess: () => {
      toast.success(isEdit ? 'Power station updated.' : 'Power station created.', {
        title: isEdit ? 'Updated' : 'Created',
      });
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      onClose();
    },
  });

  const setField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  const handleSubmit = async () => {
    setFormError('');
    const validationErrors = collectErrors({
      stationName: () => validateRequired(values.stationName, 'Station name'),
      locationName: () => validateRequired(values.locationName, 'Location'),
    });
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      station_name: values.stationName.trim(),
      location_name: values.locationName.trim(),
      station_type: values.stationType,
      access_type: values.accessType,
      availability_status: values.availabilityStatus,
      barangay_name: values.barangayName || '',
      operating_hours: values.operatingHours.trim(),
      charging_type: values.chargingType.trim(),
      description: values.description.trim(),
    };

    try {
      await save.mutateAsync(isEdit ? { ...payload, id: station.id } : payload);
    } catch (error) {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'We could not save this power station.'));
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit power station' : 'Add a power station'}
      description={
        isEdit
          ? 'Keep the details and availability current.'
          : 'Coordinates are resolved from the address you enter.'
      }
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create station'}
      submitting={save.isPending}
      error={formError}
      size="lg"
    >
      <Input
        label="Station name"
        required
        placeholder="e.g. Dagupan City Hall Station"
        value={values.stationName}
        onChange={(event) => setField('stationName', event.target.value)}
        error={errors.stationName}
      />

      <Input
        label="Location"
        required
        placeholder="e.g.ordable, Dagupan City"
        value={values.locationName}
        onChange={(event) => setField('locationName', event.target.value)}
        error={errors.locationName}
        hint="Write a full address - the server geocodes it, and an unresolvable address is rejected."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Station type"
          options={STATION_TYPES}
          value={values.stationType}
          onChange={(event) => setField('stationType', event.target.value)}
          error={errors.stationType}
        />
        <Select
          label="Access type"
          options={STATION_ACCESS_TYPES}
          value={values.accessType}
          onChange={(event) => setField('accessType', event.target.value)}
          error={errors.accessType}
        />
        <Select
          label="Availability"
          options={STATION_AVAILABILITY}
          value={values.availabilityStatus}
          onChange={(event) => setField('availabilityStatus', event.target.value)}
          error={errors.availabilityStatus}
          hint="Update this whenever the station changes state."
        />
        <Select
          label="Barangay (optional)"
          placeholder="No barangay"
          options={barangays}
          value={values.barangayName}
          onChange={(event) => setField('barangayName', event.target.value)}
        />
        <Input
          label="Operating hours (optional)"
          placeholder="e.g. 24 hours during outages"
          value={values.operatingHours}
          onChange={(event) => setField('operatingHours', event.target.value)}
        />
        <Input
          label="Charging type (optional)"
          placeholder="e.g. Type-2 AC, fast charging"
          value={values.chargingType}
          onChange={(event) => setField('chargingType', event.target.value)}
        />
      </div>

      <Textarea
        label="Description (optional)"
        rows={3}
        placeholder="Queue rules, fees, or anything the community should know."
        value={values.description}
        onChange={(event) => setField('description', event.target.value)}
      />
    </FormModal>
  );
}
