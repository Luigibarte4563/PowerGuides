import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldAlert, X } from 'lucide-react';
import { Button } from './ui/Button';
import { setForbiddenHandler } from '@/api';
import { useAuth } from '@/context/AuthContext';

/**
 * FR-AUTH-4b - "your role may have changed, sign in again to refresh it".
 *
 * The JWT carries the role for its whole lifetime (SEC-3), so a promotion or demotion
 * only takes effect on the next sign-in. Until then the dashboard keeps hiding or showing
 * buttons based on a stale role while the server rejects the calls. The API client
 * forwards a 403 from an endpoint that the role should have been allowed to call (see
 * `ROLE_GATED_PATHS` in `api/client.js`) and this banner appears once.
 *
 * Deliberately a notice, not a redirect: the session is still valid, so nothing is thrown
 * away without the user asking. Signing out is offered because that is the only way to
 * pick up the new role, and the user keeps their place - `logout()` then a navigation back
 * to the same page with `state.from`, which `Login` honours.
 *
 * One report per navigation: several in-flight requests usually fail together, and the
 * user needs to see this once, not once per card on screen.
 */
export default function RoleChangeGuard() {
  const { logout, role } = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setForbiddenHandler(({ path }) => {
      setNotice((current) => current || { path });
    });
    return () => setForbiddenHandler(null);
  }, []);

  const signInAgain = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true, state: { from: '/company', staleRole: role } });
    } finally {
      setSigningOut(false);
    }
  }, [logout, navigate, role]);

  if (!notice) return null;

  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-start gap-3 rounded-card border border-warning-200 bg-warning-50 p-4 text-sm text-navy-800"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-navy-900">Your access may have changed</p>
        <p className="mt-0.5 text-navy-700">
          The server refused a request your account used to be allowed to make, so your role has
          probably been updated. Sign in again to pick up the new one.
        </p>
        <p className="mt-1 text-xs text-navy-500">
          Refused at <span className="font-mono">{notice.path}</span>. Until you sign in again,
          buttons on this page may not match what the API will accept.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" icon={RefreshCw} loading={signingOut} onClick={signInAgain}>
          Sign in again
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setNotice(null)}
          aria-label="Dismiss the access notice"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}