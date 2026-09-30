import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Home, Users, Zap } from 'lucide-react';
import FormModal from '@/components/FormModal';
import ImageUploader from '@/components/ImageUploader';
import MapPicker from '@/components/MapPicker';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { barangayMatchHint, useBarangayFromPin } from '@/hooks/useBarangayFromPin';
import { extractCreatedId, outagesApi } from '@/api';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validateRequired } from '@/utils/validators';

const FIELD_ORDER = ['locationName', 'description', 'category', 'severity', 'hazardType', 'affectedHouses'];

/**
 * Create / edit an outage report.
 *
 * Contract:
 *   create.php POST { location_name*, description*, barangay_name?, category?, severity?,
 *                     hazard_type?, affected_houses?, started_at?, latitude?, longitude? }
 *                -> { success, message, report_id, barangay }
 *   update.php POST { id*, location_name, description, affected_houses, started_at,
 *                     category, severity, hazard_type, barangay_name, latitude?, longitude? }
 *
 * `category`, `severity` and `hazard_type` are resolved by NAME server-side, so the
 * reference options are submitted directly.
 *
 * Coordinates: when both `latitude` and `longitude` are numeric the server stores
 * them verbatim and matches the barangay from the pin; otherwise it geocodes
 * `location_name` via Geoapify. The map pin therefore takes precedence, and the
 * typed name is the fallback address (and the only input when no pin is dropped).
 *
 * Guard rails surfaced to the user:
 *   403 "You already have an active report" -> only one active report per user
 *   403 "Outside coverage area"             -> the pin/name is outside Dagupan
 *   404 "Unable to resolve location coordinates" -> no pin, and the name did not geocode
 */
