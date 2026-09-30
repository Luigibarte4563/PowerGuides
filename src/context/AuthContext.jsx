import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '@/api';
import { setStoredToken, unwrapPayload } from '@/api/client';
import { toUserMessage } from '@/utils/errorMessage';
import { readField } from '@/utils/formatters';

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
    role: readField(candidate, ['role', 'role_name', 'auth_provider'], 'user'),
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

  /** Restore the session on app load (`GET /api/auth/me.php`). */
  const refresh = useCallback(async ({ signal } = {}) => {
    try {
      const payload = await authApi.me({ signal });
      const nextUser = normaliseUser(payload);
      setUser(nextUser);
      setStatus(nextUser ? 'authenticated' : 'anonymous');
      return nextUser;
    } catch (requestError) {
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

  useEffect(() => {
    const controller = new AbortController();
    refresh({ signal: controller.signal });
    return () => controller.abort();
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    const payload = await authApi.login(credentials);
    const nextUser = normaliseUser(payload) || (await refresh());
    setUser(nextUser);
    setStatus(nextUser ? 'authenticated' : 'anonymous');
    return nextUser;
  }, [refresh]);

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

  const value = useMemo(
    () => ({
      user,
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      error,
      login,
      loginWithRegisteredAccount,
      register,
      logout,
      refresh,
      setUser,
    }),
    [user, status, error, login, loginWithRegisteredAccount, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an <AuthProvider>');
  return context;
}
