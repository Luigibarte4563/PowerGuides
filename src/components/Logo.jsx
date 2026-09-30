import { Link } from 'react-router-dom';
import logo from '@/assets/logo.svg';

/** Brand lockup used in the public header and the dashboard sidebar. */
export default function Logo({ to = '/', variant = 'dark', showText = true, className = '' }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 rounded-control focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${className}`}
      aria-label="PowerGuide Dagupan - home"
    >
      <img src={logo} alt="" width="36" height="36" className="h-9 w-9 shrink-0 rounded-card" />
      {showText ? (
        <span className="leading-tight">
          <span
            className={`block text-base font-extrabold tracking-tight ${
              variant === 'light' ? 'text-white' : 'text-navy-900'
            }`}
          >
            PowerGuide
          </span>
          <span
            className={`block text-[11px] font-semibold uppercase tracking-[0.14em] ${
              variant === 'light' ? 'text-primary-300' : 'text-primary-600'
            }`}
          >
            Dagupan
          </span>
        </span>
      ) : null}
    </Link>
  );
}