export default function OutageFormModal({ open, onClose, outage = null }) {
  const isEdit = Boolean(outage?.id);
  const { barangays, outageCategories, severityLevels, hazardTypes, isLoading: referenceLoading } =
    useReference();
  const queryClient = useQueryClient();
  const toast = useToast();
  const matchBarangay = useBarangayFromPin();

  const hasStoredPin = Number.isFinite(outage?.lat) && Number.isFinite(outage?.lng);
  const [values, setValues] = useState(() => ({
    locationName: outage?.locationName || outage?.barangay || '',
    description: outage?.description ?? '',
    category: outage?.category ?? '',
    severity: outage?.severity ?? '',
    hazardType: outage?.hazardType || 'none',
    barangayName: outage?.barangay ?? '',
    affectedHouses: Number.isFinite(outage?.affectedHouses) ? String(outage.affectedHouses) : '',
    startedAt: outage?.startedAt ?? '',
    // Start from the report's stored point when editing, so the pin is not lost.
    location: hasStoredPin ? { lat: outage.lat, lng: outage.lng } : null,
  }));
  const [image, setImage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  // The barangay the current pin resolved to, so the field can say where it came
  // from. Cleared as soon as the user picks a barangay themselves.
  const [pinBarangay, setPinBarangay] = useState(null);

  const createMutation = useMutation({
    mutationFn: (payload) => outagesApi.create(payload),
    onSuccess: async (response) => {
      const reportId = extractCreatedId(response);

      if (image && reportId) {
        setProgress(1);
        try {
          await outagesApi.uploadImage(image, { onProgress: setProgress, outageReportId: reportId });
        } catch (uploadError) {
          toast.error(toUserMessage(uploadError, 'Your report was saved but the photo could not be uploaded.'));
        }
      }
      setProgress(0);
      toast.success('Outage report submitted. Thank you for reporting.', { title: 'Report received' });
      queryClient.invalidateQueries({ queryKey: ['outages'] });
      onClose();
    },
    onError: (error) => {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'We could not save your report.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => outagesApi.update(payload),
    onSuccess: () => {
      toast.success('Outage report updated.', { title: 'Updated' });
      queryClient.invalidateQueries({ queryKey: ['outages'] });
      onClose();
    },
    onError: (error) => {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'We could not update your report.'));
    },
  });

  const submitting = createMutation.isPending || updateMutation.isPending || (progress > 0 && progress < 100);

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

  const validate = () =>
    collectErrors({
      locationName: () => validateRequired(values.locationName, 'Location name'),
      description: () => {
        const required = validateRequired(values.description, 'Description');
        if (required) return required;
        if (String(values.description).trim().length < 10) {
          return 'Please describe the outage in at least 10 characters.';
        }
        return null;
      },
      category: () => validateRequired(values.category, 'Outage category'),
    });

  const handleSubmit = async () => {
    setFormError('');
    const validationErrors = validate();
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      location_name: values.locationName.trim(),
      description: String(values.description).trim(),
      category: values.category,
      severity: values.severity || undefined,
      hazard_type: values.hazardType || 'none',
      barangay_name: values.barangayName || '',
      affected_houses: values.affectedHouses === '' ? undefined : Number(values.affectedHouses),
      started_at: values.startedAt || undefined,
      // Only sent when a pin was dropped - otherwise the server geocodes the name.
      ...(values.location
        ? { latitude: values.location.lat, longitude: values.location.lng }
        : {}),
    };

    if (isEdit) {
      updateMutation.mutate({ ...payload, id: outage.id });
      return;
    }
    createMutation.mutate(payload);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit outage report' : 'Report a power outage'}
      description={
        isEdit
          ? 'Update the details of your report.'
          : 'Tell your barangay what is happening. Fields marked with * are required.'
      }
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Submit report'}
      submitting={submitting}
      error={formError}
      size="xl"
    >
      <Input
        label="Location name"
        required
        placeholder="e.g. Rizal Street, Poblacion"
        value={values.locationName}
        onChange={(event) => setField('locationName', event.target.value)}
        error={errors.locationName}
        hint="Used as the fallback address. Dropping a pin below is more accurate."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Outage category"
          required
          placeholder="Select a category"
          options={outageCategories}
          loading={referenceLoading}
          value={values.category}
          onChange={(event) => setField('category', event.target.value)}
          error={errors.category}
        />
        <Select
          label="Severity"
          placeholder="Moderate"
          options={severityLevels}
          loading={referenceLoading}
          value={values.severity}
          onChange={(event) => setField('severity', event.target.value)}
          error={errors.severity}
        />
        <Select
          label="Barangay (optional)"
          placeholder="Detected from the address or your pin"
          options={barangays}
          value={values.barangayName}
          onChange={(event) => {
            setPinBarangay(null);
            setField('barangayName', event.target.value);
          }}
          error={errors.barangayName}
          hint={barangayMatchHint(pinBarangay)}
        />
        <Select
          label="Associated hazard (optional)"
          placeholder="None"
          options={hazardTypes}
          loading={referenceLoading}
          value={values.hazardType}
          onChange={(event) => setField('hazardType', event.target.value)}
          error={errors.hazardType}
        />
        <Input
          label="Affected houses (optional)"
          type="number"
          min="1"
          placeholder="e.g. 12"
          value={values.affectedHouses}
          onChange={(event) => setField('affectedHouses', event.target.value)}
          error={errors.affectedHouses}
        />
        <Input
          label="Started at (optional)"
          type="datetime-local"
          value={values.startedAt}
          onChange={(event) => setField('startedAt', event.target.value)}
          error={errors.startedAt}
        />
      </div>

      <Textarea
        label="Description"
        required
        rows={4}
        placeholder="e.g. Whole street has been dark since 6 PM. Transformer near the barangay hall is not working."
        value={values.description}
        onChange={(event) => setField('description', event.target.value)}
        error={errors.description}
        hint={`${String(values.description || '').trim().length}/10 characters minimum`}
      />

      <div className="rounded-card border border-navy-100 p-4">
        <MapPicker
          label="Pin the exact location (recommended)"
          value={values.location}
          onChange={handleLocation}
          disabled={submitting}
        />
        <p className="mt-2 text-xs text-navy-500">
          Tap the map to drop a pin, drag it to adjust, or use{' '}
          <span className="font-semibold text-navy-700">Use my location</span> to place it at your current
          position. The barangay above is filled in automatically from the pin. Without a pin we locate
          the report from the address you typed.
        </p>
      </div>

      {!isEdit ? (
        <>
          <ImageUploader value={image} onChange={setImage} progress={progress} uploading={progress > 0 && progress < 100} />
          <p className="flex items-start gap-2 rounded-control bg-primary-50 p-3 text-xs text-navy-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden="true" />
            You can only have one active outage report at a time. Update or cancel it before filing
            another.
          </p>
        </>
      ) : (
        <p className="flex items-start gap-2 text-xs text-navy-500">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Status changes are made by the utility company, so they cannot be edited here.
        </p>
      )}

      {!isEdit ? (
        <p className="flex items-start gap-2 text-xs text-navy-500">
          <Home className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Reports outside Dagupan City are rejected by the server.
        </p>
      ) : (
        <p className="flex items-start gap-2 text-xs text-navy-500">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Only you can edit this report until the company verifies it.
        </p>
      )}
    </FormModal>
  );
}
