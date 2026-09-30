import { Fragment } from 'react';
import { EmptyState, ErrorState, LoadingState } from './ui/States';
import { toUserMessage } from '@/utils/errorMessage';

/**
 * Renders a query result consistently on every screen:
 * loading -> error -> empty -> data (cards on mobile, table/other view on desktop).
 *
 * props:
 *   isLoading, error, items, errorMessage, onRetry, loadingLabel,
 *   empty            { icon, title, description, action }
 *   renderCard(item) responsive list item (always rendered, stacked on mobile)
 *   renderTable(items) optional richer layout for md+ screens
 */
export default function DataView({
  isLoading,
  error,
  items,
  isEmpty,
  onRetry,
  loadingLabel,
  empty,
  renderCard,
  renderTable,
  emptyAction,
  skeleton,
}) {
  if (isLoading) return skeleton || <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState message={toUserMessage(error)} onRetry={onRetry} />;

  const isEmptyList = isEmpty !== undefined ? isEmpty : !items || items.length === 0;
  if (isEmptyList) {
    if (!empty) return null;
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={empty.action ?? emptyAction}
      />
    );
  }

  return (
    <>
      {renderTable ? <div className="hidden md:block">{renderTable(items)}</div> : null}
      {renderCard ? (
        <div className="space-y-3 md:hidden">
          {items.map((item, index) => (
            <Fragment key={item?.id ?? index}>{renderCard(item, index)}</Fragment>
          ))}
        </div>
      ) : null}
      {renderTable && !renderCard ? <div>{renderTable(items)}</div> : null}
    </>
  );
}
