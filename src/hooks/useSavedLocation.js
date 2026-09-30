import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { locationApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { coordinatesOf, readUserLocation } from '@/utils/records';

/**
 * The user's saved location (`GET /api/user_location/get.php`), which powers every
 * "near me" feature (power stations, floods, hazards, risks, overview).
 */
export function useSavedLocation() {
  const query = useQuery({
    queryKey: QUERY_KEYS.userLocation,
    queryFn: async ({ signal }) => readUserLocation(await locationApi.get({ signal })),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    ...query,
    location: query.data || null,
    coords: coordinatesOf(query.data),
    hasLocation: Boolean(query.data),
  };
}

/** Save the user's location (`POST /api/user_location/location.php`). */
export function useSaveLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => locationApi.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userLocation });
    },
  });
}
