import { useMemo } from 'react';
import { findOption, useReference } from '@/context/ReferenceContext';
import { hasCoordinates } from '@/utils/formatters';

/**
 * The barangay is the coordinate authority.
 *
 * Coordinates used to come from geocoding the free-text address, which meant a
 * resident typing "Barangay I" could put their report in the wrong barangay, or
 * on the wrong continent. Now the chosen barangay supplies the point from
 * `barangays.latitude/longitude` (served by `reference/get.php`) and the address
 * field is only the label other people read.
 *
 * `reference/get.php` selects those two columns and `ReferenceContext` already
 * maps them onto each option, so this hook is just lookup sugar plus the one
 * thing every form needs to know: which barangays have no coordinates yet and
 * would be rejected by the API.
 */

/** Reads coordinates off a normalised reference option. */
export function barangayCoords(option) {
  if (!hasCoordinates(option?.latitude, option?.longitude)) return null;
  return {
    lat: Number(Number(option.latitude).toFixed(6)),
    lng: Number(Number(option.longitude).toFixed(6)),
  };
}

export function useBarangayCoords() {
  const { barangays } = useReference();

  return useMemo(() => {
    /**
     * Coordinates for a barangay name, or null when the name is empty, unknown,
     * or that barangay has no stored coordinates (the API answers 503 for the
     * last case, so the form can warn before the user submits).
     */
    const coordsFor = (name) => barangayCoords(findOption(barangays, name));

    /** Names the API will refuse, so a form can disable them up front. */
    const withoutCoords = barangays
      .filter((option) => !barangayCoords(option))
      .map((option) => option.name);

    return { coordsFor, withoutCoords };
  }, [barangays]);
}

/**
 * Copy shared by every form's address field. The field is a label now - saying
 * otherwise is what led people to expect the server to resolve it.
 */
export const ADDRESS_HINT =
  'Shown to others as the address. The map position comes from the barangay below.';

export const PIN_HINT =
  'Picking a barangay drops the pin on that barangay. Drag it to a more exact spot if you can.';