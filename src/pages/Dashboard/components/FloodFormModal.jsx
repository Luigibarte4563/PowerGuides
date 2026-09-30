import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import FormModal from '@/components/FormModal';
import MapPicker from '@/components/MapPicker';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { barangayMatchHint, useBarangayFromPin } from '@/hooks/useBarangayFromPin';
import { FLOOD_LEVELS, floodsApi } from '@/api';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validateRequired } from '@/utils/validators';

/**
 * Confirmed contract (`flood_report/create.php`):
 *   { location_name*, flood_level?, latitude?, longitude?, description?, barangay_name?,
 *     flood_depth_cm? }
 *   `flood_level` must be one of low | moderate | high | severe.
 *   When latitude AND longitude are both numeric they are used verbatim; otherwise the
 *   server geocodes `location_name`. The map pin therefore takes precedence.
 */
const LEVEL_LABELS = { low: 'Low', moderate: 'Moderate', high: 'High', severe: 'Severe' };
export const FLOOD_LEVEL_OPTIONS = FLOOD_LEVELS.map((level) => ({ id: level, name: LEVEL_LABELS[level] }));

const FIELD_ORDER = ['locationName', 'floodLevel', 'description', 'barangayName', 'depth'];

export default function FloodFormModal({ open, onClose, defaultLocation = null }) {
  const { barangays } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();
  const matchBarangay = useBarangayFromPin();

  const [values, setValues] = useState({
    locationName: '',
    floodLevel: 'moderate',
    description: '',
    barangayName: '',
    depth: '',
    location: defaultLocation,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  // The barangay the current pin resolved to; cleared if the user picks one.
  const [pinBarangay, setPinBarangay] = useState(null);

  const create = useMutation({
    mutationFn: (payload) => floodsApi.create(payload),
    onSuccess: () => {
      toast.success('Flood report submitted. Thank you for reporting.', { title: 'Report received' });
      setValues({
        locationName: '',
        floodLevel: 'moderate',
        description: '',
        barangayName: '',
        depth: '',
        location: null,
      });
      setPinBarangay(null);
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ['floods'] });
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      onClose();
    },
    onError: (error) => {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'We could not submit your flood report.'));
    },
  });

  const setField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  /** Dropping a pin fills in the barangay; an unmatchable pin changes nothing. */
  const handleLocation = (next) => {
    setField('location', next);
    const match = matchBarangay(next);
    setPinBarangay(match);
    if (match) setField('barangayName', match.name);
  };

  const handleSubmit = () => {
    setFormError('');
    const validationErrors = collectErrors({
      locationName: () => validateRequired(values.locationName, 'Location name'),
      description: () => {
        const required = validateRequired(values.description, 'Description');
        if (required) return required;
        if (String(values.description).trim().length < 10) {
          return 'Please describe the flooding in at least 10 characters.';
        }
        return null;
      },
    });
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    create.mutate({
      location_name: values.locationName.trim(),
      flood_level: values.floodLevel,
      description: String(values.description).trim(),
      barangay_name: values.barangayName || '',
      flood_depth_cm: values.depth === '' ? null : Number(values.depth),
      // Only sent when a pin was dropped - otherwise the server geocodes the name.
      ...(values.location
        ? { latitude: values.location.lat, longitude: values.location.lng }
        : {}),
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Report flooding"
      description="Help your neighbours know which roads and barangays are already affected."
      onSubmit={handleSubmit}
      submitLabel="Submit report"
      submitting={create.isPending}
      error={formError}
      size="xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Location name"
          required
          placeholder="e.g. intersection of Rizal and Burgos Streets"
          value={values.locationName}
          onChange={(event) => setField('locationName', event.target.value)}
          error={errors.locationName}
          hint="Drop a pin below and this is used as the fallback address."
        />
        <Select
          label="Flood level"
          required
          options={FLOOD_LEVEL_OPTIONS}
          value={values.floodLevel}
          onChange={(event) => setField('floodLevel', event.target.value)}
          error={errors.floodLevel}
        />
        <Select
          label="Barangay (optional)"
          placeholder="Select a barangay"
          options={barangays}
          value={values.barangayName}
          onChange={(event) => {
            setPinBarangay(null);
            setField('barangayName', event.target.value);
          }}
          error={errors.barangayName}
          hint={barangayMatchHint(pinBarangay)}
        />
        <Input
          label="Depth in cm (optional)"
          type="number"
          min="0"
          placeholder="e.g. 30"
          value={values.depth}
          onChange={(event) => setField('depth', event.target.value)}
          error={errors.depth}
        />
      </div>

      <Textarea
        label="Description"
        required
        rows={4}
        placeholder="e.g. Water rising at the intersection, ankle deep and rising. Road is not passable by cars."
        value={values.description}
        onChange={(event) => setField('description', event.target.value)}
        error={errors.description}
      />

      <div className="rounded-card border border-navy-100 p-4">
        <MapPicker
          label="Exact location (recommended)"
          value={values.location}
          onChange={handleLocation}
          disabled={create.isPending}
        />
        <p className="mt-2 text-xs text-navy-500">
          The barangay above fills in automatically from your pin. Without a pin the server geocodes the
          address you typed instead.
        </p>
      </div>
    </FormModal>
  );
}
