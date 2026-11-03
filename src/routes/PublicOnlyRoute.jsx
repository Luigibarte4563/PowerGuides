import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { landingPathFor, roleLabel } from '@/utils/roles';
import { Spinner } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

/**
 * Keeps signed-in users out of login/register and remembers the target page.
 *
 * The landing path is role-aware (`landingPathFor`), not a hard-coded `/dashboard`:
 * an electric_company account that is bounced to /login - by RequireRole, by an expired
 * session, or by hitting Back - must come back to /company. `landingPathFor` also
 * validates `from`, so a stale target the role cannot reach is discarded instead of
 * bouncing the user into a redirect loop.
 *
 * A signed-in visitor is NOT teleported to their home any more: that made /login look
 * broken ("logging in as another user sent me to /admin") because the bounce happened
 * before the form could appear. Instead they get a choice - continue to their own app,
 * or sign out, which reveals the login form underneath.
 */
export default function PublicOnlyRoute() {
  const { isAuthenticated, isLoading, role, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const from = location.state?.from;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="h-8 w-8" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            <h1 className="text-lg font-extrabold text-navy-900">You are already signed in</h1>
            <p className="mt-2 text-sm text-navy-600">
              Signed in as{' '}
              <span className="font-semibold text-navy-900">{user?.name || 'a user'}</span> (
              {roleLabel(role)}). Continue to your app, or sign out to use a different account.
            </p>

            <div className="mt-5 grid gap-2">
              <Button
                size="lg"
                fullWidth
                onClick={() => navigate(landingPathFor(role, from), { replace: true })}
              >
                Continue as {user?.firstName || 'this user'}
              </Button>
              <Button
                size="lg"
                fullWidth
                variant="outline"
                loading={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  try {
                    await logout();
                  } finally {
                    setSigningOut(false);
                  }
                }}
              >
                Use a different account
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
