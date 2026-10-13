import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { flattenNotificationPages } from '@/utils/notifications';
import { readNotification } from '@/utils/records';

/**
 * Notification list for the signed-in user.
 *
 * `notification/get.php` returns the authoritative `unread_count` (total unread,
 * ignoring filters), so the bell uses that instead of counting the visible page.
 *
 * `staleTime` is short and window-focus refetching is on, because notifications
 * arrive from the server while the app is open (a maintenance broadcast, a
 * status change) and a 30s cache made the list look broken when it simply had
 * not been refetched. The page also exposes a manual Refresh button through the
 * returned `refetch`.
 */
export function useNotifications({ limit = 50 } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.notifications({ limit }),
    queryFn: async ({ signal }) => {
      const { items, unreadCount } = await notificationsApi.list({ limit }, { signal });
      return { notifications: items.map(readNotification), serverUnreadCount: unreadCount };
    },
    staleTime: 5 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const notifications = query.data?.notifications || [];
  const localUnread = notifications.filter((item) => !item.isRead).length;
  const unreadCount = query.data ? Number(query.data.serverUnreadCount ?? localUnread) : 0;

  return {
    ...query,
    notifications,
    unreadCount,
    unread: notifications.filter((item) => !item.isRead),
  };
}

/**
 * Paged history for the notification timeline.
 *
 * `notification/get.php` reports `total` as the PAGE size rather than a grand total,
 * so "Page 1 of N" cannot be derived from the server. Load-more pages by `offset`
 * instead, and treat a short page as the end of the list.
 *
 * `unread_count` is a per-user total that ignores both `offset` and every filter, so
 * it is identical on every page - only the first one is trusted, otherwise a later
 * page would overwrite a correct count with the same value after a filter change.
 *
 * Pages are deduplicated on flatten because a notification created between two
 * fetches shifts every later row by one and would otherwise show up twice.
 *
 * `refetchOnWindowFocus` is off here (unlike `useNotifications`): pulling a fresh
 * first page while the user is reading would reshuffle the groups under them.
 */
export function useNotificationsHistory({ pageSize = 25 } = {}) {
  const query = useInfiniteQuery({
    queryKey: ['notifications', 'history', { pageSize }],
    queryFn: async ({ pageParam, signal }) => {
      const { items, unreadCount } = await notificationsApi.list(
        { limit: pageSize, offset: pageParam },
        { signal }
      );
      return { items: items.map(readNotification), unreadCount };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // A full page means there may be more; the offset of the next page is the
      // number of rows loaded so far.
      if (!lastPage?.items || lastPage.items.length < pageSize) return undefined;
      return allPages.reduce((total, page) => total + (page?.items?.length || 0), 0);
    },
    staleTime: 5 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const notifications = flattenNotificationPages(query.data?.pages);

  return {
    ...query,
    notifications,
    unreadCount: Number(query.data?.pages?.[0]?.unreadCount ?? 0),
    hasMore: query.hasNextPage,
  };
}

/**
 * Flip `isRead` inside whatever cache shape a `['notifications']` query holds.
 *
 * There are two of them: the bell's `useNotifications` stores
 * `{ notifications, serverUnreadCount }`, while the history query stores the
 * infinite-query `{ pages }` envelope. Both are updated in place so the bell badge and
 * the timeline agree immediately; `onSettled` still refetches to reconcile with the
 * server.
 */
function markReadInCache(current, { id, all }) {
  if (!current) return current;

  const flip = (item) => {
    if (all || String(item?.id) === String(id)) return { ...item, isRead: true };
    return item;
  };

  // Infinite-query shape (notification history).
  if (Array.isArray(current.pages)) {
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: Array.isArray(page?.items) ? page.items.map(flip) : page?.items,
      })),
    };
  }

  const list = current.notifications;
  if (!Array.isArray(list)) return current;
  return {
    ...current,
    serverUnreadCount: all
      ? 0
      : Math.max(0, Number(current.serverUnreadCount ?? 0) - 1),
    notifications: list.map(flip),
  };
}

/** Mark one notification as read (bell count updates immediately). */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const keys = ['notifications'];

  return useMutation({
    mutationFn: (id) => notificationsApi.markAsRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: keys });
      const previous = queryClient.getQueriesData({ queryKey: keys });
      queryClient.setQueriesData({ queryKey: keys }, (current) =>
        markReadInCache(current, { id, all: false })
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys }),
  });
}

/** Mark every notification as read. */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const keys = ['notifications'];

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: keys });
      const previous = queryClient.getQueriesData({ queryKey: keys });
      queryClient.setQueriesData({ queryKey: keys }, (current) =>
        markReadInCache(current, { id: null, all: true })
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys }),
  });
}
