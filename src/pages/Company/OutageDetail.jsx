import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpDown,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Flag,
  MapPin,
  MessageSquarePlus,
  ShieldQuestion,
  User,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Input';
import { InfoNote } from '@/components/ui/Alert';
import { ErrorState, LoadingState } from '@/components/ui/States';
import AppMap, { FitPoints, MapLegend, MapPin as MapPinMarker } from '@/components/Map';
import { useToast } from '@/context/ToastContext';
import {
  companyOutagesApi,
  MANAGEABLE_STATUSES,
  VERIFICATION_STATUSES,
} from '@/api';
import { COMPANY_QUERY_KEYS, severityTone, statusTone } from '@/utils/constants';
import { readCompanyOutage, readOutageUpdate, readVerification, resolveImageUrl } from '@/utils/records';
import { formatDateTime, formatRelativeTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import { clearFieldError, collectErrors, hasErrors, validateRequired } from '@/utils/validators';
const VERIFICATION_TONE = { confirmed: 'success', not_confirmed: 'warning', false_report: 'danger' };

/**
 * Module OUT detail (FR-OUT-3, FR-OUT-4, FR-OUT-5, FR-OUT-6).
 *
 * `get_detail.php` returns the report plus three child collections - `images[]`,
 * `updates[]` and `verifications[]` - and lets staff open ANY report (the resident
 * app is limited to its own), so this page is reachable for every row in the list.
 *
 * The three write actions are deliberately separate, because the endpoints are:
 *   verify.php     records a verification AND moves the status to whatever
 *                  `verification_status` implies (confirmed -> verified,
 *                  false_report -> rejected, not_confirmed -> under_review)
 *   add_update.php appends a field note and optionally moves the status
 *   update_single.php  sets the status on its own
 */
export default function OutageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const detailQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.outage(id),
    queryFn: async ({ signal }) => companyOutagesApi.getDetail(id, { signal }),
    retry: 1,
  });

  const report = detailQuery.data ? readCompanyOutage(detailQuery.data) : null;
  const images = report?.images || [];
  const updates = (report?.updates || []).map(readOutageUpdate);
  const verifications = (report?.verifications || []).map(readVerification);

  // The status control lives in the page header, so its expanded panel is rendered
  // here rather than inside the header's action row.
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['company-outages'] });
    queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.summary });
  };

  if (detailQuery.isLoading) return <LoadingState label="Loading report…" />;
  if (detailQuery.isError) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorState
          message={toUserMessage(detailQuery.error, 'This report could not be loaded.')}
          onRetry={() => detailQuery.refetch()}
        />
      </div>
    );
  }
  if (!report) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorState message="This report no longer exists or was removed." />
      </div>
    );
  }

  const hasPoint = Number.isFinite(report.lat) && Number.isFinite(report.lng);

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        title={report.locationName || report.barangay || 'Outage report'}
        description={[report.reportKey, report.category && humanize(report.category)]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <StatusControl
            open={statusPanelOpen}
            onToggle={() => setStatusPanelOpen((open) => !open)}
          />
        }
      />

      {statusPanelOpen ? (
        <StatusPanel
          report={report}
          onCancel={() => setStatusPanelOpen(false)}
          onDone={(nextStatus) => {
            setStatusPanelOpen(false);
            toast.success(`Report moved to ${humanize(nextStatus)}.`, { title: 'Status updated' });
            refreshAll();
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {report.status ? (
          <Badge tone={statusTone(report.status)}>{humanize(report.status)}</Badge>
        ) : null}
        {report.severity ? (
          <Badge tone={severityTone(report.severity)}>{humanize(report.severity)}</Badge>
        ) : null}
        {report.hazardType ? <Badge tone="warning">{humanize(report.hazardType)}</Badge> : null}
        {report.isActive === 0 || report.isActive === '0' ? (
          <Badge tone="neutral">No longer active</Badge>
        ) : null}
        {verifications.some((item) => item.status === 'confirmed') ? (
          <Badge tone="info" icon={BadgeCheck}>
            Staff verified
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader description="What the resident reported.">Report</CardHeader>
            <CardBody className="space-y-4">
              <p className="whitespace-pre-line text-sm text-navy-700">
                {report.description || 'No description was provided.'}
              </p>

              {report.resolutionNote ? (
                <div className="rounded-control border border-success-200 bg-success-50 p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-success-700">
                    Resolution note
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-navy-700">{report.resolutionNote}</p>
                </div>
              ) : null}

              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Detail label="Barangay" value={report.barangay || 'Not recorded'} />
                <Detail label="Reporter" value={report.reporter} icon={User} />
                <Detail
                  label="Reported"
                  value={`${formatDateTime(report.createdAt)} (${formatRelativeTime(report.createdAt)})`}
                  icon={CalendarClock}
                />
                <Detail label="Outage started" value={formatDateTime(report.startedAt)} />
                <Detail label="Resolved" value={formatDateTime(report.resolvedAt)} />
                <Detail
                  label="Houses affected"
                  value={report.affectedHouses === null ? '—' : String(report.affectedHouses)}
                />
                <Detail label="Last updated" value={formatDateTime(report.updatedAt)} />
                <Detail
                  label="Coordinates"
                  value={
                    hasPoint
                      ? `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`
                      : 'No coordinates'
                  }
                  icon={MapPin}
                />
              </dl>
            </CardBody>
          </Card>

          {images.length ? (
            <Card>
              <CardHeader description="Photos attached by the resident.">
                Evidence ({images.length})
              </CardHeader>
              <CardBody>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((url, index) => (
                    <li key={url}>
                      <a
                        href={resolveImageUrl(url)}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-control border border-navy-100"
                      >
                        <img
                          src={resolveImageUrl(url)}
                          alt={`Outage evidence ${index + 1}`}
                          loading="lazy"
                          className="h-28 w-full bg-navy-50 object-cover"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader description="Staff notes recorded against this report.">
              Field updates ({updates.length})
            </CardHeader>
            <CardBody>
              {updates.length === 0 ? (
                <p className="text-sm text-navy-500">No field updates yet.</p>
              ) : (
                <ol className="space-y-3">
                  {updates.map((update) => (
                    <li key={update.id} className="rounded-control border border-navy-100 p-3.5">
                      <p className="text-sm text-navy-700">{update.message}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-navy-400">
                        <span>{formatDateTime(update.createdAt)}</span>
                        {update.toStatus ? (
                          <Badge tone={statusTone(update.toStatus)} size="sm">
                            {humanize(update.toStatus)}
                          </Badge>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader description="Verification history recorded by staff.">
              Verifications ({verifications.length})
            </CardHeader>
            <CardBody>
              {verifications.length === 0 ? (
                <p className="text-sm text-navy-500">
                  This report has not been verified by staff yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {[...verifications].reverse().map((item) => (
                    <li key={item.id} className="rounded-control border border-navy-100 p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={VERIFICATION_TONE[item.status] || 'neutral'}>
                          {humanize(item.status)}
                        </Badge>
                        <span className="text-xs text-navy-400">{formatDateTime(item.createdAt)}</span>
                      </div>
                      {item.notes ? <p className="mt-2 text-sm text-navy-700">{item.notes}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {hasPoint ? (
            <Card>
              <CardBody className="p-0">
                <div className="h-72 w-full overflow-hidden rounded-card">
                  <AppMap zoom={15} className="h-full w-full">
                    <FitPoints items={[{ lat: report.lat, lng: report.lng }]} />
                    <MapPinMarker
                      position={{ lat: report.lat, lng: report.lng }}
                      tone={report.severity ? severityTone(report.severity) : 'primary'}
                    >
                      <p className="font-bold text-navy-900">
                        {report.locationName || report.barangay || 'Outage report'}
                      </p>
                      {report.severity ? (
                        <p className="mt-1 text-xs text-navy-600">
                          Severity: {humanize(report.severity)}
                        </p>
                      ) : null}
                    </MapPinMarker>
                    <MapLegend
                      title="Severity"
                      items={[
                        { label: 'Critical / high', tone: 'danger' },
                        { label: 'Moderate', tone: 'warning' },
                        { label: 'Low / minor', tone: 'success' },
                      ]}
                    />
                  </AppMap>
                </div>
              </CardBody>
            </Card>
          ) : (
            <InfoNote>
              This report has no coordinates, so it cannot be plotted on the map. It was matched to{' '}
              {report.barangay || 'no barangay'} by address.
            </InfoNote>
          )}

          <VerifyCard reportId={report.id} onDone={refreshAll} />
          <FieldUpdateCard reportId={report.id} currentStatus={report.status} onDone={refreshAll} />

          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/company/outages')}>
            Back to all reports
          </Button>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/company/outages"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-600 transition hover:text-navy-900"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All outage reports
    </Link>
  );
}

function Detail({ label, value, icon: Icon }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-400">
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-navy-800">{value}</dd>
    </div>
  );
}

/** FR-OUT-6 - the header button that reveals `StatusPanel`. */
function StatusControl({ open, onToggle }) {
  return (
    <Button variant="primary" icon={ArrowUpDown} onClick={onToggle} aria-expanded={open}>
      Change status
    </Button>
  );
}

/** FR-OUT-6 - the status form itself, saved through `update_single.php`. */
function StatusPanel({ report, onCancel, onDone }) {
  const [nextStatus, setNextStatus] = useState('');

  useEffect(() => {
    setNextStatus('');
  }, [report.id]);

  const mutation = useMutation({
    mutationFn: (value) => companyOutagesApi.updateSingle({ id: report.id, status: value }),
    onSuccess: (_result, value) => onDone(value),
  });

  return (
    <Card>
      <CardHeader
        description={`Currently ${humanize(report.status, 'unset')}. These are the only statuses the API accepts.`}
      >
        Change report status
      </CardHeader>
      <CardBody className="space-y-3">
        <Select
          label="New status"
          required
          options={MANAGEABLE_STATUSES}
          placeholder="Select a status"
          value={nextStatus}
          onChange={(event) => setNextStatus(event.target.value)}
        />
        {mutation.isError ? (
          <p role="alert" className="text-sm font-medium text-danger-600">
            {toUserMessage(mutation.error)}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => mutation.mutate(nextStatus)}
            loading={mutation.isPending}
            disabled={!nextStatus || nextStatus === report.status}
          >
            Save status
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={mutation.isPending}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-navy-400">
          Marking a report resolved also stamps the resolution time and clears its active flag on
          the server.
        </p>
      </CardBody>
    </Card>
  );
}

/** FR-OUT-4 - record a verification. The server derives the new report status from it. */
function VerifyCard({ reportId, onDone }) {
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (value) => companyOutagesApi.verify(value),
    onSuccess: (_result, value) => {
      toast.success(
        `Recorded as ${humanize(value.verificationStatus)}. The report is now ${humanize(value.impliedStatus)}.`,
        { title: 'Verification saved' }
      );
      setStatus('');
      setNotes('');
      setErrors({});
      onDone();
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The verification could not be saved.'), { title: 'Save failed' });
    },
  });

  const submit = (event) => {
    event.preventDefault();
    const option = VERIFICATION_STATUSES.find((item) => item.value === status);
    mutation.mutate({
      outageReportId: reportId,
      verificationStatus: status,
      notes: notes.trim(),
      impliedStatus: option?.impliedStatus,
    });
  };

  return (
    <Card>
      <CardHeader description="Confirms or rejects the report and moves its status.">
        <span className="inline-flex items-center gap-2">
          <ShieldQuestion className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Verify report
        </span>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Select
            label="Verification"
            required
            options={VERIFICATION_STATUSES}
            placeholder="Choose a verdict"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setErrors((current) => clearFieldError(current, 'status'));
            }}
            error={errors.status}
            hint="Confirmed marks it verified, not confirmed sends it to review, a false report rejects it."
          />
          <Textarea
            label="Notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What did the field check find?"
          />
          <Button type="submit" size="sm" icon={CheckCircle2} loading={mutation.isPending} disabled={!status}>
            Save verification
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

/** FR-OUT-5 - append a field update, optionally moving the status at the same time. */
function FieldUpdateCard({ reportId, currentStatus, onDone }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState({});
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: (value) => companyOutagesApi.addUpdate(value),
    onSuccess: (_result, value) => {
      toast.success(
        value.status
          ? `Field update saved and the report moved to ${humanize(value.status)}.`
          : 'Field update saved.',
        { title: 'Update recorded' }
      );
      setMessage('');
      setStatus('');
      setErrors({});
      onDone();
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The field update could not be saved.'), { title: 'Save failed' });
    },
  });

  const submit = (event) => {
    event.preventDefault();
    const found = collectErrors({
      message: () => validateRequired(message.trim(), 'A field update message'),
    });
    if (hasErrors(found)) {
      setErrors(found);
      return;
    }
    mutation.mutate({ outageReportId: reportId, message: message.trim(), status: status || undefined });
  };

  return (
    <Card>
      <CardHeader description="Adds a note to the report's history.">
        <span className="inline-flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Add field update
        </span>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Textarea
            label="Update"
            required
            rows={3}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setErrors((current) => clearFieldError(current, 'message'));
            }}
            error={errors.message}
            placeholder="Crew dispatched, transformer isolated, estimated restoration…"
          />
          <Select
            label="Also change status"
            options={MANAGEABLE_STATUSES}
            placeholder="Leave the status unchanged"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            hint={
              currentStatus
                ? `The report is currently ${humanize(currentStatus)}. Leave blank to only add the note.`
                : 'Leave blank to only add the note.'
            }
          />
          <Button type="submit" size="sm" icon={Flag} loading={mutation.isPending} disabled={!message.trim()}>
            Record update
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
