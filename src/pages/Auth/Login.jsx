import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import AuthShell, { AuthAlert, AuthDivider, AuthSuccess, GoogleButton } from './AuthShell';
import { GOOGLE_ERRORS } from './googleErrors';
import { Button } from '@/components/ui/Button';
import { Input, PasswordInput } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { landingPathFor, normaliseRole, ROLE_LABELS } from '@/utils/roles';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validateEmail, validateRequired } from '@/utils/validators';

const FIELD_ORDER = ['email', 'password'];

/** Phase 2 - login page (`POST /api/auth/login.php`). */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const googleErrorCode = new URLSearchParams(location.search).get('error');

  const successMessage = location.state?.registered
    ? 'Your account was created. Log in to start reporting.'
    : '';

  // Set by SessionExpiryGuard when the API rejected a request because the JWT is
  // gone. Distinct from `registered` so the user is told WHY they are back here.
  const expiredMessage = location.state?.expired
    ? 'Your session expired after a period of inactivity. Please sign in again.'
    : '';

  // Set by RoleChangeGuard when the API refused a call the current JWT role used to be
  // allowed to make (FR-AUTH-4b). The role lives in the token until it expires, so the
  // only way to pick up the new one is a fresh sign-in.
  const staleRoleMessage = location.state?.staleRole
    ? `Your access was changed while you were signed in. Sign in again to continue as ${
        ROLE_LABELS[normaliseRole(location.state.staleRole)] || 'your updated role'
      }.`
    : '';

  // google_callback.php redirects failures here as /login?error=<code>.
  const googleError = googleErrorCode ? GOOGLE_ERRORS[googleErrorCode] || GOOGLE_ERRORS.default : '';

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  const validate = () =>
    collectErrors({
      email: () => validateEmail(values.email, 'Email'),
      password: () => validateRequired(values.password, 'Password'),
    });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const validationErrors = validate();
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      const user = await login({ email: values.email.trim(), password: values.password });
      navigate(landingPathFor(user?.role, from), { replace: true });
    } catch (error) {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to report and track outages, floods and hazards in Dagupan."
      footer={
        <>
          New to PowerGuide?{' '}
          <Link
            to="/register"
            className="rounded font-semibold text-primary-600 transition hover:text-primary-700"
          >
            Create an account
          </Link>
        </>
      }
      aside={<LoginAside />}
    >
      {formError ? (
        <div className="mb-4">
          <AuthAlert>{formError}</AuthAlert>
        </div>
      ) : null}
      {googleError ? (
        <div className="mb-4">
          <AuthAlert>{googleError}</AuthAlert>
        </div>
      ) : null}
      {successMessage ? <div className="mb-4"><AuthSuccess>{successMessage}</AuthSuccess></div> : null}
      {expiredMessage ? <div className="mb-4"><AuthSuccess>{expiredMessage}</AuthSuccess></div> : null}
      {staleRoleMessage ? (
        <div className="mb-4">
          <AuthSuccess>{staleRoleMessage}</AuthSuccess>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          value={values.email}
          onChange={update('email')}
          error={errors.email}
        />

        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          required
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Signing in…' : 'Login'}
        </Button>
      </form>

      <AuthDivider />

      <GoogleButton redirectTo={from} />

      <p className="mt-6 text-center text-xs text-navy-400">
        <Link to="/" className="rounded font-semibold text-navy-600 transition hover:text-navy-900">
          Back to the home page
        </Link>
      </p>
    </AuthShell>
  );
}

const ASIDE_POINTS = [
  {
    icon: Zap,
    title: 'Report in seconds',
    text: 'Pin the location, pick a severity and add a photo - your neighbours see it instantly.',
  },
  {
    icon: ShieldCheck,
    title: 'Track to resolution',
    text: 'Follow your own reports and get notified when the status changes.',
  },
  {
    icon: Sparkles,
    title: 'Know what is nearby',
    text: 'Floods, hazards and available power stations around your saved location.',
  },
];

function LoginAside() {
  return (
    <div className="rounded-card border border-navy-100 bg-canvas p-8">
      <h2 className="text-2xl font-extrabold text-navy-900">
        One community, one reliable picture of the grid
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-navy-600">
        PowerGuide Dagupan merges community reports with official maintenance schedules so you always
        know whether the outage is on your street or citywide.
      </p>

      <ul className="mt-8 space-y-5">
        {ASIDE_POINTS.map((point) => (
          <li key={point.title} className="flex gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-white text-primary-600 shadow-card">
              <point.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-navy-900">{point.title}</p>
              <p className="mt-0.5 text-sm text-navy-600">{point.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 flex items-start gap-2 rounded-card bg-white p-4 text-xs text-navy-500 shadow-card">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
        Never approach a fallen power line. Report it from a safe distance instead.
      </p>
    </div>
  );
}
