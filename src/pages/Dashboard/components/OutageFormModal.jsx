import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Marker, useMapEvents, ZoomControl } from 'react-leaflet';
import { AlertTriangle, Clock, Home, Loader2, MapPin, Users, X } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import ImageUploader from '@/components/ImageUploader';
import AppMap, { pinIcon } from '@/components/Map';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { barangayCoords, useBarangayCoords } from '@/hooks/useBarangayCoords';
import { extractCreatedId, outagesApi } from '@/api';
import { distanceInMeters, hasCoordinates } from '@/utils/formatters';
import { formatCategory } from '@/utils/outageFeed';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validateRequired } from '@/utils/validators';

const FIELD_ORDER = ['locationName', 'description', 'category', 'severity', 'hazardType', 'affectedHouses', 'barangayName'];

const FIELD_LABEL =
  '!text-[10px] !font-bold !uppercase !tracking-[0.16em] !text-white/45';
const FIELD_CONTROL =
  'h-11 !rounded-xl !border-white/10 !bg-white/[0.04] !text-sm !text-white [color-scheme:dark] placeholder:text-white/30 focus:!border-[#FFBB02] focus:!ring-[#FFBB02]/30 dark:!border-white/10 dark:!bg-white/[0.04] dark:!text-white dark:placeholder:text-white/30 dark:focus:!border-[#FFBB02] dark:focus:!ring-[#FFBB02]/30';

const DEFAULT_POINT = { lat: 16.0433, lng: 120.3329 };

const round6 = (value) => Number(Number(value).toFixed(6));

function toDateTimeLocal(value) {
  if (!value) return '';
  return String(value).replace(' ', 'T').slice(0, 16);
}

function prettyOptions(options) {
  return options.map((option) => ({
    value: option.id,
    label: formatCategory(option.name, 'Unknown'),
  }));
}

function nearestBarangay(point, barangays) {
  let nearest = '';
  let nearestDistance = Infinity;

  barangays.forEach((option) => {
    const coords = barangayCoords(option);
    if (!coords) return;
    const distance = distanceInMeters(point.lat, point.lng, coords.lat, coords.lng);
    if (distance !== null && distance < nearestDistance) {
      nearestDistance = distance;
      nearest = option.name;
    }
  });

  return nearest;
}

function LocationClickHandler({ onPick, disabled }) {
  useMapEvents({
    click(event) {
      if (disabled) return;
      onPick({
        lat: round6(event.latlng.lat),
        lng: round6(event.latlng.lng),
      });
    },
  });
  return null;
}

/**
 * Create / edit an outage report.
 *
 * The modal is intentionally split: the map chooses the point on the left and
 * the form scrolls on the right. `pinTouched` is what decides whether the pin is
 * sent: the default marker is only a visual prompt, so a report filed for one
 * barangay can never silently inherit the city-centre coordinates.
 */
