import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleDot,
  Flame,
  Layers,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/Card';
import { InfoNote } from '@/components/ui/Alert';
import { LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useCompanyOutageList, useCompanySummary } from '@/hooks/useCompanyOutages';
import { useNotifications } from '@/hooks/useNotifications';
import { severityTone, statusTone } from '@/utils/constants';
import { readCompanyOutage } from '@/utils/records';
import { formatRelativeTime, humanize } from '@/utils/formatters';
import { roleLabel } from '@/utils/roles';

const RECENT_LIMIT = 8;

/**
 * Module DASH - company dashboard home.
 *
 * Every figure comes from the API; nothing here is computed from a cached list or a
 * hardcoded list. They are grouped into sections rather than one long grid, because the
 * cards do not all mean the same kind of thing:
 *
 *   Outage reports  what needs attention right now, split by status
 *   Field crew      lineman coverage (managers only)
 *   Hazards & floods community safety reports
 *   Assets          power stations and computed outage clusters
 *
 * Two subtleties worth knowing:
 *
 *  - `activeOutages` is `get_active.php`, which counts `status != 'rejected' AND
 *    is_active = 1` - i.e. every open report, not just the ones whose status is literally
 *    `active`. `totalOutages` comes from the company list instead. They therefore need not
 *    add up, and the labels say so.
 *  - Every outage figure is scoped server-side to the caller's assignments, so a lineman
 *    sees counts for their own barangays rather than city-wide totals. `electric_company`
 *    and `admin` see the whole city, unchanged.
 *
 * A failed count degrades to a dash on its own card (`isPartial`), and each figure is
 * requested independently, so one endpoint being unavailable never blanks the page.
 */
