import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Call-to-action banner near the bottom of the landing page. */
export default function CtaBanner() {
  return (
    <section className="bg-canvas pb-16 lg:pb-24">
      <div className="container-app">
        <div className="relative overflow-hidden rounded-card bg-navy-900 px-6 py-12 text-center shadow-card sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 20%, rgba(245,158,11,0.4), transparent 45%), radial-gradient(circle at 85% 80%, rgba(59,130,246,0.35), transparent 45%)',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Join the neighbours who keep Dagupan informed
            </h2>
            <p className="mt-4 text-base text-navy-200">
              Create your free account and start reporting outages, floods and electrical hazards in
              under a minute.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button to="/register" variant="primary" size="lg" iconRight={ArrowRight}>
                Get Started
              </Button>
              <Button to="/login" variant="white" size="lg">
                I already have an account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
