import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCheck } from 'lucide-react';
import Modal from './ui/Modal';
import Badge from './ui/Badge';
import { Button } from './ui/Button';
import { useAuth } from '@/context/AuthContext';
import { NOTIFICATION_TYPE_TONES, notificationBody, notificationTarget } from '@/utils/notifications';
import { formatDateTime, humanize } from '@/utils/formatters';

/**
 * Full view of one notification.
 *
 * A modal, not a route at `/notifications/:id`: there is no `notification/get_detail.php`,
 * so the API cannot fetch a single notification by id and a deep link could only ever be
 * resolved from the rows already in memory. A modal always has the record in hand, which
 * is also why this component is driven by an already-loaded `notification` prop.
 *
 * This is also where the linked record finally becomes reachable - the reference ids
 * have always come back from the API, but nothing rendered them as a destination.
 */
export default function NotificationDetailModal({
  notification,
  open,
  onClose,
  onMarkRead,
  isMarking = false,
}) {
  const { isStaff } = useAuth();
  if (!notification) return null;

  const typeLabel = humanize(notification.type, 'Update');
  const tone = NOTIFICATION_TYPE_TONES[notification.type] || 'primary';
  const body = notificationBody(notification);
  const target = notificationTarget(notification, { company: isStaff });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={notification.title || typeLabel}
      description={`${typeLabel} · received ${formatDateTime(notification.createdAt)}`}
      size="md"
      footer={
        <>
          {target ? (
            <Link
              to={target.to}
              onClick={onClose}
              className="inline-flex h-10 items-center gap-1.5 rounded-control border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 dark:border-navy-600 dark:bg-navy-900 dark:text-navy-200 dark:hover:bg-navy-700"
            >
              {target.label}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
          {!notification.isRead ? (
            <Button
              icon={CheckCheck}
              loading={isMarking}
              onClick={() => onMarkRead?.(notification)}
            >
              Mark as read
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={tone} size="sm">
            {typeLabel}
          </Badge>
          {notification.isRead ? (
            <Badge tone="neutral" size="sm">
              Read
            </Badge>
          ) : (
            <Badge tone="primary" size="sm">
              Unread
            </Badge>
          )}
        </div>

        {/*
          Full body, no clamp and no collapse. `whitespace-pre-line` preserves the blank
          lines the sender wrote between the affected areas, the date, the service window
          and the closing note - the whole reason to open this view.
        */}
        <div className="rounded-control border border-navy-100 bg-canvas p-4 dark:border-navy-700 dark:bg-navy-900/60">
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-navy-700 dark:text-navy-200">
            {body || (
              <span className="italic text-navy-400">
                No message was sent with this notification.
              </span>
            )}
          </p>
        </div>

        <dl className="grid gap-2 text-xs text-navy-500 dark:text-navy-400 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-navy-600 dark:text-navy-300">Received</dt>
            <dd>{formatDateTime(notification.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-navy-600 dark:text-navy-300">Type</dt>
            <dd>{typeLabel}</dd>
          </div>
          {target ? (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-navy-600 dark:text-navy-300">Linked record</dt>
              <dd>
                {target.label}
                {notification.outageReportId ? ` (#${notification.outageReportId})` : ''}
              </dd>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-navy-600 dark:text-navy-300">Linked record</dt>
              <dd>This notification is not attached to an outage, schedule, flood or hazard.</dd>
            </div>
          )}
        </dl>

        {/*
          The API has no `read_at` column and no way to unread a notification, so this
          is stated rather than implied - "when did I read this?" is not recorded
          anywhere and the history below cannot reconstruct it.
        */}
        <p className="text-xs text-navy-400 dark:text-navy-500">
          The API records when a notification was sent, not when it was read, so read history
          is limited to the current read or unread state.
        </p>
      </div>
    </Modal>
  );
}