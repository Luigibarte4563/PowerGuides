import { useMemo } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import MyAssignmentList from '@/components/MyAssignmentList';
import { useAuth } from '@/context/AuthContext';
import { useMyAssignments } from '@/hooks/useLinemanAssignments';

/**
 * Module ASSIGN (lineman side) - "My Assigned Barangays".
 *
 * The resident-app copy of the lineman's own view. A lineman reaches the same rows from
 * the company app's "Lineman Assignments" tab, which is where `defaultRootFor('lineman')`
 * actually sends them; `MyAssignmentList` is shared by both so they cannot drift.
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

      <MyAssignmentList
        assignments={assignments}
        isLoading={assignmentsQuery.isLoading}
        error={assignmentsQuery.isError}
        onRetry={() => assignmentsQuery.refetch()}
      />
    </div>
  );
}