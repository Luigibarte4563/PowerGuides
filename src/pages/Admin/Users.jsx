import { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, User as UserIcon, UserCog } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useAdminUsers, useCreateUser, useUpdateRole } from '@/hooks/useAdmin';
import { ADMIN_PAGE_SIZE } from '@/utils/constants';
import { formatDateTime } from '@/utils/formatters';
import { roleLabel } from '@/utils/roles';
import { toUserMessage } from '@/utils/errorMessage';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_CREATE_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  roleId: '',
};

/** Same rules the API enforces (mirrored from auth/register.php). */
function validateCreateForm(form) {
  if (!form.firstName.trim()) return 'First name is required.';
  if (!form.lastName.trim()) return 'Last name is required.';
  if (!EMAIL_PATTERN.test(form.email.trim())) return 'Enter a valid email address.';
  if (form.password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

/**
 * Module ADMIN - user directory & role management (`/admin/users`).
 *
 * The screen the platform never had: roles were granted by editing users.role_id in
 * the database by hand. Now `admin/users.php` lists every account and
 * `admin/update_role.php` performs the change, both admin-only.
 *
 * Two rules this screen mirrors from the backend:
 *  - Your own row has no role picker - the server rejects changing your own role,
 *    and the only admin locking themselves out is not a mistake the UI should invite.
 *  - The role travels inside the target's JWT, so a change reaches their API
 *    permissions at their NEXT SIGN-IN. The confirm dialog says so; the toast repeats
 *    the server's message.
 */
export default function Users() {
  const { user: me } = useAuth();
  const { roles: referenceRoles } = useReference();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [changing, setChanging] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);

  const debouncedSearch = useDebouncedValue(search, 300);
  const filters = { q: debouncedSearch || undefined, role: role || undefined };

  const listQuery = useAdminUsers(filters);
  const updateRoleMutation = useUpdateRole();
  const createUserMutation = useCreateUser();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, role]);

  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const pageCount = Math.max(1, Math.ceil(rows.length / ADMIN_PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE),
    [rows, page]
  );

  /*
   * Role options for the picker: the reference table's rows when loaded, plus every
   * role actually present in the directory (so the picker works even before
   * reference/get.php has answered). Keyed by id, because update_role.php takes ids.
   */
  const roleOptions = useMemo(() => {
    const map = new Map();
    (referenceRoles || []).forEach((r) => {
      if (r?.id !== undefined && r?.role_name) map.set(Number(r.id), r.role_name);
    });
    rows.forEach((row) => {
      if (row.roleId && row.role) map.set(row.roleId, row.role);
    });
    return [...map.entries()]
      .map(([id, name]) => ({ value: String(id), label: roleLabel(name, referenceRoles) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [referenceRoles, rows]);

  const openChange = (row) => {
    setChanging(row);
    setSelectedRoleId(String(row.roleId));
  };

  const closeChange = () => {
    setChanging(null);
    setSelectedRoleId('');
  };

  const confirmChange = async () => {
    const roleId = Number(selectedRoleId);
    if (!changing || !roleId || roleId === changing.roleId) return;
    try {
      const result = await updateRoleMutation.mutateAsync({ userId: changing.id, roleId });
      toast.success(result?.message || 'Role updated.', {
        title: `${changing.name || 'User'} updated`,
      });
      closeChange();
    } catch (error) {
      toast.error(toUserMessage(error, 'The role could not be updated.'), {
        title: 'Action failed',
      });
    }
  };

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    const problem = validateCreateForm(createForm);
    if (problem) {
      toast.error(problem, { title: 'Check the form' });
      return;
    }
    try {
      const result = await createUserMutation.mutateAsync({
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        roleId: createForm.roleId ? Number(createForm.roleId) : undefined,
      });
      const created = result?.data;
      toast.success(
        created?.role
          ? `Signed in with email and password · role: ${roleLabel(created.role, referenceRoles)}`
          : (result?.message || 'User created.'),
        { title: `${created?.name || 'User'} created` }
      );
      closeCreate();
    } catch (error) {
      toast.error(toUserMessage(error, 'The account could not be created.'), {
        title: 'Action failed',
      });
    }
  };

  const roleBadgeTone = (name) => {
    if (name === 'admin') return 'danger';
    if (name === 'electric_company') return 'info';
    if (name === 'lineman') return 'warning';
    return 'neutral';
  };

  const renderRow = (row) => {
    const isSelf = me?.id === row.id;
    return (
      <TR key={row.id}>
        <TD>
          <span className="font-semibold text-navy-900">{row.name || 'Unnamed account'}</span>
          <p className="mt-0.5 text-xs text-navy-400">{row.email}</p>
        </TD>
        <TD>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={roleBadgeTone(row.role)}>{roleLabel(row.role, referenceRoles)}</Badge>
            {isSelf ? <Badge tone="navy">You</Badge> : null}
          </div>
        </TD>
        <TD className="text-sm text-navy-500">
          {row.authProvider === 'google' ? 'Google' : 'Email'}
        </TD>
        <TD className="whitespace-nowrap text-xs text-navy-500">{formatDateTime(row.createdAt)}</TD>
        <TD className="whitespace-nowrap text-xs text-navy-500">
          {row.lastLogin ? formatDateTime(row.lastLogin) : 'Never'}
        </TD>
        <TD align="right">
          {isSelf ? (
            <span className="text-xs text-navy-400">Your own role cannot be changed</span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              icon={UserCog}
              onClick={() => openChange(row)}
              aria-label={`Change role of ${row.name || row.email}`}
            >
              Change role
            </Button>
          )}
        </TD>
      </TR>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Every account on the platform. Granting or changing a role takes effect for that user at their next sign-in, because the role travels inside their session token."
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            Create user
          </Button>
        }
      />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Input
            label="Search"
            aria-label="Search users by name or email"
            placeholder="Name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            type="search"
          />
          <Select
            label="Role"
            aria-label="Filter users by role"
            options={roleOptions}
            placeholder="All roles"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setSearch('');
                setRole('');
                setPage(1);
              }}
              disabled={!search && !role}
            >
              Clear filters
            </Button>
          </div>
        </CardBody>
      </Card>

      <DataView
        isLoading={listQuery.isLoading}
        error={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        loadingLabel="Loading users…"
        items={pageRows}
        empty={{
          icon: UserIcon,
          title: 'No users found.',
          description:
            search || role
              ? 'No account matches those filters.'
              : 'Accounts appear here as people register.',
        }}
        renderCard={(row) => {
          const isSelf = me?.id === row.id;
          return (
            <RecordCard
              icon={ShieldCheck}
              iconTone={roleBadgeTone(row.role) === 'danger' ? 'danger' : 'primary'}
              title={row.name || 'Unnamed account'}
              subtitle={row.email}
              badges={[
                {
                  label: roleLabel(row.role, referenceRoles),
                  tone: roleBadgeTone(row.role),
                },
                ...(isSelf ? [{ label: 'You', tone: 'navy' }] : []),
              ]}
              meta={[
                { label: 'Provider', value: row.authProvider === 'google' ? 'Google' : 'Email' },
                { label: 'Joined', value: formatDateTime(row.createdAt) },
                { label: 'Last login', value: row.lastLogin ? formatDateTime(row.lastLogin) : 'Never' },
              ]}
              actions={
                isSelf ? (
                  <span className="text-xs text-navy-400">Your own role cannot be changed</span>
                ) : (
                  <Button size="sm" variant="outline" icon={UserCog} onClick={() => openChange(row)}>
                    Change role
                  </Button>
                )
              }
            />
          );
        }}
        renderTable={(visible) => (
          <div className="rounded-card border border-navy-100 bg-white shadow-card">
            <Table>
              <THead>
                <tr>
                  <TH>User</TH>
                  <TH>Role</TH>
                  <TH>Provider</TH>
                  <TH>Joined</TH>
                  <TH>Last login</TH>
                  <TH align="right">Actions</TH>
                </tr>
              </THead>
              <TBody>{visible.map((row) => renderRow(row))}</TBody>
            </Table>
            <Pagination
              page={page}
              pageCount={pageCount}
              total={rows.length}
              pageSize={ADMIN_PAGE_SIZE}
              onChange={setPage}
            />
          </div>
        )}
      />

      {rows.length > 0 ? (
        <p className="text-xs text-navy-400">
          {rows.length} account{rows.length === 1 ? '' : 's'}. The API re-checks every
          permission server-side - hiding this screen is a convenience, never the control.
        </p>
      ) : null}

      <Modal
        open={Boolean(changing)}
        onClose={closeChange}
        title="Change role"
        description={
          changing ? `${changing.name || 'This user'} · ${changing.email}` : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={closeChange} disabled={updateRoleMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirmChange}
              disabled={
                updateRoleMutation.isPending ||
                !selectedRoleId ||
                Number(selectedRoleId) === changing?.roleId
              }
            >
              {updateRoleMutation.isPending ? 'Saving…' : 'Change role'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="New role"
            aria-label="New role"
            options={roleOptions}
            value={selectedRoleId}
            onChange={(event) => setSelectedRoleId(event.target.value)}
            required
          />
          <p className="rounded-control bg-warning-50 p-3 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-200">
            The new role takes effect for this user at their next sign-in - their current
            session keeps the old permissions until then.
          </p>
        </div>
      </Modal>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Create user"
        description="Creates an email + password account. The person signs in themselves - no session is started for them here."
        footer={
          <>
            <Button variant="ghost" onClick={closeCreate} disabled={createUserMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitCreate}
              disabled={
                createUserMutation.isPending ||
                !createForm.firstName.trim() ||
                !createForm.lastName.trim() ||
                !createForm.email.trim() ||
                createForm.password.length < 6
              }
            >
              {createUserMutation.isPending ? 'Creating…' : 'Create user'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={submitCreate}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              required
              autoComplete="given-name"
              value={createForm.firstName}
              onChange={(event) =>
                setCreateForm((f) => ({ ...f, firstName: event.target.value }))
              }
            />
            <Input
              label="Last name"
              required
              autoComplete="family-name"
              value={createForm.lastName}
              onChange={(event) =>
                setCreateForm((f) => ({ ...f, lastName: event.target.value }))
              }
            />
          </div>
          <Input
            label="Email"
            type="email"
            required
            autoComplete="off"
            value={createForm.email}
            onChange={(event) => setCreateForm((f) => ({ ...f, email: event.target.value }))}
          />
          <Input
            label="Password"
            type="password"
            required
            hint="At least 6 characters. The person can change it later through the usual flow."
            autoComplete="new-password"
            value={createForm.password}
            onChange={(event) => setCreateForm((f) => ({ ...f, password: event.target.value }))}
          />
          <Select
            label="Role"
            aria-label="Role for the new user"
            options={roleOptions}
            placeholder="Community member (default)"
            value={createForm.roleId}
            onChange={(event) => setCreateForm((f) => ({ ...f, roleId: event.target.value }))}
          />
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>
    </div>
  );
}
