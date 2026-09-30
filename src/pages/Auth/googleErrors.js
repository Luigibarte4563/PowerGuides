/**
 * Human-readable copy for the `error` query codes that
 * `api/auth/google_callback.php` sends to `/login?error=<code>`.
 *
 * Only the codes are ever displayed - never the raw values.
 */
export const GOOGLE_ERRORS = {
  google_auth_denied: 'Google sign-in was cancelled. You can try again whenever you like.',
  google_missing_code: 'Google did not return an authorisation code. Please try signing in again.',
  google_exchange_failed:
    'We could not complete the sign-in with Google. Please try again in a moment.',
  google_invalid_token: 'Google returned an invalid sign-in token. Please try again.',
  google_role_missing: 'Your account could not be set up for the PowerGuide app.',
  google_db_error: 'We could not save your Google account. Please try again shortly.',
  google_jwt_failed: 'Your session could not be created. Please try signing in again.',
  // Client-side codes from GoogleCallback.jsx
  missing_token: 'Google sign-in finished without a session token. Please try again.',
  session_failed: 'We could not load your account after signing in. Please try again.',
  default: 'Google sign-in could not be completed. Please try again.',
};
