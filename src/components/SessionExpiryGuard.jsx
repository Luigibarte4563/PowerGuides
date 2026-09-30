import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSessionExpiredHandler } from '@/api';
import { useAuth } from '@/context/AuthContext';

/**
 * Wires the API client's "session expired" hook to the router (NFR-1).
 *
 * The API issues a 24 hour JWT, so a tab left open overnight is the normal case where
 * the cookie dies mid-visit. Without this, the next poll or page load answered 401
 * and the user was left staring at an inline "session expired" error inside a page
 * that can no longer work - no way out except manually navigating to /login.
 *
 * Mounted once, next to the providers, and renders nothing. The ref guard matters:
 * React Query can have several in-flight requests fail at once, and each one would
 * otherwise queue its own navigation and reset the state again.
 */
export default function SessionExpiryGuard() {
  const { invalidateSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handled = useRef(false);

  useEffect(() => {
    // A new navigation means a fresh start, so a later 401 may act again.
    handled.current = false;
  }, [location.pathname]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (handled.current) return;
      handled.current = true;
      invalidateSession();
      navigate('/login', {
        replace: true,
        state: {
          from: `${location.pathname}${location.search}`,
          expired: true,
        },
      });
    });

    return () => setSessionExpiredHandler(null);
  }, [invalidateSession, navigate, location.pathname, location.search]);

  return null;
}
