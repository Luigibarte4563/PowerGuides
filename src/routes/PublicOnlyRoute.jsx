import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { landingPathFor } from '@/utils/roles';
import { Spinner } from '@/components/ui/States';

/**
 * Keeps signed-in users out of login/register and remembers the target page.
 *
 * The landing path is role-aware (`landingPathFor`), not a hard-coded `/dashboard`:
 * an electric_company account that is bounced to /login - by RequireRole, by an expired
 * session, or by hitting Back - must come back to /company. `landingPathFor` also
 * validates `from`, so a stale target the role cannot reach is discarded instead of
 * bouncing the user into a redirect loop.
 */
export default function PublicOnlyRoute() {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();
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
    return <Navigate to={landingPathFor(role, from)} replace />;
  }

  return <Outlet />;
}