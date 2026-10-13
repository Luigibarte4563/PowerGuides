import { useMemo, useState } from 'react';
import { Bell, BellOff, CheckCheck, RefreshCw, Search } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody } from '@/components/ui/Card';
import NotificationCard from '@/components/NotificationCard';
import NotificationDetailModal from '@/components/NotificationDetailModal';
import NotificationTimeline from '@/components/NotificationTimeline';
import { useToast } from '@/context/ToastContext';
import { useReference } from '@/context/ReferenceContext';
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotificationsHistory,
} from '@/hooks/useNotifications';
import { filterNotifications, groupByDay } from '@/utils/notifications';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { toUserMessage } from '@/utils/errorMessage';

/**
 * Module E - notification history (current user only).
 *
 * The list is a date-grouped timeline rather than a flat table, and the message is
 * rendered in full: the previous card clamped it to two lines, which cut the
 * maintenance copy - the one notification whose message actually carries the
 * information - to a fragment with no way to see the rest.
 */
export default function Notifications() {
  const [tab, setTab] = useState('all');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const toast = useToast();
  const { notificationTypes } = useReference();

  // Debounced so a keystroke does not re-filter the whole loaded history per character.
  const debouncedSearch = useDebouncedValue(search, 250);

  const {
    notifications,
    unreadCount,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isError,
    error,
    refetch,
  } = useNotificationsHistory({ pageSize: 25 });

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const visible = useMemo(
    () => filterNotifications(notifications, { query: debouncedSearch, type, tab }),
    [notifications, debouncedSearch, type, tab]
  );

  const groups = useMemo(() => groupByDay(visible), [visible]);

  const handleMarkRead = async (notification) => {
    setMarkingId(notification.id);
    try {
      await markAsRead.mutateAsync(notification.id);
    } catch (markError) {
      toast.error(toUserMessage(markError, 'We could not mark that notification as read.'));
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead.mutateAsync();
      toast.success('All notifications marked as read.', { title: 'Updated' });
    } catch (markAllError) {
      toast.error(toUserMessage(markAllError, 'We could not mark your notifications as read.'));
    }
  };

  const renderItem = (notification) => (
    <NotificationCard
      notification={notification}
      onView={setSelected}
      onMarkRead={handleMarkRead}
      isMarking={markingId !== null && markingId === notification.id}
      markReadDisabled={markAsRead.isPending}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Everything sent to your account, newest first, grouped by day."
        actions={
          <>
            <Button variant="ghost" icon={RefreshCw} loading={isLoading} onClick={() => refetch()}>
              Refresh
            </Button>
            <Button
              variant="outline"
              icon={CheckCheck}
              onClick={handleMarkAll}
              loading={markAllAsRead.isPending}
              disabled={unreadCount === 0}
            >
              Mark all as read
            </Button>
          </>
        }
      />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search titles and messages"
            hint="Filters the notifications loaded so far."
          />
          <Select
            label="Type"
            options={notificationTypes}
            placeholder="All types"
            value={type}
            onChange={(event) => setType(event.target.value)}
            hint="Filters the notifications loaded so far."
          />
        </CardBody>
      </Card>

      <Tabs
        tabs={[
          { value: 'all', label: 'All', count: notifications.length },
          { value: 'unread', label: 'Unread', count: unreadCount },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="Notification filters"
      />

      {unreadCount > 0 ? (
        <Card>
          <CardBody className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-100 text-primary-700">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-navy-900">
                You have {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
              </p>
              <p className="mt-0.5 text-sm text-navy-500">
                Mark them as read once you have taken note so your count stays accurate.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <NotificationTimeline
        groups={groups}
        isLoading={isLoading}
        error={isError ? error : null}
        onRetry={() => refetch()}
        loadingLabel="Loading your notifications…"
        hasMore={hasNextPage}
        isFetchingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        loadedCount={notifications.length}
        renderItem={renderItem}
        empty={{
          icon: debouncedSearch || type ? Search : tab === 'unread' ? BellOff : Bell,
          title: debouncedSearch || type
            ? 'No notifications match'
            : tab === 'unread'
              ? 'Nothing unread'
              : 'No notifications yet',
          description: debouncedSearch || type
            ? 'Try a different search term or type, or load older notifications.'
            : tab === 'unread'
              ? 'You are all caught up. New alerts will appear here.'
              : 'When an outage near you is reported or resolved, you will be notified here.',
        }}
      />

      <NotificationDetailModal
        notification={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onMarkRead={handleMarkRead}
        isMarking={markingId !== null && markingId === selected?.id}
      />
    </div>
  );
}