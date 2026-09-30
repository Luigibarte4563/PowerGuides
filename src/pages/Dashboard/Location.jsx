import { useEffect, useState } from 'react';
import { Crosshair, Info, Loader2, MapPin, Save, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AuthAlert, AuthSuccess, InfoNote } from '@/components/ui/Alert';
import { ErrorState, LoadingState } from '@/components/ui/States';
import AppMap, { MapPin as MapPinMarker } from '@/components/Map';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useSaveLocation, useSavedLocation } from '@/hooks/useSavedLocation';
import { toUserMessage } from '@/utils/errorMessage';
import { formatDateTime } from '@/utils/formatters';
import { validateRequired } from '@/utils/validators';

/**
 * Module F - the user's saved location.
 *
 * `user_location/location.php` takes `address` (required) and `barangay_name`, then
 * GEOCODES the address server-side - the client cannot send coordinates. So the form
 * is address-first: type an address (or use the device location, which fills in the
 * coordinates) and the map shows the resolved point afterwards.
 */
export default function Location() {
  const { location, isLoading, isError, error, refetch } = useSavedLocation();
  const saveLocation = useSaveLocation();
  const { barangays } = useReference();
  const toast = useToast();
  const geo = useGeolocation();

  const [address, setAddress] = useState('');
  const [barangayName, setBarangayName] = useState('');
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!location) return;
    setAddress(location.address || location.locationName || '');
    setBarangayName(location.barangay || '');
  }, [location]);

  // Offer the device coordinates as the address so the server can resolve them.
  const useMyLocation = () => {
    geo.locate();
  };

  useEffect(() => {
    if (geo.lat === null || geo.lng === null) return;
    setAddress(`${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`);
    setSaved(false);
  }, [geo.lat, geo.lng]);

  const handleSave = async () => {
    setFormError('');
    setSaved(false);

    const required = validateRequired(address, 'Address');
    if (required) {
      setFormError(required);
      return;
    }

    try {
      await saveLocation.mutateAsync({
        address: address.trim(),
        barangay_name: barangayName || undefined,
      });
      setSaved(true);
      toast.success('Your location was saved.', { title: 'Location updated' });
    } catch (saveError) {
      setFormError(
        toUserMessage(saveError, 'We could not resolve that address. Try adding more detail, like the barangay.')
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Location"
        description="This location powers nearby power stations, floods, hazards and risk areas."
      />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader description="Type the address PowerGuide should use when it looks up nearby reports.">
            Your address
          </CardHeader>
          <CardBody className="space-y-4">
            {isLoading ? (
              <LoadingState label="Loading your saved location…" />
            ) : isError ? (
              <ErrorState message={toUserMessage(error)} onRetry={() => refetch()} />
            ) : (
              <>
                {formError ? <AuthAlert>{formError}</AuthAlert> : null}
                {saved ? <AuthSuccess>Your location is up to date.</AuthSuccess> : null}

                <Input
                  label="Address"
                  required
                  placeholder="e.g. San Carlos Cathedral, Dagupan City"
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    setSaved(false);
                  }}
                  hint="The server resolves this into map coordinates and matches your barangay."
                />

                <Select
                  label="Barangay (optional)"
                  placeholder="Detected automatically"
                  options={barangays}
                  value={barangayName}
                  onChange={(event) => {
                    setBarangayName(event.target.value);
                    setSaved(false);
                  }}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    icon={saveLocation.isPending ? Loader2 : Save}
                    loading={saveLocation.isPending}
                    onClick={handleSave}
                  >
                    Save location
                  </Button>
                  <Button
                    variant="outline"
                    icon={geo.isLocating ? Loader2 : Crosshair}
                    loading={geo.isLocating}
                    onClick={useMyLocation}
                  >
                    Use my current location
                  </Button>
                </div>

                {geo.error ? (
                  <p className="text-xs font-medium text-warning-700" role="status">
                    {geo.error}
                  </p>
                ) : null}

                <InfoNote>
                  PowerGuide stores one primary location. Nearby searches use it as the centre point.
                </InfoNote>
              </>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              description={
                location
                  ? 'The point PowerGuide resolved from your address'
                  : 'Save an address to see it on the map'
              }
            >
              Saved location
            </CardHeader>
            <CardBody>
              {isLoading ? (
                <LoadingState label="Loading…" />
              ) : location ? (
                <>
                  <div className="h-64 w-full overflow-hidden rounded-card border border-navy-200">
                    <AppMap center={{ lat: location.lat, lng: location.lng }} zoom={15} className="h-full w-full">
                      <MapPinMarker position={{ lat: location.lat, lng: location.lng }} tone="success">
                        <p className="font-bold text-navy-900">
                          {location.address || location.locationName || 'Your saved location'}
                        </p>
                        {location.barangay ? (
                          <p className="mt-1 text-xs text-navy-500">{location.barangay}</p>
                        ) : null}
                      </MapPinMarker>
                    </AppMap>
                  </div>

                  <dl className="mt-4 space-y-3 text-sm">
                    <Row icon={MapPin} label="Coordinates" value={`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`} />
                    <Row icon={Crosshair} label="Address" value={location.address || location.locationName || '—'} />
                    {location.barangay ? (
                      <Row icon={ShieldCheck} label="Barangay" value={location.barangay} />
                    ) : null}
                    {location.updatedAt ? (
                      <Row icon={Info} label="Last saved" value={formatDateTime(location.updatedAt)} />
                    ) : null}
                  </dl>
                </>
              ) : (
                <p className="rounded-card border border-dashed border-navy-200 bg-canvas p-6 text-center text-sm text-navy-500">
                  No location saved yet. Enter your address on the left and press Save.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Why we need your location</CardHeader>
            <CardBody>
              <ul className="space-y-2 text-sm text-navy-600">
                {[
                  'Find the closest available power stations.',
                  'See active floods within a chosen radius.',
                  'Get unresolved electrical hazards near you.',
                  'Centre the risk-area map and the outage heatmap.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <InfoNote className="mt-4">
                Your location personalises nearby results on your own account. It is never shared as an
                exact address with other users.
              </InfoNote>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex shrink-0 items-center gap-2 text-navy-500">
        <Icon className="h-4 w-4 text-navy-400" aria-hidden="true" />
        {label}
      </dt>
      <dd className="truncate text-right font-semibold text-navy-800">{value}</dd>
    </div>
  );
}
