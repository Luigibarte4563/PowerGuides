import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import FormModal from '@/components/FormModal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/context/ToastContext';
import { BATTERY_DEVICE_TYPES, batteryApi } from '@/api';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validatePercentage, validateRequired } from '@/utils/validators';

/**
 * Confirmed contract:
 *   create.php POST { device_type*, device_name*, capacity_mah?, current_percentage?, is_primary? }
 *                     -> { success, message, device_id }
 *   update.php POST { device_id*, device_name, device_type, capacity_mah,
 *                     current_percentage, is_primary }
 * `device_type` must be one of the enum values (the API returns 400 otherwise).
 */
const TYPE_LABELS = {
  phone: 'Phone',
  laptop: 'Laptop',
  powerbank: 'Power bank',
  ups: 'UPS',
  tablet: 'Tablet',
  other: 'Other',
};

export const BATTERY_TYPE_OPTIONS = BATTERY_DEVICE_TYPES.map((type) => ({
  id: type,
  name: TYPE_LABELS[type] || type,
}));

const FIELD_ORDER = ['deviceName', 'deviceType', 'capacity', 'percentage'];

export default function BatteryFormModal({ open, onClose, device = null }) {
  const isEdit = Boolean(device?.id);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [values, setValues] = useState(() => ({
    deviceName: device?.name ?? '',
    deviceType: device?.deviceType || 'powerbank',
    capacity: device?.capacity ?? '',
    percentage: Number.isFinite(device?.percentage) ? String(device.percentage) : '',
    isPrimary: device?.isPrimary ? '1' : '',
  }));
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const save = useMutation({
    mutationFn: (payload) => (isEdit ? batteryApi.update(payload) : batteryApi.create(payload)),
    onSuccess: () => {
      toast.success(isEdit ? 'Device updated.' : 'Device added.', {
        title: isEdit ? 'Updated' : 'Added',
      });
      queryClient.invalidateQueries({ queryKey: ['battery'] });
      onClose();
    },
    onError: (error) => {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'We could not save this device.'));
    },
  });

  const submitting = save.isPending;

  const setField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  const validate = () =>
    collectErrors({
      deviceName: () => validateRequired(values.deviceName, 'Device name'),
      deviceType: () => validateRequired(values.deviceType, 'Device type'),
      percentage: () => (values.percentage === '' ? null : validatePercentage(values.percentage)),
    });

  const handleSubmit = () => {
    setFormError('');
    const validationErrors = validate();
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      device_name: values.deviceName.trim(),
      device_type: values.deviceType,
      capacity_mah: values.capacity === '' ? null : Number(values.capacity),
      current_percentage: values.percentage === '' ? undefined : Number(values.percentage),
      is_primary: values.isPrimary === '1',
    };
    // The API has no notes column for devices, so the local note is not sent.

    save.mutate(isEdit ? { ...payload, device_id: device.id } : payload);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit device' : 'Add a device'}
      description="Track your own devices so you know what is charged before an outage."
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Add device'}
      submitting={submitting}
      error={formError}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Device name"
          required
          placeholder="e.g. Big power bank"
          value={values.deviceName}
          onChange={(event) => setField('deviceName', event.target.value)}
          error={errors.deviceName}
        />
        <Select
          label="Device type"
          required
          options={BATTERY_TYPE_OPTIONS}
          value={values.deviceType}
          onChange={(event) => setField('deviceType', event.target.value)}
          error={errors.deviceType}
        />
        <Input
          label="Capacity in mAh (optional)"
          type="number"
          min="0"
          placeholder="e.g. 20000"
          value={values.capacity}
          onChange={(event) => setField('capacity', event.target.value)}
          error={errors.capacity}
        />
        <Input
          label="Current charge % (optional)"
          type="number"
          min="0"
          max="100"
          placeholder="e.g. 80"
          value={values.percentage}
          onChange={(event) => setField('percentage', event.target.value)}
          error={errors.percentage}
          hint="Leave blank and the device starts at 100%."
        />
      </div>

      <Select
        label="Primary device"
        placeholder="Not primary"
        options={[{ id: '1', name: 'Set as my primary device' }]}
        value={values.isPrimary}
        onChange={(event) => setField('isPrimary', event.target.value)}
        hint="Only one device can be primary."
      />

      <Textarea
        label="Note (optional)"
        rows={2}
        placeholder="Where you keep it, when you last charged it…"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
    </FormModal>
  );
}
