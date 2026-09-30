import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <Compass className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-primary-600">Error 404</p>
          <h1 className="mt-2 text-3xl font-extrabold text-navy-900">We could not find that page</h1>
          <p className="mt-3 text-sm text-navy-600">
            The page you are looking for may have been moved or no longer exists.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button to="/" variant="primary" icon={Home}>
              Back to home
            </Button>
            <Link
              to="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-control border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-800 transition hover:bg-navy-50"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
