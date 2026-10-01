import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COMPANY_QUERY_KEYS } from '@/utils/constants';
import { linemanAssignmentsApi } from '@/api';

/**
 * Assignment queries.
 *
 * Manager-scoped reads live under `COMPANY_QUERY_KEYS` (the `/company` app); the
 * lineman's own read is enabled only for a lineman, so a manager never fires a request
 * that `my.php` would answer 403 for.
 *
 * `enabled` is what keeps a 403 off the wire in the first place - it is a convenience,
 * not the authorization, which is the server's job either way.
 */
export function useAssignmentList(
  { linemanId, barangayId, status } = {},
  { enabled = true } = {}
) {
  const filters = { linemanId, barangayId, status };

  return useQuery({
    queryKey: COMPANY_QUERY_KEYS.linemanAssignments(filters),
    queryFn: async ({ signal }) =>
      (await linemanAssignmentsApi.list(filters, { signal })).items,
    enabled,
    retry: 1,
  });
}

/** The assignable linemen for the picker. Managers only. */
export function useLinemenList({ enabled = true } = {}) {
  return useQuery({
    queryKey: COMPANY_QUERY_KEYS.linemen,
    queryFn: async ({ signal }) => (await linemanAssignmentsApi.listLinemen({}, { signal })).items,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * The signed-in lineman's own active assignments, from `my.php`.
 *
 * Read back from the server rather than derived from the role, which is the point: the
 * outage list a lineman sees is scoped by these rows on the backend, so the UI offers a
 * filter from the same source of truth instead of guessing at one.
 */
export function useMyAssignments({ enabled = true } = {}) {
  return useQuery({
    queryKey: COMPANY_QUERY_KEYS.myAssignments,
    queryFn: async ({ signal }) => (await linemanAssignmentsApi.listMine({}, { signal })).items,
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

/**
 * Invalidate everything that assignments feed.
 *
 * A single call covers the manager table, the lineman picker and every lineman's own
 * scope - including the outage lists, which are filtered by these rows server-side and
 * would otherwise keep showing outages the lineman can no longer open.
 */
export function useInvalidateAssignments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['lineman-assignments'] });
}