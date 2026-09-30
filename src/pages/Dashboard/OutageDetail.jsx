import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, History, MapPin, Pencil, Tag, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';
import AppMap, { MapPin as MapPinMarker } from '@/components/Map';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { outagesApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { isOwnedBy, readOutage, resolveImageUrl } from '@/utils/records';
import { severityTone, statusTone } from '@/utils/constants';
import { formatDateTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import OutageFormModal from './components/OutageFormModal';

/**
 * Outage report detail (`outage_report/get_detail.php?id=`).
 * The endpoint returns 403 for reports you do not own, so owner-only actions are
 * gated on the returned `user_id`.
 */
export default function OutageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: QUERY_KEYS.outage(id),
    queryFn: ({ signal }) => outagesApi.getDetail(id, { signal }),
    retry: 1,
  });

  const outage = detailQuery.data ? readOutage(detailQuery.data) : null;
  const owned = isOwnedBy(outage, user);

  const deleteMutation = useMutation({
    mutationFn: () => outagesApi.remove(id),
    onSuccess: () => {
      toast.success('Your report was cancelled.', { title: 'Cancelled' });
      queryClient.invalidateQueries({ queryKey: ['outages'] });
      navigate('/dashboard/outages', { replace: true });
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Outage report" />
        <Card>
          <LoadingState label="Loading report details…" />
        </Card>
      </div>
    );
  }

  // get_detail.php answers 403 when the report belongs to someone else.
  const forbidden = detailQuery.error?.status === 403;

  if (detailQuery.isError || !outage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Outage report"
          actions={
            <Button variant="outline" to="/dashboard/outages" icon={ArrowLeft}>
              Back to reports
            </Button>
          }
        />
        <ErrorState
          title={forbidden ? 'This report is not yours to open' : 'We could not load this report'}
          message={
            forbidden
              ? 'Only the person who reported an outage can open its full details.'
              : toUserMessage(detailQuery.error)
          }
          onRetry={forbidden ? undefined : () => detailQuery.refetch()}
        />
      </div>
    );
  }

  const hasLocation = Number.isFinite(outage.lat) && Number.isFinite(outage.lng);

  return (
    <div className="space-y-6">
      <PageHeader
        title={outage.locationName || outage.barangay || 'Outage report'}
        description={`${outage.reportKey ? `${outage.reportKey} · ` : ''}reported ${formatDateTime(outage.createdAt)}`}
        actions={
          <>
            <Button variant="outline" to="/dashboard/outages" icon={ArrowLeft}>
              Back
            </Button>
            {owned ? (
              <>
                <Button variant="outline" icon={Pencil} onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                <Button variant="ghost" icon={Trash2} className="text-danger-600" onClick={() => setDeleteOpen(true)}>
                  Cancel report
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              description={outage.description || 'No description was provided.'}
              action={owned ? <Badge tone="primary">Your report</Badge> : <Badge tone="neutral">Community report</Badge>}
            >
              Report summary
            </CardHeader>
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail
                  label="Status"
                  value={<Badge tone={statusTone(outage.status)}>{humanize(outage.status)}</Badge>}
                  icon={CheckCircle2}
                />
                <Detail
                  label="Severity"
                  value={<Badge tone={severityTone(outage.severity)}>{humanize(outage.severity)}</Badge>}
                  icon={Tag}
                />
                <Detail label="Category" value={humanize(outage.category, '—')} icon={Tag} />
                <Detail label="Barangay" value={outage.barangay || '—'} icon={MapPin} />
                <Detail label="Reported" value={formatDateTime(outage.createdAt)} icon={CalendarClock} />
                <Detail
                  label="Started"
                  value={outage.startedAt ? formatDateTime(outage.startedAt) : '—'}
                  icon={CalendarClock}
                />
                {Number.isFinite(outage.affectedHouses) ? (
                  <Detail label="Affected houses" value={outage.affectedHouses} icon={ClipboardList} />
                ) : null}
                {outage.hazardType && outage.hazardType !== 'none' ? (
                  <Detail label="Associated hazard" value={humanize(outage.hazardType)} icon={Tag} />
                ) : null}
              </dl>

              {outage.resolutionNote ? (
                <div className="mt-5 rounded-card border border-success-200 bg-success-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-success-700">
                    Resolution note
                  </p>
                  <p className="mt-1 text-sm text-navy-700">{outage.resolutionNote}</p>
                  {outage.resolvedAt ? (
                    <p className="mt-1 text-xs text-navy-500">Resolved {formatDateTime(outage.resolvedAt)}</p>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>

          {outage.updates.length ? (
            <Card>
              <CardHeader description="Progress recorded by the utility company.">Updates</CardHeader>
              <CardBody>
                <ol className="space-y-4">
                  {outage.updates.map((update) => (
                    <li key={update.id ?? update.update_message} className="flex gap-3">
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-100 text-navy-600">
                        <History className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm text-navy-800">{update.update_message}</p>
                        <p className="mt-0.5 text-xs text-navy-500">
                          {update.to_status ? `${humanize(update.to_status)} · ` : ''}
                          {formatDateTime(update.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          ) : null}

          {outage.verifications.length ? (
            <Card>
              <CardHeader>Verifications</CardHeader>
              <CardBody>
                <ul className="space-y-2">
                  {outage.verifications.map((verification) => (
                    <li
                      key={verification.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-navy-100 p-3"
                    >
                      <span className="text-sm text-navy-800">
                        {humanize(verification.verification_status)}
                        {verification.notes ? ` · ${verification.notes}` : ''}
                      </span>
                      <span className="text-xs text-navy-500">{formatDateTime(verification.verified_at)}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {outage.images.length ? (
            <Card>
              <CardHeader>Photos</CardHeader>
              <CardBody className="grid gap-3 sm:grid-cols-2">
                {outage.images.map((image) => (
                  <a
                    key={image}
                    href={resolveImageUrl(image)}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-card border border-navy-200 transition hover:border-primary-300"
                  >
                    <img
                      src={resolveImageUrl(image)}
                      alt={`Photo attached to outage report ${outage.reportKey || outage.id}`}
                      className="h-48 w-full bg-navy-100 object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader description={hasLocation ? 'Coordinates resolved from your location name' : 'No coordinates resolved'}>
              Location
            </CardHeader>
            <CardBody>
              {hasLocation ? (
                <div className="h-72 w-full overflow-hidden rounded-card border border-navy-200">
                  <AppMap center={{ lat: outage.lat, lng: outage.lng }} zoom={15} className="h-full w-full">
                    <MapPinMarker
                      position={{ lat: outage.lat, lng: outage.lng }}
                      tone={severityTone(outage.severity)}
                    >
                      <p className="font-bold text-navy-900">{outage.locationName || 'Reported location'}</p>
                      <p className="mt-1 text-navy-600">
                        {outage.lat.toFixed(5)}, {outage.lng.toFixed(5)}
                      </p>
                    </MapPinMarker>
                  </AppMap>
                </div>
              ) : (
                <p className="rounded-card border border-dashed border-navy-200 bg-canvas p-5 text-center text-sm text-navy-500">
                  PowerGuide could not resolve this location name into coordinates.
                </p>
              )}
            </CardBody>
          </Card>

          {!owned ? (
            <Card>
              <CardBody className="text-sm text-navy-600">
                <p className="font-bold text-navy-900">Read only</p>
                <p className="mt-1">
                  Editing and cancelling are only available to the person who reported an outage. You can
                  still see its status and updates here.
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody className="text-sm text-navy-600">
              <p className="font-bold text-navy-900">See related reports</p>
              <p className="mt-1">
                Browse other reports in your area or check the{' '}
                <Link to="/dashboard/heatmap" className="font-semibold text-primary-600 hover:text-primary-700">
                  outage heatmap
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <OutageFormModal open={editOpen} outage={outage} onClose={() => setEditOpen(false)} />

      <ConfirmDialog
        open={deleteOpen}
        title="Cancel this outage report?"
        description="Your report is withdrawn from the community feed. This cannot be undone."
        confirmLabel="Cancel report"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteMutation.mutateAsync();
        }}
      />
    </div>
  );
}

function Detail({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-3">
      {Icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-navy-50 text-navy-500">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-navy-400">{label}</dt>
        <dd className="mt-0.5 text-sm font-semibold text-navy-800">{value}</dd>
      </div>
    </div>
  );
}
