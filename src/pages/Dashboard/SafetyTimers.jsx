import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, Bell, PlayCircle, Plus, Square, Timer, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import FormModal from '@/components/FormModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useCountdown } from '@/hooks/useCountdown';
import { safetyTimersApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readSafetyTimer } from '@/utils/records';
import { formatDateTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import {
  clearFieldError,
  collectErrors,
  hasErrors,
  validatePositiveNumber,
} from '@/utils/validators';

const HOUR_PRESETS = [0.5, 1, 2, 3, 4, 6, 8, 12, 24];

/** `safety_timer/get.php` recomputes the status server-side. */
const STATUS_TONES = {
  running: 'primary',
  warning: 'warning',
  expired: 'danger',
  stopped: 'neutral',
};

/** Module H - safety timers with a live countdown. */
export default function SafetyTimers() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { safetyTimerTypes, isLoading: referenceLoading } = useReference();
  const [searchParams, setSearchParams] = useSearchParams();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const timersQuery = useQuery({
    queryKey: QUERY_KEYS.safetyTimers,
    queryFn: async ({ signal }) => (await safetyTimersApi.list({}, { signal })).items.map(readSafetyTimer),
    retry: 1,
    // The endpoint recomputes status and fires warning/expired notifications, so poll
    // every couple of minutes rather than on every window focus.
    refetchInterval: 120 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.safetyTimers });

  const stopMutation = useMutation({
    mutationFn: (id) => safetyTimersApi.stop(id),
    onSuccess: () => {
      toast.success('Timer stopped.', { title: 'Stopped' });
      invalidate();
    },
    onError: (error) => toast.error(toUserMessage(error, 'We could not stop that timer.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => safetyTimersApi.remove(id),
    onSuccess: () => {
      toast.success('Timer deleted.', { title: 'Deleted' });
      invalidate();
      setDeleting(null);
    },
  });

  const timers = timersQuery.data || [];
  const active = timers.filter((timer) => timer.status === 'running' || timer.status === 'warning');
  const finished = timers.filter((timer) => !active.includes(timer));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Safety Timers"
        description="Time appliances, generators or chargers so nothing runs unattended."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New timer
          </Button>
        }
      />

      {timersQuery.isLoading ? (
        <SkeletonList rows={2} />
      ) : timersQuery.isError ? (
        <ErrorState
          message={toUserMessage(timersQuery.error)}
          onRetry={() => timersQuery.refetch()}
        />
      ) : timers.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="No safety timers yet"
          description="Set a timer before you leave home so generators and appliances switch off on time."
          action={
            <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
              Start a timer
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {active.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">
                Active timers
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {active.map((timer) => (
                  <TimerCard
                    key={timer.id}
                    timer={timer}
                    onStop={() => stopMutation.mutate(timer.id)}
                    onDelete={() => setDeleting(timer)}
                    stopping={stopMutation.isPending && stopMutation.variables === timer.id}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {finished.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">
                Stopped and expired
              </h2>
              <Card>
                <CardBody className="grid gap-3 md:grid-cols-2">
                  {finished.map((timer) => (
                    <TimerCard key={timer.id} timer={timer} onDelete={() => setDeleting(timer)} compact />
                  ))}
                </CardBody>
              </Card>
            </section>
          ) : null}
        </div>
      )}

      <TimerFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        types={safetyTimerTypes}
        typesLoading={referenceLoading}
        onCreated={invalidate}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this timer?"
        description="The timer and its record will be removed from your account."
        confirmLabel="Delete timer"
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

function TimerCard({ timer, onStop, onDelete, stopping = false, compact = false }) {
  const countdown = useCountdown(timer.endsAt, timer.startedAt);
  const status = String(timer.status || 'running');
  const isFinished = status === 'stopped' || status === 'expired' || countdown.isExpired;
  const tone = STATUS_TONES[status] || (isFinished ? 'neutral' : 'primary');

  return (
    <Card className={compact ? '' : 'shadow-card-hover'}>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${
                isFinished ? 'bg-navy-100 text-navy-500' : 'bg-primary-100 text-primary-700'
              }`}
            >
              <Timer className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-navy-900">{timer.title}</h3>
              <p className="text-xs text-navy-500">
                {timer.type ? humanize(timer.type) : 'Custom timer'}
                {Number.isFinite(timer.durationHours) ? ` · ${timer.durationHours} h` : ''}
              </p>
            </div>
          </div>
          <Badge tone={tone} size="sm">
            {humanize(status)}
          </Badge>
        </div>

        {!compact ? (
          <div className="mt-4">
            <p
              className={`font-mono text-3xl font-extrabold tabular-nums ${
                isFinished ? 'text-navy-400' : 'text-navy-900'
              }`}
              role="timer"
            >
              {isFinished ? (status === 'stopped' ? 'Stopped' : 'Expired') : countdown.label}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-navy-100">
              <div
                className={`h-full rounded-full transition-all ${
                  isFinished ? 'bg-navy-300' : 'bg-primary-500'
                }`}
                style={{ width: `${Math.round(countdown.progress * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-navy-500">
              {isFinished
                ? timer.completedAt
                  ? `Ended ${formatDateTime(timer.completedAt)}`
                  : `Ended ${formatDateTime(timer.endsAt)}`
                : `Ends ${formatDateTime(timer.endsAt)}`}
            </p>
            {status === 'warning' ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-warning-700">
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                Warning window reached
              </p>
            ) : null}
          </div>
        ) : null}

        {timer.notes ? <p className="mt-3 text-xs text-navy-500">{timer.notes}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3">
          {!isFinished && onStop ? (
            <Button size="sm" variant="outline" icon={Square} loading={stopping} onClick={onStop}>
              Stop
            </Button>
          ) : null}
          {onDelete ? (
            <Button size="sm" variant="ghost" icon={Trash2} className="text-danger-600" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function TimerFormModal({ open, onClose, types, typesLoading, onCreated }) {
  const toast = useToast();
  const [values, setValues] = useState({ typeName: '', durationHours: '', warningHours: '', title: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  // Reference rows carry default_duration_hours, so picking a type can prefill it.
  const selectedType = useMemo(
    () => types.find((type) => type.name === values.typeName),
    [types, values.typeName]
  );

  useEffect(() => {
    if (!selectedType) return;
    setValues((current) => ({
      ...current,
      durationHours:
        current.durationHours || (selectedType.defaultDurationHours ? String(selectedType.defaultDurationHours) : ''),
      warningHours:
        current.warningHours || (selectedType.warningHoursBefore ? String(selectedType.warningHoursBefore) : ''),
    }));
  }, [selectedType]);

  const create = useMutation({
    mutationFn: (payload) => safetyTimersApi.create(payload),
    onSuccess: () => {
      toast.success('Safety timer started.', { title: 'Timer running' });
      setValues({ typeName: '', durationHours: '', warningHours: '', title: '', notes: '' });
      setErrors({});
      onCreated?.();
      onClose();
    },
    onError: (error) => setFormError(toUserMessage(error, 'We could not start that timer.')),
  });

  const setField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  const handleSubmit = () => {
    setFormError('');
    const validationErrors = collectErrors({
      // Either a known type or an explicit duration is required by the API.
      durationHours: () =>
        validatePositiveNumber(values.durationHours || 'x', 'Duration in hours'),
    });
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    create.mutate({
      timer_type_name: values.typeName || undefined,
      duration_hours: Number(values.durationHours),
      warning_hours_before: values.warningHours === '' ? undefined : Number(values.warningHours),
      title: values.title.trim() || values.typeName || 'Safety timer',
      notes: values.notes.trim(),
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Start a safety timer"
      description="The timer runs on your account and PowerGuide warns you before it expires."
      onSubmit={handleSubmit}
      submitLabel="Start timer"
      submitting={create.isPending}
      error={formError}
    >
      <Select
        label="Timer type"
        placeholder="Custom timer"
        options={types}
        loading={typesLoading}
        value={values.typeName}
        onChange={(event) => setField('typeName', event.target.value)}
        hint="Choosing a type applies its recommended duration."
      />

      <Input
        label="Duration in hours"
        required
        type="number"
        min="0.1"
        step="0.5"
        placeholder="e.g. 2"
        value={values.durationHours}
        onChange={(event) => setField('durationHours', event.target.value)}
        error={errors.durationHours}
      />

      <div className="flex flex-wrap gap-2">
        {HOUR_PRESETS.map((hours) => (
          <button
            key={hours}
            type="button"
            onClick={() => setField('durationHours', String(hours))}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              Number(values.durationHours) === hours
                ? 'border-primary-400 bg-primary-100 text-primary-800'
                : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
            }`}
          >
            {hours < 1 ? `${hours * 60} min` : `${hours} h`}
          </button>
        ))}
      </div>

      <Input
        label="Warn me before it ends (hours, optional)"
        type="number"
        min="0"
        step="0.5"
        placeholder="e.g. 0.5"
        value={values.warningHours}
        onChange={(event) => setField('warningHours', event.target.value)}
        error={errors.warningHours}
        hint="You get a notification when this warning window starts."
      />

      <Input
        label="Title (optional)"
        placeholder="e.g. Diesel generator"
        value={values.title}
        onChange={(event) => setField('title', event.target.value)}
        error={errors.title}
      />

      <Textarea
        label="Notes (optional)"
        rows={2}
        placeholder="Anything you want to remember about this timer."
        value={values.notes}
        onChange={(event) => setField('notes', event.target.value)}
      />

      <p className="flex items-start gap-2 text-xs text-navy-500">
        <AlarmClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Timers are private to your account. Stop a timer as soon as the appliance is off.
      </p>
    </FormModal>
  );
}
