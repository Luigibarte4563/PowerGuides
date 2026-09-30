import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { authApi } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { GOOGLE_ERRORS } from './googleErrors';

/**
 * Landing page for the Google OAuth round trip.
 *
 * `api/auth/google_callback.php` redirects here with the application's JWT:
 *   success -> /auth/google-callback?token=<jwt>
 *   failure -> /login?error=<code>   (handled by the login page)
 *
 * All this page does is store the token (mirrored into the `jwt_token` cookie the
 * API reads), restore the session with `me.php`, then go to the dashboard.
 */
export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = searchParams.get('token');
    const callbackError = searchParams.get('error');

    const run = async () => {
      if (callbackError) {
        setError(GOOGLE_ERRORS[callbackError] || GOOGLE_ERRORS.default);
        return;
      }
      if (!token) {
        setError(GOOGLE_ERRORS.missing_token);
        return;
      }

      authApi.storeGoogleToken(token);

      const user = await refresh();
      if (user) {
        navigate('/dashboard', { replace: true });
        return;
      }
      setError(GOOGLE_ERRORS.session_failed);
    };

    run();
  }, [searchParams, refresh, navigate]);

  if (error) {
    return (
      <div className="container-app flex min-h-[70vh] items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
              <TriangleAlert className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-lg font-extrabold text-navy-900">Google sign-in did not finish</h1>
            <p className="mt-2 text-sm text-navy-600" role="alert">
              {error}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button to="/login" variant="primary">
                Back to login
              </Button>
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center rounded-control border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 transition hover:bg-navy-50"
              >
                Try again
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-app flex min-h-[70vh] flex-col items-center justify-center gap-3 py-10">
      <Loader2 className="h-8 w-8 animate-spin text-primary-500" aria-hidden="true" />
      <p className="text-sm font-semibold text-navy-700" role="status" aria-live="polite">
        Finishing Google sign-in…
      </p>
      <p className="text-xs text-navy-400">One moment while we load your account.</p>
    </div>
  );
}
