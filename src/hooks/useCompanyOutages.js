import { useQuery } from '@tanstack/react-query';
import {
  companyOutagesApi,
  floodsApi,
  hazardsApi,
  heatmapApi,
  linemanAssignmentsApi,
  maintenanceApi,
  outagesApi,
  powerStationsApi,
} from '@/api';
import { COMPANY_QUERY_KEYS } from '@/utils/constants';

/**
 * Dashboard counts, refreshed on an interval.
 *
 * Every figure is settled individually, so one endpoint failing degrades its own card to
 * a dash instead of blanking the dashboard. That matters more as the card count grows:
 * with a dozen independent endpoints, all-or-nothing would make a single 403 take out the
 * whole page.
 *
 * Two rules govern which counts are safe to show a lineman:
 *
 *  1. `outage_report/get_active`, `get_resolve` and the `outage/*` endpoints are all
 *     scoped to the caller's active assignments server-side, so the numbers a lineman
 *     sees agree with the rows they can open.
 *  2. `maintenance/get_complete` and `lineman_assignment/*` are manager-only, so they are
 *     only requested when `includeManagerCounts` is set. Skipping them entirely - rather
 *     than fetching and handling the 403 - keeps a lineman from putting requests on the
 *     wire that are certain to be refused. This is a convenience, not a control: the
 *     server rejects them either way.
 */
const REFRESH_INTERVAL_MS = 60 * 1000;

async function settledCount(label, run) {
  try {
    return { [label]: { count: await run(), failed: false } };
  } catch {
    return { [label]: { count: null, failed: true } };
  }
}

export function useCompanySummary({
  enabled = true,
  refetchInterval = REFRESH_INTERVAL_MS,
  includeManagerCounts = true,
} = {}) {
  const query = useQuery({
    // The flag is part of the key so a manager's fuller summary and a lineman's reduced
    // one cannot overwrite each other in the cache when switching accounts.
    queryKey: [...COMPANY_QUERY_KEYS.summary, { includeManagerCounts }],
    queryFn: async ({ signal }) => {
      /*
       * All of these are issued together rather than in sequence. Awaiting the
       * manager-only group first would add its round trip to every other request's
       * latency for no reason - they are independent reads.
       */
      const parts = await Promise.all([
        /* --- Outage reports --- */
        settledCount('activeOutages', async () => (await outagesApi.getActive({}, { signal })).count),
        settledCount('resolvedOutages', async () => (await outagesApi.getResolved({}, { signal })).count),
        // `count` on the unscoped company list, so the status cards below can be shown
        // as a proportion of the whole rather than as bare numbers.
        settledCount('totalOutages', async () => (await companyOutagesApi.listScoped({}, { signal })).count),
        settledCount('underReviewOutages', async () =>
          (await companyOutagesApi.listScoped({ status: 'under_review' }, { signal })).count
        ),
        settledCount('verifiedOutages', async () =>
          (await companyOutagesApi.listScoped({ status: 'verified' }, { signal })).count
        ),

        /* --- Maintenance --- */
        settledCount('upcomingMaintenance', async () => (await maintenanceApi.getUpcoming({}, { signal })).count),

        /* --- Power stations --- */
        settledCount('availableStations', async () => (await powerStationsApi.getAvailable({}, { signal })).count),

        /* --- Electrical hazards --- */
        settledCount('openHazards', async () => (await hazardsApi.list({ status: 'reported' }, { signal })).count),
        settledCount('verifiedHazards', async () => (await hazardsApi.list({ status: 'verified' }, { signal })).count),

        /* --- Flood reports --- */
        settledCount('openFloods', async () => (await floodsApi.list({ status: 'reported' }, { signal })).count),

        /* --- Clusters (computed outage groupings) --- */
        settledCount('activeClusters', async () => (await heatmapApi.getClusters({ status: 'active' }, { signal })).count),

        /* --- Reports in the heatmap lookback window --- */
        settledCount('recentHeatmapReports', async () =>
          (await heatmapApi.getHeatmap({ days: 7 }, { signal })).reportCount
        ),

        /* --- Manager-only (see rule 2 above) --- */
        includeManagerCounts
          ? settledCount('completedMaintenance', async () =>
              (await maintenanceApi.getComplete({}, { signal })).count
            )
          : null,
        includeManagerCounts
          ? settledCount('activeAssignments', async () =>
              (await linemanAssignmentsApi.list({ status: 'active' }, { signal })).count
            )
          : null,
        includeManagerCounts
          ? settledCount('totalAssignments', async () =>
              (await linemanAssignmentsApi.list({}, { signal })).count
            )
          : null,
      ]);

      return parts.filter(Boolean).reduce((all, part) => ({ ...all, ...part }), {});
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
    /** True when at least one count failed - drives the partial-failure banner. */
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