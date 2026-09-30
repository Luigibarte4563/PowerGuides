import { useId, useState } from 'react';
import Modal from './ui/Modal';
import { Button } from './ui/Button';
import { AuthAlert } from './ui/Alert';

/**
 * Modal + form in one place. The submit button lives in the modal footer but is
 * wired to the form through the HTML `form` attribute, so Enter submits as usual.
 */
export default function FormModal({
  open,
  onClose,
  title,
  description,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitting = false,
  error,
  size = 'lg',
  children,
  footerExtra,
}) {
  const formId = useId();
  const [touched, setTouched] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (typeof onSubmit !== 'function') return;
    await onSubmit(event);
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          {footerExtra}
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button type="submit" form={formId} loading={submitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        {children}
        {touched ? <span className="sr-only">Form submitted</span> : null}
      </form>
    </Modal>
  );
}
