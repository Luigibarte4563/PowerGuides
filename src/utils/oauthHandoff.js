/**
 * Carries the intended destination across the Google OAuth round trip.
 *
 * Why this exists: `auth/google.php` builds the authorization URL from
 * `$_ENV['GOOGLE_REDIRECT_URI']` alone and IGNORES any `redirect_uri` query parameter,
 * and `google_callback.php` always returns to `FRONTEND_URL/auth/google-callback`. So
 * there is no query string the frontend can use to say "I came from the resident login".
 *
 * `sessionStorage` is the right store for that intent: it is same-origin, per-tab, and
 * survives a full cross-site round trip through Google as long as the user comes back to
 * the same tab. `localStorage` would leak the intent into the user's other tabs, and an
 * in-memory variable would not survive the navigation at all.
 *
 * The value is only ever a HINT. It is re-validated against the signed-in user's role by
 * `landingPathFor`, which discards anything that role cannot reach, so a stale or
 * hand-edited value cannot send a resident into `/company`.
 */

const KEY = 'powerguide.oauth.returnTo';

/** Reject anything that is not a same-origin absolute path. */
function isSafePath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

/** Record where to go once Google comes back. */
export function setOauthReturnTo(path) {
  try {
    if (isSafePath(path)) window.sessionStorage.setItem(KEY, path);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* private mode / storage disabled - the role default is used instead */
  }
}

/**
 * Read the intent and clear it in one step.
 *
 * Clearing matters: the intent is for ONE round trip. Leaving it behind would keep
 * redirecting the user to the same place on every later sign-in, including a Google
 * account with a different role.
 */
export function takeOauthReturnTo() {
  try {
    const value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return isSafePath(value) ? value : '';
  } catch {
    return '';
  }
}