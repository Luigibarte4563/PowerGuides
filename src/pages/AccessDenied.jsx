import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { roleLabel } from '@/utils/roles';

/**
 * Shown when a signed-in user opens a `/company` page their role cannot reach
 * (FR-AUTH-4). `auth/rbac.php` would answer 403 on the underlying call, so this
 * page only has to explain the situation and offer a way out.
 */
export default function AccessDenied({ role }) {
  const { user } = useAuth();
  const { roles } = useReference();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-lg rounded-card border border-navy-100 bg-white p-8 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-600">
          <ShieldX className="h-7 w-7" aria-hidden="true" />
        </span>

        <h1 className="mt-5 text-2xl font-extrabold text-navy-900">Access denied</h1>
        <p className="mt-2 text-sm text-navy-600">
          The Electric Company Dashboard is limited to electric company personnel. Your account is signed in
          as <span className="font-semibold text-navy-900">{roleLabel(role, roles)}</span>, which does not
          have access to outage management, maintenance planning or broadcasts.
        </p>

        <p className="mt-4 text-xs text-navy-400">
          Signed in as {user?.email}. Access is granted by the system administrator, not from this page.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button to="/dashboard">Go to my dashboard</Button>
          <Button variant="outline" to="/">
            Back to home
          </Button>
        </div>

        <p className="mt-6 text-xs text-navy-400">
          Think this is wrong?{' '}
          <Link to="/dashboard/profile" className="font-semibold text-primary-600 hover:text-primary-700">
            Check your account details
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
