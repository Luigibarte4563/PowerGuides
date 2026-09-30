import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, MapPin, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const HIGHLIGHTS = [
  { value: '52', label: 'Community-powered data points' },
  { value: 'Real time', label: 'Outage and hazard updates' },
  { value: 'Free', label: 'For every Dagupan resident' },
];

/** Landing hero: headline, description, primary and secondary CTAs. */
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-900">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(245,158,11,0.35), transparent 45%), radial-gradient(circle at 85% 10%, rgba(59,130,246,0.25), transparent 40%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="container-app relative grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div className="animate-slide-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-300 ring-1 ring-inset ring-white/15">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            Crowdsourced for Dagupan City
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            Know before the{' '}
            <span className="text-primary-400">lights go out.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-navy-200 sm:text-lg">
            PowerGuide Dagupan is the community guide to power outages, flooding and electrical
            hazards. Report what is happening on your street, track scheduled maintenance, and get
            alerts before you are affected.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button to="/register" variant="primary" size="lg" iconRight={ArrowRight}>
              Get Started
            </Button>
            <Button to="/login" variant="white" size="lg">
              Login
            </Button>
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <div key={item.label} className="rounded-card bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                <dt className="text-lg font-extrabold text-primary-300">{item.value}</dt>
                <dd className="mt-0.5 text-xs font-medium text-navy-300">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Product preview */}
        <div className="relative animate-fade-in">
          <div className="rounded-card border border-white/10 bg-navy-950/60 p-5 shadow-pop backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-danger-500" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary-500" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-success-500" aria-hidden="true" />
              <span className="ml-2 text-xs font-semibold text-navy-400">Live outage map</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PreviewCard
                icon={Zap}
                tone="danger"
                title="Power outage reported"
                meta="Poblacion · Reported 8 min ago"
              />
              <PreviewCard
                icon={MapPin}
                tone="info"
                title="Maintenance scheduled"
                meta="Mabini · Tomorrow, 9:00 AM"
              />
              <PreviewCard
                icon={BellRing}
                tone="warning"
                title="Flood advisory nearby"
                meta="Within 800 m of you"
              />
              <div className="rounded-card border border-dashed border-white/15 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-navy-400">Community</p>
                <p className="mt-1 text-2xl font-extrabold text-white">1,240+</p>
                <p className="text-[11px] text-navy-400">reports this month</p>
              </div>
            </div>

            <div className="mt-4 h-24 overflow-hidden rounded-card bg-navy-800/70 p-3">
              <div className="flex h-full items-end gap-1.5">
                {[35, 62, 48, 80, 55, 92, 70, 45, 66, 38, 74, 58].map((height, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-t bg-gradient-to-t from-primary-600 to-primary-400"
                    style={{ height: `${height}%` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -bottom-5 -left-4 hidden rounded-card bg-white p-4 shadow-pop sm:block">
            <p className="text-xs font-bold uppercase tracking-wide text-navy-400">Next alert</p>
            <p className="mt-1 text-sm font-bold text-navy-900">Scheduled maintenance</p>
            <Link to="/register" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700">
              Turn on alerts <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const TONE_CLASSES = {
  danger: 'bg-danger-500/15 text-danger-500',
  warning: 'bg-primary-500/15 text-primary-400',
  info: 'bg-info-500/15 text-info-500',
  success: 'bg-success-500/15 text-success-500',
};

function PreviewCard({ icon: Icon, tone, title, meta }) {
  return (
    <div className="rounded-card border border-white/10 bg-white/5 p-4">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-control ${TONE_CLASSES[tone]}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-bold text-white">{title}</p>
      <p className="mt-0.5 text-xs text-navy-300">{meta}</p>
    </div>
  );
}
