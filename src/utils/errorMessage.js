import { ApiError } from '@/api/client';

/**
 * Turn any thrown value into a message that is safe to show to a user.
 * Never leaks stack traces, raw JSON or server internals.
 */
export function toUserMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error.trim() || fallback;
  if (error instanceof ApiError) return error.message || fallback;
  if (error?.name === 'AbortError') return 'The request was cancelled.';
  if (error instanceof TypeError) {
    return 'We could not reach the PowerGuide server. Check your connection and try again.';
  }
  if (error?.message && !/undefined|object|\[object/i.test(error.message)) return error.message;
  return fallback;
}

/**
 * Map server-side validation errors into `{ field: message }`.
 *
 * TODO(API-CONFIRM) the field-error container returned by the PHP API
 * (`errors` / `error` / `errors_msg`). Supported guesses:
 *   { errors: { email: "Email already exists." } }
 *   { errors: ["Email already exists."] }   (positional, needs `fieldOrder`)
 */
export function toFieldErrors(error, fieldOrder = []) {
  const result = {};
  if (!error) return result;

  const errors = error instanceof ApiError ? error.errors : null;
  if (errors) {
    Object.entries(errors).forEach(([field, message]) => {
      const key = normaliseFieldKey(field);
      const text = Array.isArray(message) ? message[0] : message;
      if (typeof text === 'string' && text.trim()) result[key] = text.trim();
    });
    if (Object.keys(result).length) return result;
  }

  // Fall back to the message itself on the most likely field.
  const message = toUserMessage(error, '');
  if (message && fieldOrder.length) {
    const mentioned = fieldOrder.find((field) => message.toLowerCase().includes(field.toLowerCase()));
    if (mentioned) result[normaliseFieldKey(mentioned)] = message;
  }
  return result;
}

function normaliseFieldKey(field) {
  return String(field)
    .trim()
    .replace(/[^\w]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

export const ERROR_FIELD_ALIASES = {
  confirmPassword: ['confirm_password', 'confirmpassword', 'password_confirmation', 'confirm'],
  password: ['password', 'pass'],
  email: ['email', 'email_address'],
  name: ['name', 'full_name', 'fullname'],
  barangayId: ['barangay_id', 'barangay', 'barangayID'],
  categoryId: ['category_id', 'outage_category_id', 'category'],
  severityId: ['severity_id', 'severity', 'severity_level_id', 'severity_level'],
  hazardTypeId: ['hazard_type_id', 'hazard_type', 'type_id'],
  description: ['description', 'details', 'message'],
  lat: ['lat', 'latitude'],
  lng: ['lng', 'lon', 'long', 'longitude'],
  durationMinutes: ['duration_minutes', 'duration'],
};
