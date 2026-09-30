import { apiRequest, absoluteUrl, setStoredToken, unwrapPayload } from './client';

/**
 * Authentication API.
 *
 * Confirmed contract (see `C:\xampp\htdocs\CrowdsourcedAPI\api\auth`):
 *   login    POST { email, password } -> { success, message, user_id, token_issued }
 *   register POST { first_name, middle_name?, last_name, email, password }
 *                  -> { success, message } (min password length 6)
 *   me       GET -> { success, data: { id, first_name, middle_name, last_name,
 *                                       email, picture, auth_provider, ... } }
 *   logout   POST -> { success, message }
 *
 * The JWT itself is set by the server as an httpOnly `jwt_token` cookie. The only
 * exception is the Google flow: `google_callback.php` redirects to
 * `/auth/google-callback?token=<jwt>`, so that page hands the token to
 * `setStoredToken`, which mirrors it into the same cookie.
 */
export const authApi = {
  async login({ email, password }) {
    return apiRequest('/api/auth/login.php', {
      method: 'POST',
      body: { email, password },
    });
  },

  async register({ firstName, middleName, lastName, email, password }) {
    return apiRequest('/api/auth/register.php', {
      method: 'POST',
      body: {
        first_name: firstName,
        middle_name: middleName || '',
        last_name: lastName,
        email,
        password,
        // Registered accounts are normal users; the API defaults `role` to "user".
      },
    });
  },

  async logout() {
    return apiRequest('/api/auth/logout.php', { method: 'POST' });
  },

  /** Full URL for the server-side Google OAuth redirect. */
  googleUrl() {
    return absoluteUrl('/api/auth/google.php');
  },

  /** Current user for the restored session. */
  async me({ signal } = {}) {
    return apiRequest('/api/auth/me.php', { signal });
  },

  /** Store the JWT handed over by the Google callback redirect. */
  storeGoogleToken(token) {
    setStoredToken(token);
  },
};

/** Build the initial user object from a login/register response. */
export function userFromAuthResponse(payload) {
  const data = unwrapPayload(payload);
  if (!data || typeof data !== 'object') return null;
  return {
    id: data.id ?? data.user_id ?? null,
    name: [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(' ') || '',
    email: data.email || '',
  };
}
