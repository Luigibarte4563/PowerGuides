import { useState } from 'react';
import { MapPin, ShieldCheck, UserCheck } from 'lucide-react';
import Badge from './ui/Badge';
import { Button } from './ui/Button';
import { Card, CardBody, CardHeader } from './ui/Card';
import { TBody, TD, TH, THead, TR, Table } from './ui/Table';
import DataView from './DataView';
import BarangayOutagesModal from './BarangayOutagesModal';

/**
 * A lineman's own assigned barangays, rendered for whichever screen asks for it.
 *
 * Shared by `/dashboard/assignments` and `/company/assignments` so the two cannot drift.
 * Both are legitimate landing places for a lineman - `defaultRootFor('lineman')` is
 * `/company`, so the company nav is where they actually start - and a lineman should see
 * the same rows wherever they look.
 *
 * Rows come from `lineman_assignment/my.php`, which derives the lineman from the JWT alone
 * and returns only ACTIVE assignments. There is nothing to select and nothing to choose:
 * a lineman cannot point this at another barangay, because the page has no control that
 * would do it and the endpoint has no parameter that would answer such a request. The
 * caller owns the query and passes the result, which keeps this component free of auth
 * decisions and lets each page keep its own loading/permission framing.
 *
 * These are the same rows the backend uses to scope `outage/get.php`,
 * `outage/verify.php`, `outage/add_update.php` and the company outage endpoints, so what
 * is listed here is precisely what can be acted on - not a hint about it.
 *
 * "View outages" opens `BarangayOutagesModal` for that one barangay. It is a dialog
 * rather than a link to `/company/outages` on purpose: the lineman asked about a specific
 * barangay, and the company list answers a different, much broader question.
 *
 * props: assignments, isLoading, error, onRetry
 */
export default function MyAssignmentList({ assignments = [], isLoading, error, onRetry }) {
  /*
   * The reports for a barangay open in a dialog rather than navigating away. Sending the
   * lineman to the company outage list discarded the barangay they had just chosen and
   * replaced a short, scoped answer with every report they can see; the dialog keeps the
   * context they were reading in place.
   */
  const [openBarangay, setOpenBarangay] = useState(null);
  const showOutages = (barangayName) => setOpenBarangay(barangayName || null);

  return (
    <>
      <DataView
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        loadingLabel="Loading your assigned barangays…"
        items={assignments}
        empty={{
          icon: UserCheck,
          title: 'No lineman assignments found.',
          description:
            'You have no active assignment yet. An electric company or admin account assigns linemen to barangays - until then there are no outage reports for you to work on.',
        }}
        renderCard={(assignment) => (
          <Card>
            <CardBody className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-100 text-primary-700">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy-900">
                  {assignment.barangayName || 'Unnamed barangay'}
                </p>
                <div className="mt-1.5">
                  <Badge tone="success" icon={ShieldCheck} size="sm">
                    Active Assignment
                  </Badge>
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => showOutages(assignment.barangayName)}
                    aria-label={`View outage reports for ${assignment.barangayName}`}
                  >
                    View outages
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
        renderTable={(visible) => (
          <div className="rounded-card border border-navy-100 bg-white shadow-card">
            <Table>
              <THead>
                <tr>
                  <TH>Barangay</TH>
                  <TH>Status</TH>
                  <TH align="right">Outage reports</TH>
                </tr>
              </THead>
              <TBody>
                {visible.map((assignment) => (
                  <TR key={assignment.id}>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-navy-900">
                        <MapPin className="h-3.5 w-3.5 text-navy-400" aria-hidden="true" />
                        {assignment.barangayName || 'Unnamed barangay'}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone="success" icon={ShieldCheck}>
                        Active Assignment
                      </Badge>
                    </TD>
                    <TD align="right">
                      {/*
                        Opens the reports for THIS barangay in a dialog. It carries no
                        access of its own - the dialog's query is already scoped to the
                        caller's active assignments server-side - so it can never reveal
                        an unassigned barangay.
                      */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => showOutages(assignment.barangayName)}
                        aria-label={`View outage reports for ${assignment.barangayName}`}
                      >
                        View outages
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      />

      {assignments.length > 0 ? (
        <Card>
          <CardHeader description="How assignments affect your access">
            Access follows the assignment
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm text-navy-600">
              <li>
                You can view, verify and add field updates to outage reports in these
                barangays. Reports outside them are not returned to you by the API at all.
              </li>
              <li>
                If an assignment is deactivated, you lose access to that barangay immediately
                - no sign-out needed.
              </li>
              <li>
                You cannot assign yourself or anyone else to a barangay. That is an electric
                company and admin action.
              </li>
            </ul>
            <p className="mt-4 text-sm text-navy-600">
              Select <span className="font-semibold text-navy-900">View outages</span> on any
              barangay above to see its reports here, without leaving this page.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <BarangayOutagesModal
        open={Boolean(openBarangay)}
        barangayName={openBarangay}
        onClose={() => setOpenBarangay(null)}
      />
    </>
  );
}