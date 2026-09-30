import { useState } from 'react';
import { Bell, BellOff, CheckCheck, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import { useToast } from '@/context/ToastContext';
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { formatDateTime, formatRelativeTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';

const TYPE_TONES = {
  outage: 'danger',
  outage_report: 'danger',
  maintenance: 'info',
  hazard: 'danger',
  electrical_hazard: 'danger',
  flood: 'info',
  battery: 'success',
  timer: 'primary',
  system: 'navy',
  info: 'navy',
};

/** Module E - notifications (current user only). */
export default function Notifications() {
  const [tab, setTab] = useState('all');
  const toast = useToast();
  const { notifications, unreadCount, isLoading, isError, error, refetch } = useNotifications({ limit: 100 });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const items = tab === 'unread' ? notifications.filter((item) => !item.isRead) : notifications;

  const handleMarkAll = async () => {
    try {
      await markAllAsRead.mutateAsync();
      toast.success('All notifications marked as read.', { title: 'Updated' });
    } catch (markAllError) {
      toast.error(toUserMessage(markAllError, 'We could not mark your notifications as read.'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Updates about outages, maintenance, hazards and your own reports."
        actions={
          <Button
            variant="outline"
            icon={CheckCheck}
            onClick={handleMarkAll}
            loading={markAllAsRead.isPending}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        }
      />

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

      <DataView
        isLoading={isLoading}
        error={isError}
        errorMessage={toUserMessage(error)}
        onRetry={() => refetch()}
        loadingLabel="Loading your notifications…"
        items={items}
        empty={{
          icon: tab === 'unread' ? BellOff : Bell,
          title: tab === 'unread' ? 'Nothing unread' : 'No notifications yet',
          description:
            tab === 'unread'
              ? 'You are all caught up. New alerts will appear here.'
              : 'When an outage near you is reported or resolved, you will be notified here.',
        }}
        renderCard={(notification) => (
          <RecordCard
            icon={notification.isRead ? CheckCircle2 : Bell}
            iconTone={notification.isRead ? 'navy' : (TYPE_TONES[notification.type] || 'primary')}
            title={notification.title || humanize(notification.type, 'Update')}
            subtitle={`${humanize(notification.type, 'Update')} · ${formatRelativeTime(notification.createdAt)}`}
            badges={
              notification.isRead
                ? [{ label: 'Read', tone: 'neutral' }]
                : [{ label: 'Unread', tone: 'primary' }]
            }
            description={notification.message}
            footer={<span className="text-xs text-navy-400">{formatDateTime(notification.createdAt)}</span>}
            actions={
              !notification.isRead ? (
                <Button
                  size="sm"
                  variant="outline"
                  icon={CheckCheck}
                  loading={markAsRead.isPending && markAsRead.variables === notification.id}
                  onClick={async () => {
                    try {
                      await markAsRead.mutateAsync(notification.id);
                    } catch (markError) {
                      toast.error(toUserMessage(markError, 'We could not mark that notification as read.'));
                    }
                  }}
                >
                  Mark as read
                </Button>
              ) : null
            }
          />
        )}
      />
    </div>
  );
}