export default function OutageFormModal({ open, onClose, outage = null, onResult }) {
  const isEdit = Boolean(outage?.id);
  const { barangays, outageCategories, severityLevels, hazardTypes, isLoading: referenceLoading } =
    useReference();
  const { coordsFor, withoutCoords } = useBarangayCoords();
  const queryClient = useQueryClient();
  const toast = useToast();
  const geo = useGeolocation();

  const hasStoredPin = hasCoordinates(outage?.lat, outage?.lng);
  const storedPoint = hasStoredPin ? { lat: Number(outage.lat), lng: Number(outage.lng) } : null;
  const initialPoint = storedPoint || (isEdit ? coordsFor(outage?.barangay) : null);

  const [values, setValues] = useState(() => ({
    locationName: outage?.locationName || outage?.barangay || '',
    description: outage?.description ?? '',
    category: outage?.category ?? '',
    severity: outage?.severity || (isEdit ? '' : 'moderate'),
    hazardType: outage?.hazardType || 'none',
    barangayName: outage?.barangay ?? '',
    affectedHouses: Number.isFinite(outage?.affectedHouses) ? String(outage.affectedHouses) : '',
    startedAt: toDateTimeLocal(outage?.startedAt),
    location: initialPoint,
  }));
  const [pinTouched, setPinTouched] = useState(Boolean(initialPoint));
  const [viewCenter, setViewCenter] = useState(initialPoint || DEFAULT_POINT);
  const [image, setImage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const markerPoint = useMemo(
    () => values.location || coordsFor(values.barangayName) || DEFAULT_POINT,
    [values.location, values.barangayName, coordsFor]
  );

  const setField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  const selectPoint = useCallback(
    (point, { fly = false } = {}) => {
      const nearest = nearestBarangay(point, barangays);
      setValues((current) => ({
        ...current,
        location: point,
        ...(nearest
          ? {
              barangayName: nearest,
              // Keep a name the resident typed; only refresh an auto-filled one.
              locationName:
                !current.locationName || current.locationName === current.barangayName
                  ? nearest
                  : current.locationName,
            }
          : {}),
      }));
      setPinTouched(true);
      setErrors({});
      setFormError('');
      if (fly) setViewCenter(point);
    },
    [barangays]
  );

  // Browser geolocation arrives asynchronously, so apply it when it lands.
  useEffect(() => {
    if (geo.lat === null || geo.lng === null) return;
    selectPoint({ lat: round6(geo.lat), lng: round6(geo.lng) }, { fly: true });
  }, [geo.lat, geo.lng, selectPoint]);

  // Reference data can arrive after the modal opens; resolve an edit's centroid
  // then, without touching a pin the user has already moved.
  useEffect(() => {
    if (!isEdit || values.location) return;
    const coords = coordsFor(values.barangayName);
    if (!coords) return;
    setValues((current) => (current.location ? current : { ...current, location: coords }));
    setPinTouched(true);
    setViewCenter(coords);
  }, [isEdit, coordsFor, values.barangayName, values.location]);

  const handleBarangay = (name) => {
    const coords = coordsFor(name);
    setValues((current) => ({
      ...current,
      barangayName: name,
      location: coords || current.location,
      locationName: current.locationName || name,
    }));
    setPinTouched(Boolean(coords));
    setErrors((current) => clearFieldError(current, 'barangayName'));
    setFormError('');
    if (coords) setViewCenter(coords);
  };

  const createMutation = useMutation({
    mutationFn: (payload) => outagesApi.create(payload),
    onSuccess: async (response) => {
      const reportId = extractCreatedId(response);

      if (image && reportId) {
        setProgress(1);
        try {
          await outagesApi.uploadImage(image, { onProgress: setProgress, outageReportId: reportId });
        } catch (uploadError) {
          queryClient.invalidateQueries({ queryKey: ['outages'] });
          const uploadMessage = toUserMessage(
            uploadError,
            'Your report was saved but the photo could not be uploaded.'
          );
          if (onResult) {
            onResult({ type: 'warning', title: 'Report saved without the photo', message: uploadMessage });
          } else {
            toast.warning(uploadMessage, { title: 'Photo not uploaded' });
          }
          setProgress(0);
          onClose();
          return;
        }
      }

      setProgress(0);
      queryClient.invalidateQueries({ queryKey: ['outages'] });
      if (onResult) {
        onResult({
          type: 'success',
          title: 'Report submitted',
          message: 'Your report is now on the community map. Thank you for helping your neighbours.',
        });
      } else {
        toast.success('Outage report submitted. Thank you for reporting.', { title: 'Report received' });
      }
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
      queryClient.invalidateQueries({ queryKey: ['outages'] });
      if (onResult) {
        onResult({
          type: 'success',
          title: 'Incident updated',
          message: 'Your changes have been saved and the map has been refreshed.',
        });
      } else {
        toast.success('Outage report updated.', { title: 'Updated' });
      }
      onClose();
    },
    onError: (error) => {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'We could not update your report.'));
    },
  });

  const submitting =
    createMutation.isPending || updateMutation.isPending || (progress > 0 && progress < 100);

  const validate = () =>
    collectErrors({
      locationName: () => validateRequired(values.locationName, 'Location name'),
      barangayName: () => validateRequired(values.barangayName, 'Barangay'),
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

  const handleSubmit = async (event) => {
    event.preventDefault();
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
      ...(pinTouched && values.location
        ? { latitude: values.location.lat, longitude: values.location.lng }
        : {}),
    };

    if (isEdit) {
      updateMutation.mutate({ ...payload, id: outage.id });
      return;
    }
    createMutation.mutate(payload);
  };

  const categoryOptions = prettyOptions(outageCategories);
  const severityOptions = prettyOptions(severityLevels);
  const hazardOptions = prettyOptions(hazardTypes);

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={isEdit ? 'Update an Incident' : 'Report an Incident'}
      bare
      className="font-montserrat h-[min(92vh,760px)] w-[calc(100%-1.5rem)] max-w-[1000px] overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#1E203C] to-[#141527] shadow-[0_30px_100px_rgba(0,0,0,0.65)] lg:h-[640px]"
    >
      <div data-theme="dark" className="flex h-full min-h-0 flex-col lg:flex-row">
        <div className="relative h-[210px] shrink-0 overflow-hidden border-b border-white/10 sm:h-[230px] lg:h-auto lg:w-[45%] lg:border-b-0 lg:border-r">
          <AppMap
            center={viewCenter}
            zoom={hasStoredPin ? 16 : 14}
            zoomControl={false}
            className="pg-dark-map h-full w-full"
          >
            <LocationClickHandler onPick={selectPoint} disabled={submitting} />
            <ZoomControl position="bottomright" />
            <Marker
              position={[markerPoint.lat, markerPoint.lng]}
              icon={pinIcon('#FFBB02')}
              draggable={!submitting}
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng();
                  selectPoint({ lat: round6(lat), lng: round6(lng) });
                },
              }}
            />
          </AppMap>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] rounded-2xl border border-white/10 bg-[#0B0D20]/80 p-3.5 shadow-2xl backdrop-blur-md sm:inset-x-4 sm:bottom-4">
            <p className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#FFBB02]">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFBB02] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FFBB02]" />
              </span>
              Geographic Pinpoint
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
              Click or drag the pin to mark where the outage is happening.
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-[#0B0D20]/80 p-2 text-white/55 backdrop-blur-md transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-6 sm:px-6">
              <div className="pr-10">
                <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                  {isEdit ? 'Update an Incident' : 'Report an Incident'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  {isEdit
                    ? 'Adjust the details below. The saved location stays put until you move the pin.'
                    : 'Pin the fault area, then tell the community what is happening.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => geo.locate()}
                disabled={submitting || geo.isLocating}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#FFBB02]/30 bg-[#FFBB02]/10 text-sm font-bold text-[#FFBB02] transition duration-200 hover:scale-[1.01] hover:bg-[#FFBB02]/15 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {geo.isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                )}
                Use My Current Location
              </button>
              {geo.error ? (
                <p className="mt-2 text-xs font-medium text-[#FFD400]" role="status">
                  {geo.error}
                </p>
              ) : null}

              {formError ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-[#FF2E1F]/35 bg-[#FF2E1F]/10 p-3 text-xs leading-relaxed text-[#FFB4AE]"
                >
                  {formError}
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  label="Severity"
                  value={values.severity}
                  onChange={(event) => setField('severity', event.target.value)}
                  options={severityOptions}
                  loading={referenceLoading}
                  error={errors.severity}
                  labelClassName={FIELD_LABEL}
                  className={FIELD_CONTROL}
                  placeholder="Moderate"
                />
                <Input
                  label="Houses Affected"
                  type="number"
                  min="1"
                  placeholder="e.g. 12"
                  value={values.affectedHouses}
                  onChange={(event) => setField('affectedHouses', event.target.value)}
                  error={errors.affectedHouses}
                  labelClassName={FIELD_LABEL}
                  className={FIELD_CONTROL}
                />
                <Select
                  label="Category"
                  required
                  value={values.category}
                  onChange={(event) => setField('category', event.target.value)}
                  options={categoryOptions}
                  loading={referenceLoading}
                  error={errors.category}
                  labelClassName={FIELD_LABEL}
                  className={FIELD_CONTROL}
                  placeholder="Select a category"
                />
                <Select
                  label="Hazard"
                  value={values.hazardType}
                  onChange={(event) => setField('hazardType', event.target.value)}
                  options={hazardOptions}
                  loading={referenceLoading}
                  error={errors.hazardType}
                  labelClassName={FIELD_LABEL}
                  className={FIELD_CONTROL}
                  placeholder="None"
                />
              </div>

              <div className="mt-3 space-y-3">
                <Input
                  label="Location Name"
                  required
                  placeholder="e.g. Rizal Street, Poblacion"
                  value={values.locationName}
                  onChange={(event) => setField('locationName', event.target.value)}
                  error={errors.locationName}
                  labelClassName={FIELD_LABEL}
                  className={FIELD_CONTROL}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Select
                    label="Barangay"
                    required
                    options={barangays.map((option) => {
                      const unmapped = withoutCoords.includes(option.name);
                      return {
                        value: option.id,
                        label: unmapped ? `${option.name} (no map pin yet)` : option.name,
                        disabled: unmapped,
                      };
                    })}
                    value={values.barangayName}
                    onChange={(event) => handleBarangay(event.target.value)}
                    loading={referenceLoading}
                    error={errors.barangayName}
                    hint={
                      withoutCoords.length
                        ? 'Barangays without a saved map pin cannot be reported yet.'
                        : undefined
                    }
                    labelClassName={FIELD_LABEL}
                    className={FIELD_CONTROL}
                    placeholder="Select a barangay"
                  />
                  <Input
                    label="Started At (optional)"
                    type="datetime-local"
                    value={values.startedAt}
                    onChange={(event) => setField('startedAt', event.target.value)}
                    error={errors.startedAt}
                    labelClassName={FIELD_LABEL}
                    className={FIELD_CONTROL}
                  />
                </div>
                <Textarea
                  label="Description / Notes"
                  required
                  rows={3}
                  placeholder="e.g. Whole street has been dark since 6 PM. Transformer near the barangay hall is not working."
                  value={values.description}
                  onChange={(event) => setField('description', event.target.value)}
                  error={errors.description}
                  labelClassName={FIELD_LABEL}
                  className={`${FIELD_CONTROL} h-auto min-h-[98px] resize-y`}
                  hint={`${String(values.description || '').trim().length}/10 characters minimum`}
                />
              </div>

              {!isEdit ? (
                <div className="mt-3">
                  <ImageUploader
                    value={image}
                    onChange={setImage}
                    progress={progress}
                    uploading={progress > 0 && progress < 100}
                    label="Photo (optional)"
                    labelClassName={FIELD_LABEL}
                    maxWidth="max-w-none"
                    hint="JPG, PNG, WEBP or GIF. A photo helps the utility crew confirm the fault."
                  />
                </div>
              ) : null}

              <div className="mt-4 space-y-2 text-[11px] leading-relaxed text-white/35">
                {!isEdit ? (
                  <>
                    <p className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFBB02]/70" aria-hidden="true" />
                      You can only have one active outage report at a time.
                    </p>
                    <p className="flex items-start gap-2">
                      <Home className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Reports outside Dagupan City are rejected by the server.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Status changes are made by the utility company, so they cannot be edited here.
                    </p>
                    <p className="flex items-start gap-2">
                      <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Only you can edit this report until the company verifies it.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 bg-[#0D0F21]/50 p-4">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFBB02] to-[#FFD400] text-sm font-extrabold text-[#191400] shadow-[0_12px_30px_rgba(255,187,2,0.16)] transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_16px_36px_rgba(255,187,2,0.24)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {isEdit ? 'Save Changes' : 'Submit Community Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
