import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, MapPinned, Users } from 'lucide-react';
import AuthShell, { AuthAlert, AuthDivider, GoogleButton } from './AuthShell';
import { Button } from '@/components/ui/Button';
import { Input, PasswordInput } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { landingPathFor } from '@/utils/roles';
import { toFieldErrors, toUserMessage } from '@/utils/errorMessage';
import {
  clearFieldError,
  collectErrors,
  hasErrors,
  passwordStrength,
  validateEmail,
  validateMatch,
  validatePassword,
  validateRequired,
} from '@/utils/validators';

const FIELD_ORDER = ['firstName', 'lastName', 'email', 'password'];
const STRENGTH_BARS = [1, 2, 3, 4];
const STRENGTH_COLORS = {
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  info: 'bg-info-500',
  success: 'bg-success-500',
  neutral: 'bg-navy-200',
};

/** Phase 2 - register page (`POST /api/auth/register.php`). */
export default function Register() {
  const { register, loginWithRegisteredAccount } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => passwordStrength(values.password), [values.password]);

  const update = (field) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  const validate = () =>
    collectErrors({
      firstName: () => validateRequired(values.firstName, 'First name'),
      lastName: () => validateRequired(values.lastName, 'Last name'),
      email: () => validateEmail(values.email, 'Email'),
      password: () => validatePassword(values.password),
      confirmPassword: () => validateMatch(values.confirmPassword, values.password, 'Passwords'),
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
      const result = await register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
      });

      // Some deployments log the user in immediately, others do not.
      let user = null;
      if (!result.autoLoggedIn) {
        user = await loginWithRegisteredAccount({
          email: values.email.trim(),
          password: values.password,
        });
      }
      // register.php always creates a `user` account, so this is /dashboard - the
      // role is read back rather than assumed, keeping the redirect honest if that
      // ever changes.
      navigate(landingPathFor(user?.role), { replace: true });
    } catch (error) {
      setErrors(toFieldErrors(error, FIELD_ORDER));
      setFormError(toUserMessage(error, 'We could not create your account.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever for Dagupan residents. Registered accounts are standard community users."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="rounded font-semibold text-primary-600 transition hover:text-primary-700"
          >
            Login
          </Link>
        </>
      }
      aside={<RegisterAside />}
    >
      {formError ? (
        <div className="mb-4">
          <AuthAlert>{formError}</AuthAlert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* The API stores first_name / last_name separately (register.php). */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            name="firstName"
            autoComplete="given-name"
            placeholder="Juan"
            required
            value={values.firstName}
            onChange={update('firstName')}
            error={errors.firstName}
          />
          <Input
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            placeholder="Dela Cruz"
            required
            value={values.lastName}
            onChange={update('lastName')}
            error={errors.lastName}
          />
        </div>

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


        <div>
          <PasswordInput
            label="Password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            required
            value={values.password}
            onChange={update('password')}
            error={errors.password}
            hint="The API requires at least 6 characters."
          />
          {values.password ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-1.5 flex-1 gap-1" aria-hidden="true">
                {STRENGTH_BARS.map((bar) => (
                  <span
                    key={bar}
                    className={`flex-1 rounded-full ${
                      bar <= strength.score ? STRENGTH_COLORS[strength.tone] : 'bg-navy-100'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-navy-600">{strength.label}</span>
            </div>
          ) : null}
        </div>

        <PasswordInput
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Repeat your password"
          required
          value={values.confirmPassword}
          onChange={update('confirmPassword')}
          error={errors.confirmPassword}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Creating your account…' : 'Create account'}
        </Button>

        <p className="text-center text-xs text-navy-400">
          By registering you agree to report only incidents you have observed.
        </p>
      </form>

      <AuthDivider />

      <GoogleButton text="Sign up with Google" redirectTo="/dashboard" />
    </AuthShell>
  );
}

const ASIDE_POINTS = [
  { icon: Users, title: 'Community powered', text: 'Your reports help your barangay prepare and recover faster.' },
  { icon: MapPinned, title: 'Location aware', text: 'Alerts are filtered to the area you save in My Location.' },
  { icon: BadgeCheck, title: 'No role needed', text: 'Accounts are standard users - nothing to configure.' },
];

function RegisterAside() {
  return (
    <div className="rounded-card border border-navy-100 bg-canvas p-8">
      <h2 className="text-2xl font-extrabold text-navy-900">What you get after registering</h2>
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

      <ul className="mt-8 space-y-2 rounded-card bg-white p-5 shadow-card">
        {[
          'Report outages, floods and electrical hazards',
          'Track your own reports and edit or delete them',
          'Mark power stations as available or unavailable',
          'Monitor battery levels and run safety timers',
        ].map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-navy-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
