import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import FormModal from '@/components/FormModal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/context/ToastContext';
import { powerStationsApi } from '@/api';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validateRequired } from '@/utils/validators';

/**
 * Create / edit a power station.
 *
 * Confirmed contract:
 *   create.php POST { station_name*, location_name*, station_type, access_type,
 *                     availability_status, barangay_name, operating_hours, charging_type,
 *                     description }
 *   update.php POST { id*, ...same optional fields..., latitude, longitude }
 * Coordinates are GEOCODED from `location_name`, so no map pin is sent.
 * Enums are validated server-side and silently fall back to a default, so they are
 * sent as explicit select values here.
 */
export const STATION_TYPES = [
  { id: 'power_station', name: 'Power station' },
  { id: 'solar_station', name: 'Solar station' },
  { id: 'charging_station', name: 'Charging station' },
  { id: 'generator_station', name: 'Generator station' },
];

export const STATION_ACCESS_TYPES = [
  { id: 'free', name: 'Free access' },
  { id: 'paid', name: 'Paid access' },
];

export const STATION_AVAILABILITY = [
  { id: 'available', name: 'Available' },
  { id: 'busy', name: 'Busy' },
  { id: 'offline', name: 'Offline' },
  { id: 'maintenance', name: 'Under maintenance' },
];

const FIELD_ORDER = ['stationName', 'locationName', 'stationType', 'accessType', 'availabilityStatus'];

export default function PowerStationFormModal({ open, onClose, station = null, barangays = [] }) {
  const isEdit = Boolean(station?.id);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [values, setValues] = useState(() => ({
    stationName: station?.name ?? '',
    locationName: station?.locationName || station?.address || '',
    stationType: station?.type || 'power_station',
    accessType: station?.accessType || 'free',
    availabilityStatus: station?.availability || 'available',
    barangayName: station?.barangay || '',
    operatingHours: station?.operatingHours || '',
    chargingType: station?.chargingType || '',
    description: station?.description || '',
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const save = useMutation({
    mutationFn: (payload) =>
      isEdit ? powerStationsApi.update(payload) : powerStationsApi.create(payload),
    onSuccess: () => {
      toast.success(
        isEdit ? 'Power station updated.' : 'Power station published. Thank you!',
        { title: isEdit ? 'Updated' : 'Published' }
      );
      queryClient.invalidateQueries({ queryKey: ['power-stations'] });
      onClose();
    },
    onError: (error) => {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'We could not save this power station.'));
    },
  });

  const submitting = save.isPending;

  const setField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  const validate = () =>
    collectErrors({
      stationName: () => validateRequired(values.stationName, 'Station name'),
      locationName: () => validateRequired(values.locationName, 'Location'),
    });

  const handleSubmit = () => {
    setFormError('');
    const validationErrors = validate();
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      station_name: values.stationName.trim(),
      // The server geocodes this string into latitude/longitude.
      location_name: values.locationName.trim(),
      station_type: values.stationType,
      access_type: values.accessType,
      availability_status: values.availabilityStatus,
      barangay_name: values.barangayName || '',
      operating_hours: values.operatingHours.trim(),
      charging_type: values.chargingType.trim(),
      description: values.description.trim(),
    };

    save.mutate(isEdit ? { ...payload, id: station.id } : payload);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit power station' : 'Post a power station'}
      description={
        isEdit
          ? 'Keep the details and availability of your post up to date.'
          : 'Share a power station with the community. Your post is marked as yours.'
      }
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Publish station'}
      submitting={submitting}
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
        hint="Write a full address. PowerGuide resolves it to map coordinates for you."
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
          placeholder="Select a barangay"
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
