import { useState } from 'react';
import Modal from './ui/Modal';
import { Button } from './ui/Button';
import { toUserMessage } from '@/utils/errorMessage';

/** Confirmation dialog for destructive actions (delete reports, posts, devices). */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  error,
  onConfirm,
  onClose,
}) {
  const [localError, setLocalError] = useState('');

  const handleConfirm = async () => {
    setLocalError('');
    try {
      await onConfirm?.();
    } catch (confirmError) {
      setLocalError(toUserMessage(confirmError, 'The action could not be completed.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={handleConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-navy-600">{description}</p>
        {error || localError ? (
          <p role="alert" className="rounded-control bg-danger-50 p-3 text-sm font-medium text-danger-700">
            {error || localError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
