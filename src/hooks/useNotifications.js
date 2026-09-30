import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readNotification } from '@/utils/records';

/**
 * Notification list for the signed-in user.
 *
 * `notification/get.php` returns the authoritative `unread_count` (total unread,
 * ignoring filters), so the bell uses that instead of counting the visible page.
 */
export function useNotifications({ limit = 50 } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.notifications({ limit }),
    queryFn: async ({ signal }) => {
      const { items, unreadCount } = await notificationsApi.list({ limit }, { signal });
      return { notifications: items.map(readNotification), serverUnreadCount: unreadCount };
    },
    staleTime: 30 * 1000,
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

/** Mark one notification as read (bell count updates immediately). */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const keys = ['notifications'];

  return useMutation({
    mutationFn: (id) => notificationsApi.markAsRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: keys });
      const previous = queryClient.getQueriesData({ queryKey: keys });
      queryClient.setQueriesData({ queryKey: keys }, (current) => {
        const list = current?.notifications;
        if (!Array.isArray(list)) return current;
        return {
          ...current,
          serverUnreadCount: Math.max(0, Number(current.serverUnreadCount ?? 0) - 1),
          notifications: list.map((item) => (String(item.id) === String(id) ? { ...item, isRead: true } : item)),
        };
      });
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
      queryClient.setQueriesData({ queryKey: keys }, (current) => {
        const list = current?.notifications;
        if (!Array.isArray(list)) return current;
        return {
          ...current,
          serverUnreadCount: 0,
          notifications: list.map((item) => ({ ...item, isRead: true })),
        };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys }),
  });
}
