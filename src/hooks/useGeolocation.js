import { useCallback, useEffect, useRef, useState } from 'react';

const GEO_STATES = {
  IDLE: 'idle',
  LOCATING: 'locating',
  SUCCESS: 'success',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
};

/**
 * Browser geolocation with graceful handling of permission denial.
 *
 * ```js
 * const { state, coords, error, locate, supported } = useGeolocation();
 * ```
 */
export function useGeolocation({ auto = false, timeout = 15000, highAccuracy = true } = {}) {
  const supported =
    typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

  const [state, setState] = useState(GEO_STATES.IDLE);
  const [coords, setCoords] = useState(null); // { lat, lng, accuracy }
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const locate = useCallback(() => {
    if (!supported) {
      setState(GEO_STATES.UNAVAILABLE);
      setError('This browser cannot share your location. Please set it manually on the map.');
      return;
    }

    setState(GEO_STATES.LOCATING);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return;
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
        });
        setState(GEO_STATES.SUCCESS);
      },
      (geoError) => {
        if (!mounted.current) return;
        if (geoError.code === 1) {
          setState(GEO_STATES.DENIED);
          setError(
            'Location access was blocked. You can still set your location by tapping the map.'
          );
        } else if (geoError.code === 3) {
          setState(GEO_STATES.ERROR);
          setError('Finding your location took too long. Please try again or tap the map.');
        } else {
          setState(GEO_STATES.ERROR);
          setError('We could not get your location. Please tap the map to set it manually.');
        }
      },
      { enableHighAccuracy: highAccuracy, timeout, maximumAge: 60000 }
    );
  }, [supported, timeout, highAccuracy]);

  useEffect(() => {
    if (auto && supported && state === GEO_STATES.IDLE) locate();
    // Only run on mount / when `auto` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return {
    supported,
    state,
    isLocating: state === GEO_STATES.LOCATING,
    coords,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    error,
    locate,
    reset: () => {
      setState(GEO_STATES.IDLE);
      setError('');
    },
  };
}

export const GEO = GEO_STATES;
