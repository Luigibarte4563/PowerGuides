import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import FormModal from '@/components/FormModal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import MapPicker from '@/components/MapPicker';
import { ADDRESS_HINT, PIN_HINT, useBarangayCoords } from '@/hooks/useBarangayCoords';
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

export const CHARGING_TYPES = [
  'Type-1 (SAE J1772)',
  'Type-2 AC',
  'CCS Combo',
  'CHAdeMO',
  'Tesla Supercharger / NACS',
  'Other',
];

function knownChargingType(value) {
  if (!value) return null;
  return CHARGING_TYPES.includes(value) ? value : null;
}

function validateOperatingHours(value) {
  if (!value) return null; // optional
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Operating hours must be a number.';
  if (n < 0 || n > 24) return 'Operating hours must be between 0 and 24.';
  return null;
}

function validateChargingType(chargingType, chargingTypeOther) {
  if (chargingType === 'Other' && !chargingTypeOther.trim()) {
    return 'Please enter a charging type.';
  }
  return null;
}

const FIELD_ORDER = ['stationName', 'locationName', 'stationType', 'accessType', 'availabilityStatus', 'barangayName', 'operatingHours', 'chargingType', 'chargingTypeOther'];

export default function PowerStationFormModal({ open, onClose, station = null, barangays = [] }) {
  const isEdit = Boolean(station?.id);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { coordsFor } = useBarangayCoords();

  const [values, setValues] = useState(() => ({
    stationName: station?.name ?? '',
    locationName: station?.locationName || station?.address || '',
    stationType: station?.type || 'power_station',
    accessType: station?.accessType || 'free',
    availabilityStatus: station?.availability || 'available',
    barangayName: station?.barangay || '',
    operatingHours: station?.operatingHours || '',
    chargingType: knownChargingType(station?.chargingType) || 'Type-2 AC',
    chargingTypeOther: !knownChargingType(station?.chargingType) && station?.chargingType ? station?.chargingType : '',
    description: station?.description || '',
    location:
      Number.isFinite(station?.lat) && Number.isFinite(station?.lng)
        ? { lat: station.lat, lng: station.lng }
        : null,
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
      barangayName: () => validateRequired(values.barangayName, 'Barangay'),
      operatingHours: () => validateOperatingHours(values.operatingHours),
      chargingType: () => validateChargingType(values.chargingType, values.chargingTypeOther),
    });

  /** Choosing a barangay moves the pin onto that barangay's stored centre. */
  const handleBarangay = (name) => {
    setField('barangayName', name);
    setField('location', coordsFor(name));
  };

  const handleSubmit = () => {
    setFormError('');
    const validationErrors = validate();
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
      // When "Other" is chosen, the custom text is the charging type; otherwise the selected label is sent.
      charging_type: values.chargingType === 'Other' ? values.chargingTypeOther.trim() : values.chargingType,
      description: values.description.trim(),
      // Only sent when the user refined the pin past the barangay centroid.
      ...(values.location
        ? { latitude: values.location.lat, longitude: values.location.lng }
        : {}),    };

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
        hint={ADDRESS_HINT}
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
          label="Barangay"
          required
          placeholder="Select a barangay"
          options={barangays}
          value={values.barangayName}
          onChange={(event) => handleBarangay(event.target.value)}
          error={errors.barangayName}
        />
        <Input
          label="Operating hours (optional)"
          type="number"
          min="0"
          max="24"
          placeholder="e.g. 24"
          value={values.operatingHours}
          onChange={(event) => setField('operatingHours', event.target.value)}
          error={errors.operatingHours}
          hint="Hours per day the station is open. Leave blank if not set."
        />
        <Select
          label="Charging type (optional)"
          options={CHARGING_TYPES}
          value={values.chargingType}
          onChange={(event) => {
            setField('chargingType', event.target.value);
            if (event.target.value !== 'Other') {
              setField('chargingTypeOther', '');
            }
          }}
          error={errors.chargingType}
          hint="Connector type. Choose Other to enter your own."
        />
        {values.chargingType === 'Other' && (
          <Input
            label="Charging type (custom)"
            placeholder="e.g. Proprietary connector"
            value={values.chargingTypeOther}
            onChange={(event) => setField('chargingTypeOther', event.target.value)}
            error={errors.chargingType}
          />
        )}
      </div>

      <div className="rounded-card border border-navy-100 p-4">
        <MapPicker
          label="Exact location (optional)"
          value={values.location}
          onChange={(next) => setField('location', next)}
          disabled={submitting}
        />
        <p className="mt-2 text-xs text-navy-500">{PIN_HINT}</p>
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
