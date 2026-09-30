import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { COMPANY_ROLES, hasRole } from '@/utils/roles';
import { Spinner } from '@/components/ui/States';
import AccessDenied from '@/pages/AccessDenied';

/**
 * Two-stage gate for `/company` (FR-AUTH-4):
 *   1. no session          -> redirect to /login, remembering the target
 *   2. session, wrong role -> the access-denied page (NOT a redirect, so a resident
 *      who followed a company link gets told why instead of landing somewhere else)
 *
 * `allowed` defaults to the staff allow-list. `outage_report_electric_com/get.php`
 * and friends accept `lineman | electric_company | admin`, so a field lineman is a
 * legitimate dashboard user and must not be bounced to the resident app.
 */
export default function RequireRole({ children, allowed = COMPANY_ROLES }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-sm font-medium text-navy-500">Checking your access…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (!hasRole(role, allowed)) {
    return <AccessDenied role={role} />;
  }

  return children ?? <Outlet />;
}
