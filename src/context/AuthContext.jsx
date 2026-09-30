import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '@/api';
import { setStoredToken, unwrapPayload } from '@/api/client';
import { toUserMessage } from '@/utils/errorMessage';
import { readField } from '@/utils/formatters';
import { isCompanyUser, isManager, isStaff, normaliseRole, ROLE } from '@/utils/roles';

const AuthContext = createContext(null);

/**
 * Normalise the `me.php` payload into the user object the UI needs.
 * Confirmed response: `data` holds the user row directly:
 *   { id, google_id, first_name, middle_name, last_name, email, picture, auth_provider }
 */
export function normaliseUser(payload) {
  if (!payload) return null;
  const data = unwrapPayload(payload) ?? payload;
  const candidate =
    (data && typeof data === 'object' && (data.user || data.account || data.data)) || data;
  if (!candidate || typeof candidate !== 'object') return null;
  if (!readField(candidate, ['id', 'user_id'], null)) return null;

  const first = readField(candidate, ['first_name', 'firstname'], '');
  const middle = readField(candidate, ['middle_name', 'middlename'], '');
  const last = readField(candidate, ['last_name', 'lastname'], '');
  const fullName = readField(candidate, ['name', 'full_name', 'display_name'], '') ||
    [first, middle, last].filter(Boolean).join(' ');

  return {
    id: readField(candidate, ['id', 'user_id'], null),
    name: fullName || 'Community member',
    firstName: first,
    lastName: last,
    email: readField(candidate, ['email', 'email_address'], ''),
    // The role comes from `me.php` ONLY (NFR-2a), which returns `role`
    // (`roles.role_name`: user | lineman | electric_company | admin) plus `role_id`.
    //
    // There is deliberately no `auth_provider` fallback here any more: that column holds
    // 'local' or 'google', never a role, so reading it produced a nonsense role string like
    // "local" that no allow-list contains - silently locking the user out of /company.
    // `ROLE.USER` is kept purely as a fail-closed default for a payload with no role at
    // all, since the least-privileged role is the safe assumption.
    role:
      normaliseRole(readField(candidate, ['role', 'role_name'], '')) || ROLE.USER,
    roleId: readField(candidate, ['role_id'], null),
    provider: readField(candidate, ['auth_provider'], ''),
    phone: readField(candidate, ['phone', 'contact', 'contact_number'], ''),
    avatar: readField(candidate, ['picture', 'avatar', 'photo', 'profile_image'], ''),
    createdAt: readField(candidate, ['created_at', 'registered_at'], ''),
    raw: candidate,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const [error, setError] = useState('');

  /**
   * Restore the session on app load (`GET /api/auth/me.php`).
   *
   * `signal.aborted` short-circuit is load-bearing. `apiRequest` reports a cancelled
   * request as an ApiError with status 0, which used to fall into the branch below and
   * set the status to `anonymous` - so any request cancelled by a navigation, or by the
   * React StrictMode double-mount, could sign the user out. That is exactly what breaks
   * the Google round trip: `GoogleCallback` stores the token and authenticates, then the
   * mount-time `refresh()` that StrictMode aborted resolves last and wipes the session,
   * so `/dashboard` bounces straight back to `/login`.
   */
  const refresh = useCallback(async ({ signal } = {}) => {
    try {
      const payload = await authApi.me({ signal });
      const nextUser = normaliseUser(payload);
      setUser(nextUser);
      setStatus(nextUser ? 'authenticated' : 'anonymous');
      return nextUser;
    } catch (requestError) {
      // Cancelled, not failed. Touch no state - another request owns the truth.
      if (signal?.aborted) return null;

      if (requestError?.status === 401 || requestError?.status === 403) {
        setUser(null);
        setStatus('anonymous');
        return null;
      }
      // Network / server error: stay anonymous but keep a message for the UI.
      setUser(null);
      setStatus('anonymous');
      setError(toUserMessage(requestError, 'We could not verify your session.'));
      return null;
    }
  }, []);

  /**
   * `GoogleCallback` stores the token then calls `refresh()`, and this mount effect fires
   * one too. React runs child effects before parent effects, so the cookie is already
   * present when this request is issued and both come back 200 - there is no ordering
   * problem to solve here beyond the `signal.aborted` guard above.
   */
  useEffect(() => {
    const controller = new AbortController();
    refresh({ signal: controller.signal });
    return () => controller.abort();
  }, [refresh]);

  const login = useCallback(
    async (credentials) => {
      // `login.php` only sets the httpOnly `jwt_token` cookie and echoes back
      // `{ success, message, user_id, token_issued }` - it returns NO profile and NO role.
      //
      // So the user object must be read back from `me.php`, which is the only endpoint
      // that publishes `role` (`auth/me.php` joins `roles.role_name`). Building it from
      // the login response instead would silently fall through to `ROLE.USER`, which
      // sent every electric_company account to the resident dashboard (NFR-2a).
      await authApi.login(credentials);

      const nextUser = await refresh();
      if (!nextUser) {
        // The password was accepted, but the profile could not be read. Failing loudly
        // beats silently landing on the wrong dashboard.
        throw new Error('You signed in, but we could not load your account. Please try again.');
      }
      return nextUser;
    },
    [refresh]
  );

  const register = useCallback(async (details) => {
    const payload = await authApi.register(details);
    const nextUser = normaliseUser(payload);
    // The API does not open a session on register, so the caller signs in next.
    return { user: nextUser, autoLoggedIn: false, payload };
  }, []);

  /** Sign in right after registration (register does not create a session). */
  const loginWithRegisteredAccount = useCallback(
    async ({ email, password }) => {
      try {
        return await login({ email, password });
      } catch {
        return null;
      }
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // A failed logout must never trap the user in the app.
    } finally {
      setStoredToken(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  /**
   * Drop the session locally, WITHOUT calling `logout.php`.
   *
   * Used when the API has already told us the session is gone (a 401 from any
   * endpoint), so the cookie is dead and asking the server to end it again would only
   * produce another failing request.
   */
  const invalidateSession = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(() => {
    const role = user?.role ?? '';

    return {
      user,
      status,
      role,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      // Role capability flags, so pages can gate UI without importing the role
      // tables themselves (NFR-2 - the backend remains the source of truth).
      isStaff: isStaff(role),
      isManager: isManager(role),
      isCompanyUser: isCompanyUser(role),
      error,
      login,
      loginWithRegisteredAccount,
      register,
      logout,
      invalidateSession,
      refresh,
      setUser,
    };
  }, [
    user,
    status,
    error,
    login,
    loginWithRegisteredAccount,
    register,
    logout,
    invalidateSession,
    refresh,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an <AuthProvider>');
  return context;
}
