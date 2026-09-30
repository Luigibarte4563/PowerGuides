import { AlertTriangle, BatteryCharging, Droplets, Timer } from 'lucide-react';

const TIPS = [
  {
    icon: AlertTriangle,
    title: 'Stay away from downed lines',
    description:
      'Never touch or step over a fallen power line. Assume every wire is live and keep at least 10 metres away.',
  },
  {
    icon: Droplets,
    title: 'Keep electricity away from water',
    description:
      'Never use appliances in a flooded room. Switch off the main breaker first if it is safe to reach.',
  },
  {
    icon: BatteryCharging,
    title: 'Charge before the outage',
    description:
      'Keep power banks and torches charged, and track your battery levels so essentials survive a long outage.',
  },
  {
    icon: Timer,
    title: 'Use safety timers',
    description:
      'Set a timer for appliances and generators so nothing runs unattended while you are away or asleep.',
  },
];

/** Safety tips section - referenced by the public header nav. */
export default function Safety() {
  return (
    <section id="safety" className="scroll-mt-20 bg-white py-16 lg:py-24">
      <div className="container-app grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-danger-600">Safety first</span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy-900 sm:text-4xl">
            Outages are inconvenient. Electrical hazards are not.
          </h2>
          <p className="mt-4 text-base text-navy-600">
            PowerGuide helps you spot problems early, but your personal safety always comes first.
            If you see a downed line or a sparking connection, keep your distance and report it here so
            the community and the utility company know about it.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {TIPS.map((tip) => (
            <li key={tip.title} className="rounded-card border border-navy-100 bg-canvas p-5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-white text-danger-600 shadow-card">
                <tip.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-navy-900">{tip.title}</h3>
              <p className="mt-1.5 text-sm text-navy-600">{tip.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
