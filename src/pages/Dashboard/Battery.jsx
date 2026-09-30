import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  History,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { batteryApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { readBatteryDevice, readBatteryLog } from '@/utils/records';
import { formatDateTime, formatNumber, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import { validatePercentage, validatePositiveNumber } from '@/utils/validators';
import BatteryFormModal from './components/BatteryFormModal';

/** Battery level -> icon + tone. Colour is always paired with the percentage text. */
function batteryTone(percentage) {
  const value = Number(percentage);
  if (!Number.isFinite(value)) return { tone: 'neutral', icon: BatteryCharging, label: 'Unknown' };
  if (value >= 75) return { tone: 'success', icon: BatteryFull, label: 'Good' };
  if (value >= 40) return { tone: 'warning', icon: BatteryMedium, label: 'Fair' };
  if (value > 0) return { tone: 'danger', icon: BatteryLow, label: 'Low' };
  return { tone: 'danger', icon: BatteryLow, label: 'Empty' };
}

function BatteryBar({ percentage }) {
  const value = Math.max(0, Math.min(100, Number(percentage) || 0));
  const { tone } = batteryTone(value);
  const barColors = {
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-600',
    neutral: 'bg-navy-300',
  };

  return (
    <div className="mt-3">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-navy-100"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Battery level ${value}%`}
      >
        <div className={`h-full rounded-full ${barColors[tone]}`} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-xs font-semibold text-navy-600">{value}% charged</p>
    </div>
  );
}

/** Module G - battery tracking for the user's own devices. */
export default function Battery() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [historyDevice, setHistoryDevice] = useState(null);
  const [levelDevice, setLevelDevice] = useState(null);
  const [usageDevice, setUsageDevice] = useState(null);

  const devicesQuery = useQuery({
    queryKey: QUERY_KEYS.battery,
    queryFn: async ({ signal }) => (await batteryApi.list({}, { signal })).items.map(readBatteryDevice),
    retry: 1,
  });

  const devices = devicesQuery.data || [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['battery'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => batteryApi.remove(id),
    onSuccess: () => {
      toast.success('Device removed.', { title: 'Deleted' });
      invalidate();
      setDeleting(null);
    },
  });

  const totalAverage = devices.length
    ? Math.round(devices.reduce((sum, device) => sum + (Number(device.percentage) || 0), 0) / devices.length)
    : 0;
  const lowCount = devices.filter((device) => (Number(device.percentage) || 0) < 40).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Battery Tracking"
        description="Keep an eye on your own devices so essentials are charged before the lights go out."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add device
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-navy-500">Tracked devices</p>
            <p className="mt-1 text-2xl font-extrabold text-navy-900">
              {devicesQuery.isLoading ? '—' : devices.length}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-navy-500">Average charge</p>
            <p className="mt-1 text-2xl font-extrabold text-navy-900">
              {devicesQuery.isLoading ? '—' : `${totalAverage}%`}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-navy-500">Needs charging</p>
            <p className="mt-1 text-2xl font-extrabold text-navy-900">
              {devicesQuery.isLoading ? '—' : lowCount}
            </p>
          </CardBody>
        </Card>
      </div>

      {devicesQuery.isLoading ? (
        <SkeletonList rows={3} />
      ) : devicesQuery.isError ? (
        <ErrorState
          message={toUserMessage(devicesQuery.error)}
          onRetry={() => devicesQuery.refetch()}
        />
      ) : devices.length === 0 ? (
        <EmptyState
          icon={BatteryCharging}
          title="No devices yet"
          description="Add your power banks, phones and routers so you can check their charge level at a glance."
          action={
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add your first device
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((device) => {
            const { tone, icon: Icon, label } = batteryTone(device.percentage);
            return (
              <Card key={device.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${
                          tone === 'success'
                            ? 'bg-success-50 text-success-700'
                            : tone === 'warning'
                              ? 'bg-warning-50 text-warning-700'
                              : 'bg-danger-50 text-danger-700'
                        }`}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-navy-900">{device.name}</h3>
                        <p className="text-xs text-navy-500">
                          {humanize(device.deviceType, 'Device')}
                          {device.capacity ? ` · ${formatNumber(device.capacity)} mAh` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge tone={tone} size="sm">
                      {label}
                    </Badge>
                  </div>

                  <BatteryBar percentage={device.percentage} />

                  {device.notes ? <p className="mt-3 text-xs text-navy-500">{device.notes}</p> : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3">
                    <Button size="sm" variant="primary" onClick={() => setLevelDevice(device)}>
                      Set %
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={History}
                      onClick={() => setHistoryDevice(device)}
                    >
                      History
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={TrendingDown}
                      onClick={() => setUsageDevice(device)}
                    >
                      Log usage
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Pencil}
                      onClick={() => {
                        setEditing(device);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      className="text-danger-600"
                      onClick={() => setDeleting(device)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <BatteryFormModal
        open={formOpen}
        device={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <SetPercentageModal
        device={levelDevice}
        onClose={() => setLevelDevice(null)}
        onSaved={() => {
          invalidate();
          setLevelDevice(null);
        }}
      />

      <HistoryModal device={historyDevice} onClose={() => setHistoryDevice(null)} />

      <LogUsageModal
        device={usageDevice}
        onClose={() => setUsageDevice(null)}
        onSaved={() => {
          invalidate();
          setUsageDevice(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove this device?"
        description="The device and its usage history will be deleted from your account."
        confirmLabel="Remove device"
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

/** Quick "set current percentage" action (`battery/set_percentage.php`). */
function SetPercentageModal({ device, onClose, onSaved }) {
  const toast = useToast();
  const [percentage, setPercentage] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (value) =>
      batteryApi.setPercentage({ device_id: device.id, current_percentage: value }),
    onSuccess: () => {
      toast.success(`${device.name} is now at ${percentage}%.`, { title: 'Battery updated' });
      setPercentage('');
      onSaved();
    },
    onError: (mutationError) => {
      setError(toUserMessage(mutationError, 'We could not update the battery level.'));
    },
  });

  const handleSubmit = () => {
    setError('');
    const validationError = validatePercentage(percentage);
    if (validationError) {
      setError(validationError);
      return;
    }
    mutation.mutate(Number(percentage));
  };

  return (
    <Modal
      open={Boolean(device)}
      onClose={onClose}
      title="Set battery level"
      description={device ? `Update the current charge of ${device.name}.` : ''}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>
            Save level
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-control bg-danger-50 p-3 text-sm font-medium text-danger-700">
            {error}
          </p>
        ) : null}
        <Input
          label="Current percentage"
          type="number"
          min="0"
          max="100"
          required
          placeholder="e.g. 65"
          value={percentage}
          onChange={(event) => setPercentage(event.target.value)}
        />
      </div>
    </Modal>
  );
}

/** Log a usage entry for a device (`battery/log_usage.php`). */
function LogUsageModal({ device, onClose, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState({ startPercentage: '', endPercentage: '', usageMinutes: '', activity: '' });
  const [errors, setErrors] = useState({});

  const mutation = useMutation({
    mutationFn: (payload) => batteryApi.logUsage(payload),
    onSuccess: () => {
      toast.success('Usage logged.', { title: 'History updated' });
      setValues({ startPercentage: '', endPercentage: '', usageMinutes: '', activity: '' });
      setErrors({});
      onSaved();
    },
    onError: (error) => {
      setErrors({ form: toUserMessage(error, 'We could not log that usage entry.') });
    },
  });

  const handleSubmit = () => {
    const nextErrors = {
      startPercentage: validatePercentage(values.startPercentage, 'Start level'),
      endPercentage: validatePercentage(values.endPercentage, 'End level'),
      usageMinutes:
        values.usageMinutes === '' ? null : validatePositiveNumber(values.usageMinutes, 'Usage minutes'),
    };
    const filtered = Object.fromEntries(Object.entries(nextErrors).filter(([, value]) => value));
    setErrors(filtered);
    if (Object.keys(filtered).length) return;

    mutation.mutate({
      device_id: device.id,
      battery_percentage_start: Number(values.startPercentage),
      battery_percentage_end: Number(values.endPercentage),
      usage_minutes: values.usageMinutes === '' ? undefined : Number(values.usageMinutes),
      activity: values.activity.trim(),
    });
  };

  return (
    <Modal
      open={Boolean(device)}
      onClose={onClose}
      title="Log usage"
      description={device ? `Record the charge level of ${device.name} after a period of use.` : ''}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>
            Log usage
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.form ? (
          <p role="alert" className="rounded-control bg-danger-50 p-3 text-sm font-medium text-danger-700">
            {errors.form}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Charge before use (%)"
            type="number"
            min="0"
            max="100"
            required
            value={values.startPercentage}
            onChange={(event) => setValues((current) => ({ ...current, startPercentage: event.target.value }))}
            error={errors.startPercentage}
          />
          <Input
            label="Charge after use (%)"
            type="number"
            min="0"
            max="100"
            required
            value={values.endPercentage}
            onChange={(event) => setValues((current) => ({ ...current, endPercentage: event.target.value }))}
            error={errors.endPercentage}
          />
        </div>
        <Input
          label="Minutes used (optional)"
          type="number"
          min="0"
          placeholder="e.g. 120"
          value={values.usageMinutes}
          onChange={(event) => setValues((current) => ({ ...current, usageMinutes: event.target.value }))}
          error={errors.usageMinutes}
          hint="Helps PowerGuide estimate how long the device will last."
        />
        <Input
          label="Activity (optional)"
          placeholder="e.g. Charged two phones during the outage"
          value={values.activity}
          onChange={(event) => setValues((current) => ({ ...current, activity: event.target.value }))}
        />
      </div>
    </Modal>
  );
}

/** Per-device usage history: list plus a simple chart (`battery/get_history.php`). */
function HistoryModal({ device, onClose }) {
  const [tab, setTab] = useState('chart');

  const historyQuery = useQuery({
    queryKey: QUERY_KEYS.batteryHistory(device?.id),
    queryFn: async ({ signal }) => {
      const { items } = await batteryApi.getHistory({ device_id: device.id }, { signal });
      return items.map(readBatteryLog);
    },
    enabled: Boolean(device?.id),
    retry: 1,
  });

  const logs = historyQuery.data || [];
  // The API returns newest first and charts read left-to-right, so reverse it.
  const chartData = logs
    .map((log, index) => ({
      name: formatDateTime(log.loggedAt).split(',')[0] || `#${index + 1}`,
      percentage: Number(log.endPercentage ?? log.startPercentage ?? 0) || 0,
      start: Number(log.startPercentage) || 0,
      usageMinutes: log.usageMinutes,
    }))
    .reverse();

  return (
    <Modal
      open={Boolean(device)}
      onClose={onClose}
      title={`History · ${device?.name || ''}`}
      description="Battery levels you logged for this device."
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="inline-flex rounded-card border border-navy-100 bg-canvas p-1">
          <Button
            size="sm"
            variant={tab === 'chart' ? 'secondary' : 'ghost'}
            onClick={() => setTab('chart')}
          >
            Chart
          </Button>
          <Button
            size="sm"
            variant={tab === 'list' ? 'secondary' : 'ghost'}
            onClick={() => setTab('list')}
          >
            List
          </Button>
        </div>

        {historyQuery.isLoading ? (
          <SkeletonList rows={3} />
        ) : historyQuery.isError ? (
          <ErrorState
            compact
            message={toUserMessage(historyQuery.error)}
            onRetry={() => historyQuery.refetch()}
          />
        ) : logs.length === 0 ? (
          <EmptyState
            compact
            icon={History}
            title="No history yet"
            description="Set the battery level or log usage to start building a history for this device."
          />
        ) : tab === 'chart' ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E9F2" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6C7C9B' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6C7C9B' }} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E4E9F2', fontSize: 12 }}
                  formatter={(value) => [`${value}%`, 'Charge']}
                />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#F59E0B' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ul className="max-h-72 divide-y divide-navy-100 overflow-y-auto">
            {logs.map((log) => (
              <li
                key={log.id ?? `${log.loggedAt}-${log.endPercentage}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-navy-800">{formatDateTime(log.loggedAt)}</p>
                  <p className="text-xs text-navy-500">
                    {Number.isFinite(log.startPercentage) ? `${log.startPercentage}%` : '—'}
                    {' → '}
                    {Number.isFinite(log.endPercentage) ? `${log.endPercentage}%` : '—'}
                    {Number.isFinite(log.usageMinutes) ? ` · ${log.usageMinutes} min used` : ''}
                    {log.activity ? ` · ${log.activity}` : ''}
                  </p>
                </div>
                <Badge tone={batteryTone(log.endPercentage).tone}>
                  {log.endPercentage ?? '—'}%
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
