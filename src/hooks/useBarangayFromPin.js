import { useMemo } from 'react';
import { useReference } from '@/context/ReferenceContext';
import { distanceInMeters, formatDistance } from '@/utils/formatters';

/**
 * How far a pin may sit from a barangay centre and still be attributed to it.
 * Dagupan's barangay centres are ~1-4 km apart, so this catches a pin dropped
 * anywhere in the city while refusing to guess for one dropped far outside it.
 */
export const BARANGAY_MATCH_LIMIT_METERS = 3000;

/**
 * The barangay whose centre is closest to `point`, or `null` when the point is
 * unusable or the nearest centre is out of range.
 *
 * `barangays` are the normalised options from `useReference()`; each carries
 * `latitude` / `longitude` because `reference/get.php` selects them.
 *
 * This mirrors the server-side match in `outage_report/create.php` (which uses
 * the same "nearest centre" idea with per-barangay radii) so the form shows the
 * same barangay that gets stored.
 */
export function nearestBarangay(point, barangays = [], limit = BARANGAY_MATCH_LIMIT_METERS) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng ?? point?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Array.isArray(barangays)) return null;

  let best = null;
  for (const barangay of barangays) {
    const centreLat = Number(barangay?.latitude);
    const centreLng = Number(barangay?.longitude);
    if (!Number.isFinite(centreLat) || !Number.isFinite(centreLng)) continue;

    const distance = distanceInMeters(lat, lng, centreLat, centreLng);
    if (distance === null) continue;
    if (!best || distance < best.distance) {
      best = { name: barangay.name, distance };
    }
  }

  if (!best || best.distance > limit) return null;
  return best;
}

/**
 * Returns `matchBarangay(point)` for the report forms: drop a pin (or use
 * "Use my location") and the barangay field fills itself in.
 *
 * Returns `null` rather than a guess when the pin cannot be matched, so a pin
 * dropped outside the city leaves the field untouched instead of silently
 * mis-labelling the report.
 */
export function useBarangayFromPin() {
  const { barangays } = useReference();

  return useMemo(
    () => (point) => nearestBarangay(point, barangays),
    [barangays]
  );
}

/** "Matched from your pin · 320 m from the Lucao centre" */
export function barangayMatchHint(match) {
  if (!match) return undefined;
  return `Matched from your pin · ${formatDistance(match.distance)} from the ${match.name} centre`;
}
