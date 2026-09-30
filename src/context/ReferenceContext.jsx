import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getReference } from '@/api';
import { useAuth } from './AuthContext';
import { REFERENCE_KEYS, QUERY_KEYS } from '@/utils/constants';
import { readField, toNumber } from '@/utils/formatters';

const ReferenceContext = createContext(null);

/**
 * Label columns used by `reference/get.php`. Each table has its own:
 *   roles -> role_name, barangays -> barangay_name, outage_categories -> category_name,
 *   severity_levels -> severity_name, hazard_types -> hazard_name,
 *   outage_statuses -> status_name, power_station_types -> type_name,
 *   safety_timer_types -> timer_name, notification_types -> type_name.
 *
 * The API looks these up by NAME (`category`, `severity`, `hazard_type`,
 * `timer_type_name`, ...), so the option value is the name, not the row id.
 */
const LABEL_KEYS = [
  'name',
  'barangay_name',
  'category_name',
  'severity_name',
  'hazard_name',
  'status_name',
  'role_name',
  'timer_name',
  'type_name',
  'label',
  'value',
  'code',
  'title',
];

function normaliseOptions(value) {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).map(([key, item]) =>
          item && typeof item === 'object' ? { id: item.id ?? key, name: item.name ?? item.label ?? key } : { id: key, name: String(item) }
        )
      : [];

  return list
    .map((item) => {
      if (item === null || item === undefined) return null;
      if (typeof item === 'string' || typeof item === 'number') {
        return { id: item, name: String(item), raw: item };
      }

      const label = readField(item, LABEL_KEYS, '');
      if (!String(label).trim()) return null;

      return {
        id: String(label).trim(),
        name: String(label).trim(),
        rowId: readField(item, ['id'], null),
        // Extra columns some forms rely on.
        defaultDurationHours: toNumber(readField(item, ['default_duration_hours'], null), null),
        warningHoursBefore: toNumber(readField(item, ['warning_hours_before'], null), null),
        latitude: toNumber(readField(item, ['latitude'], null), null),
        longitude: toNumber(readField(item, ['longitude'], null), null),
        raw: item,
      };
    })
    .filter(Boolean);
}

/**
 * Loads `GET /api/reference/get.php` once and shares it with every form and filter.
 */
export function ReferenceProvider({ children }) {
  const { isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: QUERY_KEYS.reference,
    queryFn: ({ signal }) => getReference({ signal }),
    // Reference data is only needed by signed-in users; skipping it on the
    // public pages keeps the landing/login/register screens request-free.
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 60, // 1 hour - reference data rarely changes
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  const value = useMemo(() => {
    const raw = query.data || {};
    const pick = (key) => {
      for (const candidate of REFERENCE_KEYS[key] || []) {
        if (raw?.[candidate] !== undefined && raw?.[candidate] !== null) return raw[candidate];
      }
      return [];
    };

    return {
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      error: query.error,
      refetch: query.refetch,
      raw,
      roles: normaliseOptions(pick('roles')),
      barangays: normaliseOptions(pick('barangays')),
      outageCategories: normaliseOptions(pick('outageCategories')),
      severityLevels: normaliseOptions(pick('severityLevels')),
      hazardTypes: normaliseOptions(pick('hazardTypes')),
      statuses: normaliseOptions(pick('statuses')),
      powerStationTypes: normaliseOptions(pick('powerStationTypes')),
      safetyTimerTypes: normaliseOptions(pick('safetyTimerTypes')),
      notificationTypes: normaliseOptions(pick('notificationTypes')),
    };
  }, [query.data, query.isLoading, query.isFetching, query.error, query.refetch]);

  return <ReferenceContext.Provider value={value}>{children}</ReferenceContext.Provider>;
}

export function useReference() {
  const context = useContext(ReferenceContext);
  if (!context) throw new Error('useReference must be used inside a <ReferenceProvider>');
  return context;
}

/**
 * Pick a reference option by id (or by name when the API returns strings).
 * Returns `null` when nothing matches so callers can fall back gracefully.
 */
export function findOption(options, value) {
  if (value === undefined || value === null || value === '') return null;
  const target = String(value).trim().toLowerCase();
  return (
    options.find((option) => String(option.id).trim().toLowerCase() === target) ||
    options.find((option) => String(option.name).trim().toLowerCase() === target) ||
    null
  );
}

/** Convenience hook for the common "map a record field to an option id" case. */
export function useOptionMap() {
  return useMemo(
    () => (options, value) => {
      const option = findOption(options, value);
      return {
        id: option ? option.id : value ?? null,
        name: option ? option.name : value ?? '',
        numericId: toNumber(option?.id, null),
      };
    },
    []
  );
}
