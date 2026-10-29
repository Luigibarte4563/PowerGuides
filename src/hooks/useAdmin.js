import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { ADMIN_QUERY_KEYS } from '@/utils/constants';

/**
 * Admin queries (`/admin`, role `admin` only).
 *
 * Every call here targets a `requireRole(['admin'])` endpoint, so `enabled` keeps the
 * requests off the wire for any other role - a convenience, not the authorization,
 * which the server does anyway.
 */
export function useAdminUsers({ role, q } = {}, { enabled = true } = {}) {
  const filters = { role, q };

  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.users(filters),
    queryFn: async ({ signal }) => (await adminApi.listUsers(filters, { signal })).items,
    enabled,
    retry: 1,
  });
}

/** Platform aggregates for the admin overview. One endpoint, refreshed on an interval. */
export function useAdminStats({ enabled = true } = {}) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.stats,
    queryFn: async ({ signal }) => adminApi.stats({}, { signal }),
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

/**
 * Change a user's role.
 *
 * Invalidates the directory and the stats (the by-role counts move with the change).
 * The JWT carries the role claim, so the target keeps their old permissions until
 * their next sign-in - the mutation result's message says so, and the caller shows it.
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId }) => adminApi.updateRole({ userId, roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats });
    },
  });
}

/**
 * Create an account, with a role chosen at creation time.
 *
 * Same invalidations as a role change: the directory gains a row and the by-role
 * counts in the stats move. The new account signs in through the ordinary login
 * form - no session is created for it here.
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (form) => adminApi.createUser(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats });
    },
  });
}
