import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/States';

/** Keeps signed-in users out of login/register and remembers the target page. */
export default function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();
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
    return <Navigate to={from && from.startsWith('/dashboard') ? from : '/dashboard'} replace />;
  }

  return <Outlet />;
}
