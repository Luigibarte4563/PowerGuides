import { useQuery } from '@tanstack/react-query';
import { companyOutagesApi, maintenanceApi, outagesApi, powerStationsApi } from '@/api';
import { COMPANY_QUERY_KEYS } from '@/utils/constants';

/**
 * The four dashboard counts (FR-DASH-1), refreshed on an interval (FR-DASH-4).
 *
 * Three of the four endpoints return a count only, so they are cheap, but they are
 * still four separate round trips - `Promise.all` keeps the wall-clock cost to one
 * round trip deep. A failure in any one of them degrades that single card to an
 * error state instead of blanking the whole dashboard, which is why each call is
 * settled rather than all-or-nothing.
 */
const REFRESH_INTERVAL_MS = 60 * 1000;

async function settledCount(label, run) {
  try {
    return { [label]: { count: await run(), failed: false } };
  } catch {
    return { [label]: { count: null, failed: true } };
  }
}

export function useCompanySummary({ enabled = true, refetchInterval = REFRESH_INTERVAL_MS } = {}) {
  const query = useQuery({
    queryKey: COMPANY_QUERY_KEYS.summary,
    queryFn: async ({ signal }) => {
      const parts = await Promise.all([
        settledCount('activeOutages', async () => (await outagesApi.getActive({}, { signal })).count),
        settledCount('resolvedOutages', async () => (await outagesApi.getResolved({}, { signal })).count),
        settledCount('upcomingMaintenance', async () => (await maintenanceApi.getUpcoming({}, { signal })).count),
        settledCount('availableStations', async () => (await powerStationsApi.getAvailable({}, { signal })).count),
      ]);

      return parts.reduce((all, part) => ({ ...all, ...part }), {});
    },
    enabled,
    refetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 30 * 1000,
    retry: 1,
  });

  return {
    ...query,
    summary: query.data || null,
    /** True when every count loaded - used to decide whether to show the error banner. */
    isPartial: Boolean(query.data) && Object.values(query.data).some((part) => part.failed),
  };
}

/**
 * The staff outage list (FR-OUT-1/FR-OUT-2).
 *
 * `scope` picks the endpoint: `scoped` is `outage_report_electric_com/get.php` (the
 * company view) and `raw` is `outage/get.php` (FR-OUT-10, which additionally returns
 * `report_key` and accepts category/barangay filters). Only the parameters the
 * selected endpoint actually reads are sent, so no filter is silently ignored.
 */
export function useCompanyOutageList({ scope = 'scoped', status, severity, active, category, barangay } = {}, options = {}) {
  const isRaw = scope === 'raw';

  return useQuery({
    queryKey: isRaw
      ? COMPANY_QUERY_KEYS.rawOutages({ status, category, severity, barangay })
      : COMPANY_QUERY_KEYS.outages({ status, severity, active }),
    queryFn: async ({ signal }) => {
      const result = isRaw
        ? await companyOutagesApi.listRaw({ status, category, severity, barangay }, { signal })
        : await companyOutagesApi.listScoped({ status, severity, active }, { signal });
      return result.items;
    },
    retry: 1,
    ...options,
  });
}
