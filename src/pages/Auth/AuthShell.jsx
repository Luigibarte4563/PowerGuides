import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { AuthAlert, AuthSuccess } from '@/components/ui/Alert';
import { setOauthReturnTo } from '@/utils/oauthHandoff';

/** Two-column shell shared by the login and register pages. */
export default function AuthShell({ title, subtitle, children, footer, aside }) {
  return (
    <div className="container-app grid gap-10 py-10 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-16">
      <div className="mx-auto w-full max-w-md lg:mx-0">
        <Logo />
        <div className="mt-8 rounded-card border border-navy-100 bg-white p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-extrabold text-navy-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-navy-500">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-6 text-center text-sm text-navy-500">{footer}</div> : null}
      </div>

      {aside ? <aside className="hidden lg:block">{aside}</aside> : null}
    </div>
  );
}

/** Google "G" mark as a component so it can be passed to `Button`'s icon prop. */
function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.93l-3.86-3c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.95H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.3a12 12 0 0 0 0 10.74l3.97-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.63l3.97 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

/**
 * Google OAuth button - the server handles the callback.
 *
 * `redirectTo` is the destination the user was heading for. It CANNOT be sent to the
 * server: `auth/google_oauth.php::getGoogleAuthUrl()` builds the URL from
 * `$_ENV['GOOGLE_REDIRECT_URI']` and ignores the query string, so a `?redirect_uri=`
 * looked like it worked and did nothing. The intent is therefore parked in
 * `sessionStorage` and picked up by `GoogleCallback` - see `utils/oauthHandoff`.
 *
 * Google's own account chooser needs nothing from here: `google.php` already sends
 * `prompt=select_account`, so Google always asks which account to use instead of
 * silently reusing the signed-in one.
 */
export function GoogleButton({ text = 'Continue with Google', redirectTo }) {
  const [busy, setBusy] = useState(false);

  const startGoogleSignIn = () => {
    setOauthReturnTo(redirectTo || '');
    setBusy(true);
    const base = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost/CrowdsourcedAPI'}/api/auth/google.php`;
    window.location.href = base;
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      fullWidth
      loading={busy}
      onClick={startGoogleSignIn}
      icon={GoogleIcon}
    >
      {text}
    </Button>
  );
}

/** "or" separator between the password form and Google sign-in. */
export function AuthDivider({ label = 'or' }) {
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-navy-200" />
      <span className="text-xs font-semibold uppercase tracking-wide text-navy-400">{label}</span>
      <span className="h-px flex-1 bg-navy-200" />
    </div>
  );
}

export { AuthAlert, AuthSuccess };
