import { BellRing, MapPin, UserPlus, Zap } from 'lucide-react';

const STEPS = [
  {
    icon: UserPlus,
    title: 'Create your free account',
    description:
      'Register with your name and email in under a minute. No role selection - PowerGuide is for residents.',
  },
  {
    icon: MapPin,
    title: 'Share your location',
    description:
      'Allow location access or drop a pin on the map so nearby outages, floods and hazards reach you first.',
  },
  {
    icon: Zap,
    title: 'Report or view',
    description:
      'Report an outage, flood or hazard with photos and severity, or browse what your neighbours reported.',
  },
  {
    icon: BellRing,
    title: 'Get notified',
    description:
      'Follow your reports to resolution and receive notifications whenever conditions change near you.',
  },
];

/** How it works: four simple steps (Section 4.2). */
export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-canvas py-16 lg:py-24">
      <div className="container-app">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">How it works</span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy-900 sm:text-4xl">
            Four steps to a safer, better-informed day
          </h2>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-card border border-navy-100 bg-white p-6 shadow-card">
              <span className="absolute -top-3 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-sm font-extrabold text-primary-300">
                {index + 1}
              </span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-control bg-primary-100 text-primary-700">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-navy-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
