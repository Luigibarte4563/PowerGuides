import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Send, Users } from 'lucide-react';
import FormModal from '@/components/FormModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input, Textarea } from '@/components/ui/Input';
import { InfoNote } from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { notificationsApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { formatRelativeTime, humanize } from '@/utils/formatters';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import {
  clearFieldError,
  collectErrors,
  hasErrors,
  validateRequired,
} from '@/utils/validators';

const FIELD_ORDER = ['title', 'message', 'recipients'];

/** `create.php` falls back to `maintenance` when `type` is omitted. */
const DEFAULT_TYPE = 'maintenance';

/**
 * Parse the recipient field into ids.
 *
 * Accepts commas, spaces and newlines, because a list pasted from a spreadsheet or a
 * support ticket rarely arrives in one shape. Non-numeric and zero/negative entries
 * are dropped rather than sent, since the endpoint casts `user_id` to int and a bad
 * value would silently become `0` - a notification addressed to nobody.
 */
export function parseRecipients(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(/[\s,;]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => Number(part.replace(/^#/, '')))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
}

/**
 * FR-NOT-4 / FR-NOT-5 - compose a broadcast and preview it.
 *
 * The API has NO audience/broadcast endpoint: `notification/create.php` takes an
 * explicit `user_id` (or a `notifications[]` array of them) and nothing else. There is
 * also no endpoint that lists users or maps a barangay to its residents, so
 * "target all users" and "target a barangay" from the requirements cannot be
 * expressed as a server call today. Rather than fake it, the composer takes explicit
 * user ids and the panel below the form says exactly what is and is not possible -
 * adding a `notification/audience.php` endpoint would let this become a dropdown.
 *
 * The single-recipient and multi-recipient forms are both supported by the endpoint;
 * the API module picks the right one, and `created` (not the number submitted) is
 * reported back because items missing a field are skipped without an error.
 */
export default function NotificationComposeModal({ open, onClose, defaultRecipientId }) {
  const { notificationTypes, isLoading: refLoading } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [values, setValues] = useState({ title: '', message: '', type: DEFAULT_TYPE, recipients: '' });
  const [errors, setErrors] = useState({});

  const set = (field) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
  };

  const recipientIds = useMemo(() => parseRecipients(values.recipients), [values.recipients]);

  const validationErrors = useMemo(
    () =>
      collectErrors({
        title: () => validateRequired(values.title.trim(), 'A title'),
        message: () => validateRequired(values.message.trim(), 'A message'),
        recipients: () =>
          recipientIds.length === 0 ? 'Enter at least one numeric user id.' : null,
      }),
    [values, recipientIds]
  );

  const mutation = useMutation({
    mutationFn: (payload) => notificationsApi.create(payload),
    onSuccess: (result) => {
      const created = Number(result?.created ?? 0);
      toast.success(
        `${created} notification${created === 1 ? '' : 's'} sent.`,
        { title: 'Notification sent' }
      );
      setValues({ title: '', message: '', type: DEFAULT_TYPE, recipients: '' });
      setErrors({});
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications({}) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
      onClose();
    },
  });

  const submit = async (event) => {
    event?.preventDefault();
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    try {
      await mutation.mutateAsync({
        title: values.title.trim(),
        message: values.message.trim(),
        type: values.type || DEFAULT_TYPE,
        userIds: recipientIds,
      });
    } catch (error) {
      setErrors(toFieldErrors(error, FIELD_ORDER));
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Send a notification"
      description="Publish an update to specific resident accounts."
      submitLabel="Send notification"
      submitting={mutation.isPending}
      error={mutation.isError ? toUserMessage(mutation.error) : ''}
      onSubmit={submit}
      footerExtra={
        <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-navy-400">
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {recipientIds.length || 0} recipient{recipientIds.length === 1 ? '' : 's'}
        </span>
      }
    >
      <Input
        label="Title"
        required
        value={values.title}
        onChange={set('title')}
        error={errors.title}
        placeholder="Power maintenance in Barangay San Carlos"
        maxLength={120}
      />

      <Textarea
        label="Message"
        required
        rows={4}
        value={values.message}
        onChange={set('message')}
        error={errors.message}
        placeholder="Explain what is happening, where, and when service is expected back."
      />

      <Select
        label="Type"
        options={notificationTypes}
        value={values.type}
        onChange={set('type')}
        loading={refLoading}
        hint="Matched against the notification types the API publishes."
      />

      <Input
        label="Recipient user ids"
        required
        value={values.recipients}
        onChange={set('recipients')}
        error={errors.recipients}
        placeholder="12, 34 56"
        hint="Separate ids with commas or spaces."
      />

      {defaultRecipientId ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={Users}
          onClick={() =>
            setValues((current) => ({
              ...current,
              recipients: Array.from(
                new Set([...parseRecipients(current.recipients), Number(defaultRecipientId)].filter(Boolean))
              ).join(', '),
            }))
          }
        >
          Add the reporter of this report ({defaultRecipientId})
        </Button>
      ) : null}

      <InfoNote>
        The API accepts explicit user ids only. Broadcasting to everyone, or to everyone in a
        barangay, needs an audience endpoint on the server - the current build cannot derive those
        recipients.
      </InfoNote>

      {/* FR-NOT-5 - preview, rendered with the same markup the top-bar bell uses. */}
      <div>
        <p className="mb-2 text-sm font-semibold text-navy-800">Preview</p>
        <div className="rounded-card border border-navy-100 bg-canvas p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-navy-400">
                  {humanize(values.type, 'Maintenance')}
                </span>
                <Badge tone="info" size="sm">
                  Unread
                </Badge>
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {values.title.trim() || 'Your notification title'}
              </p>
              <p className="mt-0.5 text-sm text-navy-600">
                {values.message.trim() || 'Your message will appear here exactly as residents see it.'}
              </p>
              <p className="mt-1 text-xs text-navy-400">{formatRelativeTime(new Date().toISOString())}</p>
            </div>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
