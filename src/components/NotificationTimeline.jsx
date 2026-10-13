import { Bell, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { EmptyState, ErrorState, LoadingState } from './ui/States';
import { toUserMessage } from '@/utils/errorMessage';

/**
 * Date-grouped notification history with load-more paging.
 *
 * Owns its own loading / error / empty states because it cannot delegate to
 * `DataView`: that component maps a flat list, and a timeline has to render a day
 * header above each run of notifications.
 *
 * The end of the list is inferred from page length rather than a total - `get.php`
 * reports `total` as the page size, so the server never says how many more rows exist.
 * A page that comes back full shows the button; the fetch after the final one hides it.
 */
export default function NotificationTimeline({
  groups,
  isLoading,
  error,
  onRetry,
  loadingLabel = 'Loading your notifications…',
  empty,
  hasMore = false,
  isFetchingMore = false,
  onLoadMore,
  loadedCount = 0,
  renderItem,
}) {
  if (isLoading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState message={toUserMessage(error)} onRetry={onRetry} />;

  const hasGroups = groups.length > 0;

  if (!hasGroups) {
    if (!empty) return null;
    return (
      <EmptyState
        icon={empty.icon || Bell}
        title={empty.title || 'No notifications yet'}
        description={empty.description || 'New alerts will appear here.'}
        action={empty.action}
      />
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`notification-day-${group.key}`}>
          <div className="mb-3 flex items-center gap-3">
            <h2
              id={`notification-day-${group.key}`}
              className="text-xs font-bold uppercase tracking-[0.14em] text-navy-400 dark:text-navy-400"
            >
              {group.label}
            </h2>
            <span className="h-px flex-1 bg-navy-100 dark:bg-navy-700" aria-hidden="true" />
            <span className="text-xs text-navy-400 dark:text-navy-500">
              {group.items.length} {group.items.length === 1 ? 'notification' : 'notifications'}
            </span>
          </div>

          <div className="space-y-3">
            {group.items.map((item) => (
              <div key={item?.id ?? `${group.key}-${item?.createdAt}`}>{renderItem(item)}</div>
            ))}
          </div>
        </section>
      ))}

      {hasMore || isFetchingMore ? (
        <div className="flex flex-col items-center gap-2 border-t border-navy-100 pt-4 dark:border-navy-700">
          <Button variant="outline" onClick={onLoadMore} loading={isFetchingMore} disabled={!hasMore}>
            Load older notifications
          </Button>
          <p className="inline-flex items-center gap-1.5 text-xs text-navy-400 dark:text-navy-500">
            {isFetchingMore ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Loading more…
              </>
            ) : (
              `Showing ${loadedCount} loaded`
            )}
          </p>
        </div>
      ) : (
        <p className="border-t border-navy-100 pt-4 text-center text-xs text-navy-400 dark:border-navy-700 dark:text-navy-500">
          That is the full history available for this account.
        </p>
      )}
    </div>
  );
}