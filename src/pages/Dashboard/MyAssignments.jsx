import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck, UserCheck } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table';
import DataView from '@/components/DataView';
import { useAuth } from '@/context/AuthContext';
import { useMyAssignments } from '@/hooks/useLinemanAssignments';

/**
 * Module ASSIGN (lineman side) - "My Assigned Barangays".
 *
 * Everything here comes from `lineman_assignment/my.php`, which derives the lineman from
 * the JWT alone and returns only their ACTIVE assignments. There is nothing to select and
 * nothing to choose: a lineman cannot point this page at another barangay, because the
 * page has no control that would do it and the endpoint has no parameter that would
 * answer such a request.
 *
 * These are the same rows the backend uses to scope `outage/get.php`,
 * `outage/verify.php`, `outage/add_update.php` and the company outage endpoints, so what
 * is listed here is precisely what can be acted on - not a hint about it.
 */
export default function MyAssignments() {
  const { isStaff, role } = useAuth();
  const isLineman = role === 'lineman' && isStaff;

  // Enabled only for a lineman: `my.php` is lineman-only and answers 403 otherwise.
  const assignmentsQuery = useMyAssignments({ enabled: isLineman });
  const assignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);

  if (!isLineman) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Assigned Barangays"
          description="The barangays you are assigned to cover as field staff."
        />
        <Card>
          <CardBody>
            <p className="text-sm text-navy-600">
              This page is for lineman accounts. An electric company or admin account assigns
              linemen from the company dashboard instead.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assigned Barangays"
        description="The barangays you are assigned to cover. Outage reports in these areas are the ones you can review, verify and update."
      />

      <DataView
        isLoading={assignmentsQuery.isLoading}
        error={assignmentsQuery.isError}
        onRetry={() => assignmentsQuery.refetch()}
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
                        A convenience link to the outage list. It carries no access of its
                        own - the list itself is already scoped server-side - so following
                        it can never show an unassigned barangay.
                      */}
                      <Button
                        size="sm"
                        variant="ghost"
                        to="/company/outages"
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
                If an assignment is deactivated, you lose access to that barangay
                immediately - no sign-out needed.
              </li>
              <li>
                You cannot assign yourself or anyone else to a barangay. That is an
                electric company and admin action.
              </li>
            </ul>
            <p className="mt-4">
              <Link
                to="/company/outages"
                className="rounded font-semibold text-primary-600 transition hover:text-primary-700"
              >
                Go to the outage reports
              </Link>
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}