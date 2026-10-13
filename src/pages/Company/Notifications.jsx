import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Inbox, MailOpen, RefreshCw, Search, Send } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import NotificationCard from '@/components/NotificationCard';
import NotificationDetailModal from '@/components/NotificationDetailModal';
import NotificationTimeline from '@/components/NotificationTimeline';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotificationsHistory,
} from '@/hooks/useNotifications';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { filterNotifications, groupByDay } from '@/utils/notifications';
import { toUserMessage } from '@/utils/errorMessage';
import NotificationComposeModal from './components/NotificationComposeModal';

const TABS = [
  { value: 'all', label: 'All', icon: Inbox },
  { value: 'unread', label: 'Unread', icon: Bell },
  { value: 'read', label: 'Read', icon: MailOpen },
];

/**
 * Module NOT - staff inbox + broadcast composer (FR-NOT-1 … FR-NOT-5).
 *
 * This is the signed-in staff member's own inbox (`notification/get.php` is
 * user-scoped with no role check), which is a different thing from the resident
 * broadcast the company sends - the two are kept apart deliberately so a broadcast is
 * never mistaken for an internal update.
 *
 * Shares the history components with the resident app: `get.php` reports `total` as
 * the PAGE size, so both screens page with "Load more" instead of page numbers, and
 * both render the message in full rather than clamped to two lines.
 */
export default function Notifications() {
  const { isManager } = useAuth();
  const { notificationTypes } = useReference();
  const toast = useToast();

  const [tab, setTab] = useState('all');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);

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
  const markAll = useMarkAllAsRead();

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
        description="Your inbox, and the broadcast composer for resident updates."
        actions={
          <>
            <Button variant="ghost" icon={RefreshCw} loading={isLoading} onClick={() => refetch()}>
              Refresh
            </Button>
            <Button variant="outline" icon={CheckCheck} onClick={() => markAll.mutate()} loading={markAll.isPending} disabled={unreadCount === 0}>
              Mark all read
            </Button>
            {isManager ? (
              <Button variant="primary" icon={Send} onClick={() => setComposeOpen(true)}>
                Send notification
              </Button>
            ) : null}
          </>
        }
      />

      {!isManager ? (
        <Card>
          <CardBody>
            <p className="text-sm text-navy-600">
              Sending notifications to residents is limited to electric company and admin accounts,
              so the composer is not shown for your role.
            </p>
          </CardBody>
        </Card>
      ) : null}

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
        tabs={TABS.map((item) => ({
          ...item,
          count: item.value === 'unread' ? unreadCount : undefined,
        }))}
        value={tab}
        onChange={setTab}
        ariaLabel="Notification filter"
      />

      <NotificationTimeline
        groups={groups}
        isLoading={isLoading}
        error={isError ? error : null}
        onRetry={() => refetch()}
        loadingLabel="Loading notifications…"
        hasMore={hasNextPage}
        isFetchingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        loadedCount={notifications.length}
        renderItem={renderItem}
        empty={{
          icon: debouncedSearch || type ? Search : Inbox,
          title: debouncedSearch || type
            ? 'No notifications match'
            : tab === 'unread'
              ? 'Nothing unread'
              : tab === 'read'
                ? 'No read notifications yet'
                : 'No notifications yet',
          description: debouncedSearch || type
            ? 'Try a different search term or type, or load older notifications.'
            : 'Outage, maintenance, hazard and flood updates for your account land here.',
        }}
      />

      <NotificationDetailModal
        notification={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onMarkRead={handleMarkRead}
        isMarking={markingId !== null && markingId === selected?.id}
      />

      <NotificationComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}