import { useEffect, useMemo, useState } from 'react';
import { Marker, useMapEvents } from 'react-leaflet';
import { Crosshair, Loader2, MapPin, RotateCcw } from 'lucide-react';
import AppMap, { pinIcon } from './Map';
import { Button } from './ui/Button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { DEFAULT_CENTER } from '@/utils/formatters';

/** Convert Leaflet mouse events into the picked coordinates. */
function ClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) });
    },
  });
  return null;
}

const round6 = (value) => Number(Number(value).toFixed(6));

/**
 * Map used to choose a location for a report, or to adjust the saved user location.
 * Props:
 *   value            { lat, lng } | null
 *   onChange(value)  called whenever the point moves
 *   height           css class for the map area (default h-80)
 *   showGeolocate    render the "use my location" button
 */
export default function MapPicker({
  value = null,
  onChange,
  height = 'h-80 sm:h-96',
  showGeolocate = true,
  disabled = false,
  label = 'Choose a location',
}) {
  const geo = useGeolocation();
  const [internal, setInternal] = useState(value);
  const point = value ?? internal;
  const geoLat = geo.lat;
  const geoLng = geo.lng;

  // Apply browser coordinates as soon as they arrive.
  useEffect(() => {
    if (geoLat === null || geoLng === null) return;
    if (point) return;
    const next = { lat: round6(geoLat), lng: round6(geoLng) };
    setInternal(next);
    onChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoLat, geoLng]);

  const handlePick = (next) => {
    if (disabled) return;
    setInternal(next);
    onChange?.(next);
  };

  const center = useMemo(
    () => (point ? { lat: Number(point.lat), lng: Number(point.lng) } : DEFAULT_CENTER),
    [point]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy-800">
          {label}
          <span className="ml-0.5 text-danger-600" aria-hidden="true">
            *
          </span>
        </p>
        <div className="flex items-center gap-2">
          {showGeolocate ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              icon={geo.isLocating ? Loader2 : Crosshair}
              loading={geo.isLocating}
              onClick={() => geo.locate()}
              disabled={disabled}
            >
              Use my location
            </Button>
          ) : null}
          {point ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={RotateCcw}
              onClick={() => handlePick(null)}
              disabled={disabled}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-card border border-navy-200 ${height}`}>
        <AppMap center={center} zoom={point ? 15 : DEFAULT_CENTER.zoom} className="h-full w-full">
          {!disabled ? <ClickHandler onPick={handlePick} /> : null}
          {point ? (
            <Marker
              position={[Number(point.lat), Number(point.lng)]}
              icon={pinIcon('danger')}
              draggable={!disabled}
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng();
                  handlePick({ lat: round6(lat), lng: round6(lng) });
                },
              }}
            />
          ) : null}
        </AppMap>

        {!point ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center p-3">
            <p className="rounded-full bg-navy-900/85 px-3 py-1.5 text-xs font-medium text-white">
              <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              Tap the map to drop a pin
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-500">
        <span>
          Latitude:{' '}
          <span className="font-semibold text-navy-700">{point ? round6(point.lat).toFixed(6) : '—'}</span>
        </span>
        <span>
          Longitude:{' '}
          <span className="font-semibold text-navy-700">{point ? round6(point.lng).toFixed(6) : '—'}</span>
        </span>
      </div>

      {geo.error ? (
        <p className="text-xs font-medium text-warning-700" role="status">
          {geo.error}
        </p>
      ) : null}
    </div>
  );
}
