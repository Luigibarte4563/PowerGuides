import {
  AlertTriangle,
  BatteryCharging,
  BellRing,
  Flame,
  MapPin,
  Plug,
  Timer,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Report and track power outages',
    description:
      'Post an outage with your barangay, category and severity. Follow it from reported to resolved in real time.',
    tone: 'primary',
  },
  {
    icon: Wrench,
    title: 'Scheduled maintenance & outages',
    description:
      'See company maintenance schedules ahead of time so you can prepare before service interruptions begin.',
    tone: 'info',
  },
  {
    icon: Plug,
    title: 'Find nearby power stations',
    description:
      'Browse available power stations around you, check availability status and see which ones are closest.',
    tone: 'success',
  },
  {
    icon: Waves,
    title: 'Flood reporting',
    description:
      'Report flooding in your area and check flood reports near your location to plan your routes.',
    tone: 'info',
  },
  {
    icon: AlertTriangle,
    title: 'Electrical hazard reporting',
    description:
      'Flag downed wires, exposed cables and other hazards. Owners can update the status as they are cleared.',
    tone: 'danger',
  },
  {
    icon: MapPin,
    title: 'Risk-area alerts',
    description:
      'Combine active floods and unresolved hazards around you into a single risk view with an adjustable radius.',
    tone: 'warning',
  },
  {
    icon: Flame,
    title: 'Heatmap of affected areas',
    description:
      'Visualise where problems concentrate with a heatmap layer and stored outage clusters on the map.',
    tone: 'danger',
  },
  {
    icon: BatteryCharging,
    title: 'Battery tracking & safety timers',
    description:
      'Track your own devices and battery levels, keep usage history, and run safety timers for appliances.',
    tone: 'success',
  },
  {
    icon: BellRing,
    title: 'Notifications',
    description:
      'Get notified about outages, hazards and maintenance near you, and never miss an unread update again.',
    tone: 'navy',
  },
];

const TONE_CLASSES = {
  primary: 'bg-primary-100 text-primary-700',
  info: 'bg-info-50 text-info-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  navy: 'bg-navy-100 text-navy-700',
};

/** Features section (Section 4.2). */
export default function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-16 lg:py-24">
      <div className="container-app">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Features</span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy-900 sm:text-4xl">
            Everything you need to stay informed and safe
          </h2>
          <p className="mt-4 text-base text-navy-600">
            PowerGuide Dagupan brings reports, schedules, maps and alerts into one place - built for
            residents reporting from their phones during an outage.
          </p>
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="group rounded-card border border-navy-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-card-hover"
            >
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-control ${TONE_CLASSES[feature.tone]}`}
              >
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-navy-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{feature.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
