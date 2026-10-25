import clsx from 'clsx';
import { Bell, BellOff, CheckCheck, Eye } from 'lucide-react';
import Badge from './ui/Badge';
import { Button } from './ui/Button';
import { NOTIFICATION_TYPE_TONES, notificationBody } from '@/utils/notifications';
import { formatDateTime, formatRelativeTime, humanize } from '@/utils/formatters';

const ICON_TONES = {
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
  info: 'bg-info-50 text-info-700 dark:bg-info-500/15 dark:text-info-200',
  success: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-200',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-200',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-200',
  navy: 'bg-navy-100 text-navy-700 dark:bg-navy-700 dark:text-navy-200',
};

/**
 * One notification in the history timeline.
 *
 * Deliberately NOT `RecordCard`: that component hardcodes `line-clamp-2` on the
 * description and is shared by roughly ten pages, so loosening the clamp there would
 * change every list in the app. Notification messages are multi-paragraph (the
 * maintenance copy contains `\n\n`), which is what "show the message" actually needs,
 * so the card renders the whole body with `whitespace-pre-line` instead of clamping
 * it to two silent lines.
 */
export default function NotificationCard({
  notification,
  onView,
  onMarkRead,
  isMarking = false,
  markReadDisabled = false,
}) {
  if (!notification) return null;

  const typeLabel = humanize(notification.type, 'Update');
  const body = notificationBody(notification);
  const Icon = notification.isRead ? BellOff : Bell;
  const tone = NOTIFICATION_TYPE_TONES[notification.type] || 'primary';

  return (
    <article
      className={clsx(
        'rounded-card border bg-white p-4 shadow-card transition dark:bg-navy-800',
        notification.isRead
          ? 'border-navy-100 dark:border-navy-700'
          : 'border-primary-200 bg-primary-50/40 dark:border-primary-500/40 dark:bg-primary-500/5'
      )}
      aria-labelledby={`notification-${notification.id}-title`}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-control',
            notification.isRead
              ? 'bg-navy-100 text-navy-500 dark:bg-navy-700 dark:text-navy-300'
              : ICON_TONES[tone] || ICON_TONES.primary
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3
              id={`notification-${notification.id}-title`}
              className="text-sm font-bold text-navy-900 dark:text-white"
            >
              {notification.title || typeLabel}
            </h3>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Badge tone="neutral" size="sm">
                {typeLabel}
              </Badge>
              {notification.isRead ? (
                <Badge tone="neutral" size="sm" icon={CheckCheck}>
                  Read
                </Badge>
              ) : (
                <Badge tone="primary" size="sm">
                  Unread
                </Badge>
              )}
            </div>
          </div>

          {/*
            `whitespace-pre-line` is what makes the message readable: maintenance and
            hazard copy is written with blank lines between the affected areas, the
            date, the window and the closing line, and collapsing them into one run of
            text is precisely the "message is not really there" symptom.
          */}
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-navy-600 dark:text-navy-300">
            {body || <span className="italic text-navy-400">No message was sent with this notification.</span>}
          </p>

          <p className="mt-2 text-xs text-navy-400 dark:text-navy-500">
            <time dateTime={String(notification.createdAt || '')} title={formatDateTime(notification.createdAt)}>
              {formatRelativeTime(notification.createdAt)}
            </time>
            <span aria-hidden="true"> · </span>
            {formatDateTime(notification.createdAt)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" icon={Eye} onClick={() => onView?.(notification)}>
              View details
            </Button>
            {!notification.isRead ? (
              <Button
                size="sm"
                variant="ghost"
                icon={CheckCheck}
                loading={isMarking}
                disabled={markReadDisabled}
                onClick={() => onMarkRead?.(notification)}
              >
                Mark as read
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}