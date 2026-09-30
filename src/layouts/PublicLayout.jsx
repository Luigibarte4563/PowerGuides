import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { APP_NAME } from '@/utils/constants';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#safety', label: 'Safety' },
  { href: '#contact', label: 'Contact' },
];

/** Marketing/landing chrome: header, anchor nav, mobile menu and footer. */
export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-[800] border-b border-navy-100 bg-white/90 backdrop-blur">
        <div className="container-app flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-control text-sm font-semibold text-navy-600 transition hover:text-navy-900"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Button to="/login" variant="ghost" size="sm">
              Login
            </Button>
            <Button to="/register" variant="primary" size="sm">
              Register
            </Button>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-control text-navy-700 transition hover:bg-navy-100 sm:hidden"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {menuOpen ? (
          <div id="public-mobile-menu" className="border-t border-navy-100 bg-white px-4 py-4 sm:hidden">
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-control px-3 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 grid gap-2">
              <Button to="/login" variant="outline" fullWidth>
                Login
              </Button>
              <Button to="/register" variant="primary" fullWidth>
                Register
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-navy-100 bg-navy-900 text-navy-200">
        <div className="container-app grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo to="/" variant="light" />
            <p className="mt-4 max-w-xs text-sm text-navy-300">
              A crowdsourced guide to power outages, flooding and electrical hazards across Dagupan City.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Product</h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#features" className="text-navy-300 transition hover:text-primary-300">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-navy-300 transition hover:text-primary-300">
                  How it works
                </a>
              </li>
              <li>
                <Link to="/login" className="text-navy-300 transition hover:text-primary-300">
                  Login
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-navy-300 transition hover:text-primary-300">
                  Register
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Community</h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to="/dashboard/outages" className="text-navy-300 transition hover:text-primary-300">
                  Report an outage
                </Link>
              </li>
              <li>
                <Link to="/dashboard/floods" className="text-navy-300 transition hover:text-primary-300">
                  Report flooding
                </Link>
              </li>
              <li>
                <Link to="/dashboard/hazards" className="text-navy-300 transition hover:text-primary-300">
                  Report a hazard
                </Link>
              </li>
              <li>
                <Link to="/dashboard/risk-areas" className="text-navy-300 transition hover:text-primary-300">
                  Check risk areas
                </Link>
              </li>
            </ul>
          </div>

          <div id="contact">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Get in touch</h2>
            <ul className="mt-4 space-y-2 text-sm text-navy-300">
              <li>PowerGuide Dagupan</li>
              <li>Dagupan City, Pangasinan</li>
              <li>
                <a href="mailto:help@powerguidedagupan.app" className="transition hover:text-primary-300">
                  help@powerguidedagupan.app
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-navy-800">
          <div className="container-app flex flex-col items-center justify-between gap-2 py-5 text-xs text-navy-400 sm:flex-row">
            <p>
              &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
            </p>
            <p>Built by the community, for the community.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
