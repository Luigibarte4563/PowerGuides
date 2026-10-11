import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import FormModal from '@/components/FormModal';
import MapPicker from '@/components/MapPicker';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { ADDRESS_HINT, PIN_HINT, useBarangayCoords } from '@/hooks/useBarangayCoords';
import { HAZARD_SEVERITIES, hazardsApi } from '@/api';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validateRequired } from '@/utils/validators';

/**
 * Confirmed contract (`electrical_hazard/create.php`):
 *   { location_name*, severity?, hazard_type?, latitude?, longitude?, description?,
 *     barangay_name?, image_url? }
 *   `severity` must be one of low | moderate | high | critical; `hazard_type` is
 *   resolved from hazard_types.hazard_name (defaults to "none").
 */
const SEVERITY_LABELS = { low: 'Low', moderate: 'Moderate', high: 'High', critical: 'Critical' };
export const HAZARD_SEVERITY_OPTIONS = HAZARD_SEVERITIES.map((level) => ({
  id: level,
  name: SEVERITY_LABELS[level],
}));

const FIELD_ORDER = ['locationName', 'severity', 'hazardType', 'description', 'barangayName'];

export default function HazardFormModal({ open, onClose, defaultLocation = null }) {
  const { hazardTypes, barangays } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { coordsFor } = useBarangayCoords();

  const [values, setValues] = useState({
    locationName: '',
    severity: 'moderate',
    hazardType: '',
    description: '',
    barangayName: '',
    location: defaultLocation,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const create = useMutation({
    mutationFn: (payload) => hazardsApi.create(payload),
    onSuccess: () => {
      toast.success('Hazard report submitted. Stay safe out there.', { title: 'Report received' });
      setValues({
        locationName: '',
        severity: 'moderate',
        hazardType: '',
        description: '',
        barangayName: '',
        location: null,
      });
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ['hazards'] });
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      onClose();
    },
    onError: (error) => {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'We could not submit your hazard report.'));
    },
  });

  const setField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  /** The pin only refines the point; the barangay decides where it starts. */
  const handleLocation = (next) => setField('location', next);

  /** Choosing a barangay moves the pin onto that barangay's stored centre. */
  const handleBarangay = (name) => {
    setField('barangayName', name);
    setField('location', coordsFor(name));
  };

  const handleSubmit = () => {
    setFormError('');
    const validationErrors = collectErrors({
      locationName: () => validateRequired(values.locationName, 'Location name'),
      barangayName: () => validateRequired(values.barangayName, 'Barangay'),
      description: () => {
        const required = validateRequired(values.description, 'Description');
        if (required) return required;
        if (String(values.description).trim().length < 10) {
          return 'Please describe the hazard in at least 10 characters.';
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
      severity: values.severity,
      // Omitted when blank so the server applies its "none" default.
      ...(values.hazardType ? { hazard_type: values.hazardType } : {}),
      description: String(values.description).trim(),
      barangay_name: values.barangayName || '',
      ...(values.location
        ? { latitude: values.location.lat, longitude: values.location.lng }
        : {}),
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Report an electrical hazard"
      description="Downed wires, exposed cables, sparking connections and damaged meters."
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
          placeholder="e.g. in front of the basketball court"
          value={values.locationName}
          onChange={(event) => setField('locationName', event.target.value)}
          error={errors.locationName}
          hint={ADDRESS_HINT}
        />
        <Select
          label="Severity"
          required
          options={HAZARD_SEVERITY_OPTIONS}
          value={values.severity}
          onChange={(event) => setField('severity', event.target.value)}
          error={errors.severity}
        />
        <Select
          label="Hazard type"
          placeholder="Select a type"
          options={hazardTypes}
          value={values.hazardType}
          onChange={(event) => setField('hazardType', event.target.value)}
          error={errors.hazardType}
        />
        <Select
          label="Barangay"
          required
          placeholder="Select a barangay"
          options={barangays}
          value={values.barangayName}
          onChange={(event) => handleBarangay(event.target.value)}
          error={errors.barangayName}
          hint={ADDRESS_HINT}
        />
      </div>

      <Textarea
        label="Description"
        required
        rows={4}
        placeholder="e.g. Wire hanging about a metre above the road. Nobody has touched it. Fence is open."
        value={values.description}
        onChange={(event) => setField('description', event.target.value)}
        error={errors.description}
      />

      <div className="rounded-card border border-navy-100 p-4">
        <MapPicker
          label="Exact location (optional)"
          value={values.location}
          onChange={handleLocation}
          disabled={create.isPending}
        />
        <p className="mt-2 text-xs text-navy-500">
          {PIN_HINT}
        </p>
      </div>

      <p className="rounded-control bg-warning-50 p-3 text-xs font-medium text-warning-700">
        Never approach or touch a hazard to take a photo or move objects. Report it from a safe distance.
      </p>
    </FormModal>
  );
}
