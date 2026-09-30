import { useState } from 'react';
import { Bell, CheckCheck, Inbox, MailOpen, Send } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useMarkAllAsRead, useMarkAsRead, useNotifications } from '@/hooks/useNotifications';
import { formatDateTime, formatRelativeTime, humanize } from '@/utils/formatters';
import NotificationComposeModal from './components/NotificationComposeModal';

const TABS = [
  { value: 'all', label: 'All', icon: Inbox },
  { value: 'unread', label: 'Unread', icon: Bell },
  { value: 'read', label: 'Read', icon: MailOpen },
];

/**
 * Module NOT - notifications (FR-NOT-1, FR-NOT-2, FR-NOT-3, FR-NOT-4).
 *
 * This is the signed-in staff member's own inbox (`notification/get.php` is
 * user-scoped with no role check), which is a different thing from the resident
 * broadcast the company sends - the two are kept apart deliberately so a broadcast is
 * never mistaken for an internal update.
 *
 * `notification/get.php` returns `total` as the PAGE size, not a grand total, so
 * there is no "page 2 of N" to show and the list is simply the newest 50.
 */
export default function Notifications() {
  const { isManager } = useAuth();
  const { notificationTypes } = useReference();
  const { notifications, unreadCount, isLoading, isError, refetch } = useNotifications({ limit: 50 });
  const markAsRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();

  const [tab, setTab] = useState('all');
  const [type, setType] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);

  const visible = notifications.filter((notification) => {
    if (tab === 'unread') return !notification.isRead;
    if (tab === 'read') return notification.isRead;
    if (type) return String(notification.type ?? '').toLowerCase() === type.toLowerCase();
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Your inbox, and the broadcast composer for resident updates."
        actions={
          <>
            <Button
              variant="outline"
              icon={CheckCheck}
              onClick={() => markAll.mutate()}
              loading={markAll.isPending}
              disabled={unreadCount === 0}
            >
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

      <Tabs
        tabs={TABS.map((item) => ({
          ...item,
          count: item.value === 'unread' ? unreadCount : undefined,
        }))}
        value={tab}
        onChange={setTab}
        ariaLabel="Notification filter"
      />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Type"
            options={notificationTypes}
            placeholder="All types"
            value={type}
            onChange={(event) => setType(event.target.value)}
            disabled={tab !== 'all'}
            hint={tab !== 'all' ? 'Fixed by the selected tab.' : undefined}
          />
        </CardBody>
      </Card>

      <DataView
        isLoading={isLoading}
        error={isError}
        onRetry={() => refetch()}
        loadingLabel="Loading notifications…"
        items={visible}
        empty={{
          icon: Inbox,
          title:
            tab === 'unread'
              ? 'Nothing unread'
              : tab === 'read'
                ? 'No read notifications yet'
                : 'No notifications yet',
          description: 'Outage, maintenance, hazard and flood updates for your account land here.',
        }}
        renderCard={(notification) => (
          <RecordCard
            icon={Bell}
            iconTone={notification.isRead ? 'navy' : 'primary'}
            title={notification.title || 'Notification'}
            subtitle={`${humanize(notification.type, 'Update')} · ${formatRelativeTime(notification.createdAt)}`}
            badges={[
              notification.isRead ? null : { label: 'Unread', tone: 'info' },
              { label: humanize(notification.type, 'Update'), tone: 'neutral' },
            ]}
            description={notification.message}
            meta={[{ label: 'Sent', value: formatDateTime(notification.createdAt) }]}
            actions={
              notification.isRead ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  icon={CheckCheck}
                  loading={markAsRead.isPending}
                  onClick={() => markAsRead.mutate(notification.id)}
                >
                  Mark as read
                </Button>
              )
            }
          />
        )}
      />

      <p className="text-xs text-navy-400">
        Showing the {notifications.length} most recent notifications. The API caps the page at 50
        and reports the page size as its total.
      </p>

      <NotificationComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
