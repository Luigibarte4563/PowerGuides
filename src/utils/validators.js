/** Lightweight form validation helpers (no external dependency). */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;

export function isEmpty(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function validateRequired(value, label = 'This field') {
  return isEmpty(value) ? `${label} is required.` : null;
}

export function validateEmail(value, label = 'Email') {
  if (isEmpty(value)) return `${label} is required.`;
  if (!EMAIL_PATTERN.test(String(value).trim())) return 'Enter a valid email address.';
  return null;
}

/**
 * Password validation.
 * `register.php` enforces `strlen >= 6` only, so the client must not be stricter
 * than the API or valid passwords would be rejected before they are sent.
 */
export function validatePassword(value, { label = 'Password', minLength = 6 } = {}) {
  if (isEmpty(value)) return `${label} is required.`;
  const password = String(value);
  if (password.length < minLength) return `${label} must be at least ${minLength} characters long.`;
  return null;
}

export function validateMatch(value, otherValue, label = 'Passwords') {
  if (isEmpty(value)) return `${label} confirmation is required.`;
  if (value !== otherValue) return `${label} do not match.`;
  return null;
}

/** 0-4 score plus a human label, used by the password strength meter. */
export function passwordStrength(password) {
  const value = String(password || '');
  if (!value) return { score: 0, label: 'Empty', tone: 'neutral' };

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) return { score: 1, label: 'Weak', tone: 'danger' };
  if (score === 2) return { score: 2, label: 'Fair', tone: 'warning' };
  if (score === 3) return { score: 3, label: 'Good', tone: 'info' };
  return { score: 4, label: 'Strong', tone: 'success' };
}

export function validateLatitude(value, { required = true } = {}) {
  if (isEmpty(value)) return required ? 'Pick a point on the map.' : null;
  const lat = Number(value);
  if (!Number.isFinite(lat)) return 'Latitude must be a number.';
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';
  return null;
}

export function validateLongitude(value, { required = true } = {}) {
  if (isEmpty(value)) return required ? 'Pick a point on the map.' : null;
  const lng = Number(value);
  if (!Number.isFinite(lng)) return 'Longitude must be a number.';
  if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.';
  return null;
}

export function validatePercentage(value, label = 'Percentage') {
  if (isEmpty(value)) return `${label} is required.`;
  const number = Number(value);
  if (!Number.isFinite(number)) return `${label} must be a number.`;
  if (number < 0 || number > 100) return `${label} must be between 0 and 100.`;
  return null;
}

export function validatePositiveNumber(value, label = 'Value') {
  if (isEmpty(value)) return `${label} is required.`;
  const number = Number(value);
  if (!Number.isFinite(number)) return `${label} must be a number.`;
  if (number <= 0) return `${label} must be greater than zero.`;
  return null;
}

/**
 * Run a map of `field -> error|null` validators and return only the real errors.
 * Returns `{}` when the form is valid.
 */
export function collectErrors(validators) {
  const errors = {};
  Object.entries(validators).forEach(([field, validate]) => {
    if (typeof validate !== 'function') return;
    const message = validate();
    if (message) errors[field] = message;
  });
  return errors;
}

export function hasErrors(errors) {
  return Boolean(errors) && Object.keys(errors).length > 0;
}

/** Clear a field error as soon as the user edits it. */
export function clearFieldError(errors, field) {
  if (!errors || !errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}