export default function Overview() {
  const { user, role, isManager } = useAuth();
  const { roles } = useReference();
  const { summary, isLoading, isFetching, isPartial, refetch, isError } = useCompanySummary({
    // `get_complete` and the assignment endpoints are manager-only; skipping them keeps a
    // lineman from firing requests that are certain to 403.
    includeManagerCounts: isManager,
  });
  const { unreadCount } = useNotifications();

  const recentQuery = useCompanyOutageList({ scope: 'scoped' }, { staleTime: 30 * 1000 });

  const recent = (recentQuery.data || [])
    .map(readCompanyOutage)
    .slice(0, RECENT_LIMIT);

  /**
   * `.count` is required, not optional decoration.
   *
   * `useCompanySummary` wraps every figure as `{ count, failed }` so a single failed
   * endpoint can degrade to a dash instead of blanking the row. Passing the wrapper
   * straight through made `formatCount` do `Number({ count: 3 })`, which is NaN - so the
   * cards rendered the string "NaN".
   */
  const outageCards = [
    {
      label: 'Active outage reports',
      value: summary?.activeOutages?.count,
      icon: Zap,
      tone: 'danger',
      to: '/company/outages?status=active',
      hint: 'Open right now',
    },
    {
      label: 'Awaiting review',
      value: summary?.underReviewOutages?.count,
      icon: Search,
      tone: 'warning',
      to: '/company/outages?status=under_review',
      hint: 'Not yet verified',
    },
    {
      label: 'Verified reports',
      value: summary?.verifiedOutages?.count,
      icon: CheckCircle2,
      tone: 'info',
      to: '/company/outages?status=verified',
      hint: 'Confirmed by staff',
    },
    {
      label: 'Resolved reports',
      value: summary?.resolvedOutages?.count,
      icon: CheckCircle2,
      tone: 'success',
      to: '/company/outages?status=resolved',
      hint: 'All time',
    },
    {
      label: 'All outage reports',
      value: summary?.totalOutages?.count,
      icon: Layers,
      tone: 'navy',
      to: '/company/outages',
      hint: 'Every status combined',
    },
    {
      label: 'Reported in 7 days',
      value: summary?.recentHeatmapReports?.count,
      icon: Flame,
      tone: 'danger',
      to: '/company/map',
      hint: 'From the heatmap window',
    },
  ];

  const crewCards = [
    {
      label: 'Active assignments',
      value: summary?.activeAssignments?.count,
      icon: UserCheck,
      tone: 'primary',
      to: '/company/assignments',
      hint: 'Linemen currently covering a barangay',
    },
    {
      label: 'All assignments',
      value: summary?.totalAssignments?.count,
      icon: Layers,
      tone: 'navy',
      to: '/company/assignments',
      hint: 'Active and deactivated',
    },
  ];

  const safetyCards = [
    {
      label: 'Open hazards',
      value: summary?.openHazards?.count,
      icon: AlertTriangle,
      tone: 'danger',
      to: '/company/hazards',
      hint: 'Reported, awaiting review',
    },
    {
      label: 'Verified hazards',
      value: summary?.verifiedHazards?.count,
      icon: ShieldAlert,
      tone: 'warning',
      to: '/company/hazards',
      hint: 'Confirmed by staff',
    },
    {
      label: 'Open flood reports',
      value: summary?.openFloods?.count,
      icon: Waves,
      tone: 'info',
      to: '/company/map',
      hint: 'Reported, awaiting review',
    },
  ];

  const assetCards = [
    {
      label: 'Available power stations',
      value: summary?.availableStations?.count,
      icon: Plug,
      tone: 'success',
      to: '/company/power-stations',
      hint: 'Open to the public',
    },
    {
      label: 'Active clusters',
      value: summary?.activeClusters?.count,
      icon: CircleDot,
      tone: 'primary',
      to: '/company/map',
      hint: 'Computed outage groupings',
    },
    {
      label: 'Upcoming maintenance',
      value: summary?.upcomingMaintenance?.count,
      icon: Wrench,
      tone: 'warning',
      to: '/company/maintenance',
      hint: 'Upcoming and ongoing',
    },
    {
      label: 'Completed maintenance',
      value: summary?.completedMaintenance?.count,
      icon: CheckCircle2,
      tone: 'neutral',
      to: '/company/maintenance',
      hint: 'Finished work, all time',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description={`Signed in as ${roleLabel(role, roles)}. Monitor reports, plan maintenance and keep residents informed.`}
        actions={
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={() => refetch()}
            loading={isFetching && !isLoading}
          >
            Refresh
          </Button>
        }
      />

      {isError && !summary ? (
        <InfoNote>
          The summary counts could not be loaded. Check your connection and try again.
        </InfoNote>
      ) : null}

      {isPartial ? (
        <InfoNote>
          Some counts could not be loaded right now, so those cards show a dash. The rest are current.
        </InfoNote>
      ) : null}

      <CardSection
        title="Outage reports"
        description={
          isManager
            ? 'City-wide. Open means not rejected and still active.'
            : 'Limited to the barangays assigned to you.'
        }
        cards={outageCards}
        isLoading={isLoading}
      />

      {isManager ? (
        <CardSection
          title="Field crew"
          description="Who is covering which barangay."
          cards={crewCards}
          isLoading={isLoading}
        />
      ) : null}

      <CardSection
        title="Hazards & floods"
        description="Community safety reports needing attention."
        cards={safetyCards}
        isLoading={isLoading}
      />

      <CardSection
        title="Assets & maintenance"
        description="Infrastructure available to residents and work already scheduled."
        cards={assetCards}
        isLoading={isLoading}
      />

      {/* `minmax(0, …)` rather than a bare `1.4fr`.
          Tailwind turns `1.4fr` into `grid-template-columns: 1.4fr 1fr`, and in CSS Grid a
          bare `fr` track is really `minmax(auto, 1.4fr)` - the `auto` floor is the item's
          MIN-CONTENT width. So any descendant that cannot shrink (a long email, an unbreakable
          string) widens the whole track and scrolls the page sideways. An explicit 0 floor
          lets both cards stay inside the container and the `truncate` children ellipsize. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader
            description="The newest reports across Dagupan, newest first."
            action={
              <Button size="sm" variant="outline" to="/company/outages" iconRight={ArrowRight}>
                All reports
              </Button>
            }
          >
            Recent outage activity
          </CardHeader>
          <CardBody className="p-0">
            {recentQuery.isLoading ? (
              <LoadingState label="Loading recent reports…" />
            ) : recentQuery.isError ? (
              <div className="p-5">
                <InfoNote>
                  The recent report feed could not be loaded.{' '}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => recentQuery.refetch()}
                  >
                    Try again
                  </button>
                  .
                </InfoNote>
              </div>
            ) : recent.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-navy-500">
                  No outage reports have come in yet. New community reports will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-navy-100">
                {recent.map((outage) => (
                  <li key={outage.id}>
                    <Link
                      to={`/company/outages/${outage.id}`}
                      className="flex items-start justify-between gap-3 px-5 py-3.5 transition hover:bg-navy-50/70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-900">
                          {outage.locationName || outage.barangay || 'Unspecified location'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-navy-500">
                          {[
                            outage.barangay,
                            humanize(outage.category, 'Uncategorised'),
                            outage.reporter,
                            `reported ${formatRelativeTime(outage.createdAt)}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {outage.severity ? (
                          <Badge tone={severityTone(outage.severity)} size="sm">
                            {humanize(outage.severity)}
                          </Badge>
                        ) : null}
                        {outage.status ? (
                          <Badge tone={statusTone(outage.status)} size="sm">
                            {humanize(outage.status)}
                          </Badge>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="min-w-0">
            <CardHeader>Quick actions</CardHeader>
            <CardBody className="space-y-2">
              <QuickAction
                to="/company/outages"
                icon={Zap}
                title="Review outage reports"
                text="Filter, verify and change status at single, barangay or city-wide scope."
              />
              <QuickAction
                to="/company/maintenance"
                icon={Wrench}
                title="Plan maintenance"
                text="Schedule work per barangay and notify affected residents."
              />
              {isManager ? (
                <QuickAction
                  to="/company/assignments"
                  icon={UserCheck}
                  title="Assign linemen"
                  text="Post field linemen to the barangays they cover."
                />
              ) : null}
              <QuickAction
                to="/company/map"
                icon={CircleDot}
                title="Open the situational map"
                text="Outage heatmap, clusters, flood reports and electrical hazards."
              />
              <QuickAction
                to="/company/notifications"
                icon={Bell}
                badge={unreadCount}
                title="Notifications"
                text="Read your inbox and broadcast an update to residents."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Signed in</CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-navy-500">Name</span>
                <span className="truncate font-semibold text-navy-800">{user?.name || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-navy-500">Email</span>
                <span className="truncate font-semibold text-navy-800">{user?.email || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-navy-500">Role</span>
                <Badge tone="primary">{roleLabel(role, roles)}</Badge>
              </div>
              <p className="pt-1 text-xs text-navy-400">
                Actions are limited by your role. The API re-checks every permission, so anything
                hidden here would also be rejected by the server.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * A titled group of stat cards.
 *
 * Each card reads its own figure out of `summary`, so a card whose endpoint failed shows a
 * dash while its neighbours stay correct.
 */
function CardSection({ title, description, cards, isLoading }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">{title}</h2>
        <p className="text-xs text-navy-400">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={formatCount(card.value, isLoading)}
            hint={card.hint}
            icon={card.icon}
            tone={card.tone}
            to={card.to}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Render a count, or a dash when there is not a real number to show.
 *
 * The `Number.isFinite` guard is what stops "NaN" reaching the screen: `toLocaleString`
 * happily stringifies NaN, so a shape mismatch upstream (an object where a number was
 * expected) would otherwise be displayed as if it were data. `null` is checked before the
 * conversion because `Number(null)` is 0, which would turn "could not load" into "0".
 */
function formatCount(value, isLoading) {
  if (isLoading) return '…';
  if (value === null || value === undefined || value === '') return '—';
  const count = Number(value);
  if (!Number.isFinite(count)) return '—';
  return count.toLocaleString('en-PH');
}

function QuickAction({ to, icon: Icon, title, text, badge }) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-control p-3 transition hover:bg-navy-50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary-100 text-primary-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          {title}
          {badge > 0 ? (
            <Badge tone="danger" size="sm">
              {badge}
            </Badge>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-navy-500">{text}</span>
      </span>
    </Link>
  );
}