import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, ExternalLink, Gift, Loader2, MapPin, RotateCcw, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SheetSelect from '@/components/ui/sheet-select';
import { formatStatus } from '@/utils/formatStatus';
import { assessSupplyAgainstClaim } from '@/lib/distributionCsv';
import { listAllChargers } from '@/lib/listAllChargers';
import { toast } from 'sonner';

const REJECTION_REASONS = [
  ['serial_not_visible', 'Serial number not visible'],
  ['serial_mismatch', 'Serial number does not match'],
  ['photo_missing_or_unclear', 'Installation photo missing or unclear'],
  ['duplicate_or_previously_claimed', 'Duplicate or previously claimed charger'],
  ['insufficient_evidence', 'Insufficient installation evidence'],
  ['other', 'Other reason'],
];

function reportingRangeLabel(range) {
  if (range === '7d') return 'Last 7 days';
  if (range === '30d') return 'Last 30 days';
  if (range === '90d') return 'Last 90 days';
  return 'All time';
}

function isInReportingRange(value, range) {
  if (range === 'all' || !value) return true;
  const days = Number.parseInt(range, 10);
  if (!Number.isFinite(days)) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(value) >= cutoff;
}

export default function AdminInstalls() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: identity, isLoading: loadingIdentity } = useInstaller();
  const [notes, setNotes] = useState({});
  const [reasons, setReasons] = useState({});
  const [pendingAction, setPendingAction] = useState(null);
  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['admin-install-claims'],
    enabled: identity?.user?.role === 'admin',
    queryFn: () => base44.entities.InstallClaim.list('-created_date', 250),
  });
  const { data: suppliedChargers = [] } = useQuery({
    queryKey: ['admin-chargers'],
    enabled: identity?.user?.role === 'admin',
    queryFn: listAllChargers,
  });
  const update = useMutation({
    mutationFn: async ({ id, data, chargerId }) => {
      const previousClaim = await base44.entities.InstallClaim.get(id);
      if (previousClaim?.status === 'approved' && ['submitted', 'rejected'].includes(data.status)) {
        const candidates = await base44.entities.Installer.filter({ user_email: previousClaim.installer_email });
        const candidate = candidates[0];
        if (candidate?.referral_qualified && candidate.referred_by_installer_id) {
          await base44.functions.invoke('admin-fraud-review', {
            scope: 'referral', target_id: candidate.id, action: 'hold',
            reason: `An installation previously counted toward an awarded referral has changed from approved to ${data.status}. Recheck the five-install milestone before any further voucher payment.`,
          });
        }
      }
      if (data.status === 'approved') {
        const candidate = await base44.entities.InstallClaim.get(id);
        if (!candidate.serial_photo_url || !candidate.install_photo_url) {
          throw new Error('Both installation photos are required before approval. Request further evidence first.');
        }
        const sameSerialClaims = await base44.entities.InstallClaim.filter({ serial_number: candidate.serial_number });
        if (sameSerialClaims.some((other) => other.id !== id && (other.status === 'approved' || ['approved', 'redemption_requested', 'issued'].includes(other.reward_status)))) {
          throw new Error('This serial number already has an approved or issued reward claim.');
        }
      }
      const result = await base44.entities.InstallClaim.update(id, data);
      if (chargerId && data.status === 'approved') {
        await base44.entities.Charger.update(chargerId, { claim_status: 'approved', install_claim_id: id });
      }
      if (data.status === 'approved' && !['held', 'rejected'].includes(data.reward_status)) {
        await base44.functions.invoke('manage-referral-reward-v2', { action: 'sync', claim_id: id });
      }
      if (chargerId && data.status === 'submitted') {
        // Moving an existing claim back to review must NOT make its charger claimable again.
        await base44.entities.Charger.update(chargerId, { claim_status: 'submitted', install_claim_id: id });
      }
      return result;
    },
    onMutate: async ({ id, action, data }) => {
      setPendingAction({ id, action });
      await queryClient.cancelQueries({ queryKey: ['admin-install-claims'] });
      const previous = queryClient.getQueryData(['admin-install-claims']);
      queryClient.setQueryData(['admin-install-claims'], (current = []) =>
        current.map((claim) => (claim.id === id ? { ...claim, ...data } : claim)),
      );
      return { previous };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-install-claims'] });
      await queryClient.invalidateQueries({ queryKey: ['install-claims'] });
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['admin-install-claims'], context.previous);
      toast.error(err.response?.data?.error || err.message || 'Could not update this claim.');
    },
    onSettled: () => setPendingAction(null),
  });

  if (loadingIdentity) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (identity?.user?.role !== 'admin') return (
    <div className="rounded-2xl border border-border bg-muted/60 p-8">
      <h1 className="text-xl font-semibold">FastAmps team access only</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your account does not have permission to review installation claims.</p>
    </div>
  );

  const chargersById = new Map(suppliedChargers.map((charger) => [charger.id, charger]));
  const selectedClaimId = searchParams.get('claim');
  const selectedStatus = searchParams.get('status') || 'all';
  const selectedRange = searchParams.get('range') || 'all';
  const allActiveClaims = claims.filter((claim) => !claim.excluded_from_reporting);
  const activeClaims = allActiveClaims.filter((claim) => isInReportingRange(claim.created_date, selectedRange));
  const pending = activeClaims.filter((claim) => ['submitted', 'needs_information'].includes(claim.status));
  const selectedClaim = selectedClaimId ? allActiveClaims.find((claim) => claim.id === selectedClaimId) : null;
  const visibleClaims = selectedClaimId
    ? (selectedClaim ? [selectedClaim] : [])
    : selectedStatus === 'pending'
      ? pending
      : selectedStatus === 'approved'
        ? activeClaims.filter((claim) => claim.status === 'approved')
        : activeClaims;
  const pageTitle = selectedClaim
    ? `Review install ${selectedClaim.serial_number}`
    : selectedStatus === 'pending'
      ? 'Pending installation reviews'
      : selectedStatus === 'approved'
        ? 'Approved installations'
        : 'Installation review';

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps team</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{pageTitle}</h1>
        <p className="mt-2 text-muted-foreground">{selectedClaim ? `${selectedClaim.installer_name} · ${selectedClaim.site_postcode}` : `${pending.length} claim${pending.length === 1 ? '' : 's'} waiting for a decision.`}</p>
        {!selectedClaim && selectedRange !== 'all' && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm">
            <span><strong>{reportingRangeLabel(selectedRange)}</strong> reporting period is applied to this list.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setSearchParams(selectedStatus === 'all' ? {} : { status: selectedStatus })}>
              Show all time
            </Button>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ['all', 'All claims'],
            ['pending', `Pending (${pending.length})`],
            ['approved', `Approved (${activeClaims.filter((claim) => claim.status === 'approved').length})`],
          ].map(([value, label]) => (
            <Button key={value} type="button" size="sm" variant={selectedStatus === value ? 'default' : 'outline'}
              onClick={() => {
                const nextParams = {};
                if (value !== 'all') nextParams.status = value;
                if (selectedRange !== 'all') nextParams.range = selectedRange;
                setSearchParams(nextParams);
              }}
              className={selectedStatus === value ? 'bg-primary text-white' : 'border-border bg-background'}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? <div className="text-sm text-muted-foreground">Loading claims…</div> : (
        <div className="space-y-4">
          {visibleClaims.map((claim) => (
            <article id={`claim-${claim.id}`} key={claim.id} className={`rounded-3xl border bg-muted/60 p-5 md:p-6 ${selectedClaimId === claim.id ? 'border-accent ring-2 ring-accent/20' : 'border-border'}`}>
              <div className="grid lg:grid-cols-[180px_1fr] gap-5">
                <div className="space-y-3">
                  {[
                    ['Physical serial number', claim.serial_photo_url, claim.serial_photo_latitude, claim.serial_photo_longitude, claim.serial_photo_location_source],
                    ['Complete installation', claim.install_photo_url, claim.install_photo_latitude, claim.install_photo_longitude, claim.install_photo_location_source],
                  ].map(([label, src, latitude, longitude, source]) => (
                    <div key={label}>
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
                      {src ? (
                        <a href={src} target="_blank" rel="noreferrer" className="group relative block">
                          <img src={src} alt={label} loading="lazy" decoding="async" width="720" height="520" className="w-full h-40 rounded-2xl object-contain border border-border bg-muted" />
                          <span className="absolute right-2 bottom-2 rounded-full bg-black/70 p-2 text-white"><ExternalLink className="w-4 h-4" /></span>
                        </a>
                      ) : (
                        <div className="flex min-h-24 items-center rounded-2xl border border-dashed border-amber-500/40 bg-amber-400/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                          Evidence not uploaded. Request further information before approval.
                        </div>
                      )}
                      {typeof latitude === 'number' && typeof longitude === 'number' && (
                        <a href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                          <MapPin className="w-3.5 h-3.5" />
                          {latitude.toFixed(5)}, {longitude.toFixed(5)}{source === 'device' ? ' · device GPS' : ' · from photo'}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{claim.product_model} · {claim.serial_number}</h2>
                        {claim.is_demo && <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-200">{claim.demo_label || 'BETA-DEMO'}</span>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{claim.installer_name} · {claim.installer_mobile} · {claim.installer_email}</p>
                    </div>
                    <div className="rounded-full bg-muted px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-accent">{claim.status.replace('_', ' ')}</div>
                  </div>
                  <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-foreground/80">
                    <span>PIN: {claim.pin_code}</span>
                    <span>Installed: {new Date(claim.install_date).toLocaleDateString('en-GB')}</span>
                    <span>Postcode: {claim.site_postcode}</span>
                    <span>Installer reported purchase: {[claim.wholesaler, claim.wholesaler_branch].filter(Boolean).join(' · ') || 'Not supplied'}</span>
                  </div>
                  {(() => {
                    const source = chargersById.get(claim.charger_record_id);
                    const comparison = assessSupplyAgainstClaim(source, claim);
                    return (
                      <div className="mt-3 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm">
                        <div className="font-semibold">FastAmps distribution record (optional)</div>
                        <div className="mt-1 text-xs text-muted-foreground">Supplied to: {source?.supplied_to_name_raw ? [source.supplied_to_name_raw, source.supplied_to_branch_raw].filter(Boolean).join(' · ') : 'Not recorded'}</div>
                        {source?.distribution_branch_id && <div className="mt-1 text-xs text-muted-foreground">Verified branch: {[source.distribution_wholesaler_name, source.distribution_branch_name].filter(Boolean).join(' · ')}</div>}
                        <div className={`mt-2 text-xs ${comparison.status === 'review' ? 'text-amber-700 dark:text-amber-300' : comparison.status === 'matched' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>{comparison.label}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">Different destinations can reflect stock transfers or naming differences. This comparison never automatically rejects a claim.</div>
                      </div>
                    );
                  })()}
                  {claim.rejection_reason && (
                    <p className="mt-3 text-xs text-destructive">Last rejection: {REJECTION_REASONS.find(([code]) => code === claim.rejection_reason)?.[1] || claim.rejection_reason}</p>
                  )}
                  <div className="mt-4">
                    <SheetSelect
                      id={`rejection-reason-${claim.id}`}
                      label="Rejection reason (required only for rejection)"
                      value={reasons[claim.id] || claim.rejection_reason || ''}
                      onChange={(next) => setReasons({ ...reasons, [claim.id]: next })}
                      placeholder="Select a reason"
                      options={[
                        { value: '', label: 'Select a reason' },
                        ...REJECTION_REASONS.map(([code, label]) => ({ value: code, label })),
                      ]}
                    />
                  </div>
                  <Input placeholder="Review note (required to request more information; optional for rejection)" value={notes[claim.id] ?? claim.review_note ?? ''}
                    onChange={(event) => setNotes({ ...notes, [claim.id]: event.target.value })}
                    className="mt-3 h-11 bg-background border-border" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(() => {
                      const busy = pendingAction?.id === claim.id;
                      return (
                        <>
                          {claim.status === 'approved' && (
                            <Button disabled={busy || ['issued', 'redemption_requested'].includes(claim.reward_status)} onClick={() => update.mutate({
                              id: claim.id,
                              action: 'unapprove',
                              chargerId: claim.charger_record_id,
                              data: { status: 'submitted', warranty_status: 'queued', reward_status: ['held', 'rejected'].includes(claim.reward_status) ? claim.reward_status : 'pending', review_note: notes[claim.id] || claim.review_note || '' },
                            })} variant="outline" className="border-border text-muted-foreground">
                              {busy && pendingAction.action === 'unapprove'
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reverting…</>
                                : <><RotateCcw className="w-4 h-4 mr-2" />Move back to pending</>}
                            </Button>
                          )}
                          {claim.status !== 'approved' && (
                            <Button disabled={busy || !claim.serial_photo_url || !claim.install_photo_url} onClick={() => update.mutate({
                              id: claim.id,
                              action: 'approve',
                              chargerId: claim.charger_record_id,
                              data: { status: 'approved', warranty_status: 'registered', reward_status: ['held', 'rejected'].includes(claim.reward_status) ? claim.reward_status : 'approved', review_note: notes[claim.id] || '', reviewed_by_name: identity.user.full_name || identity.user.email, reviewed_by_email: identity.user.email, reviewed_at: new Date().toISOString() },
                            })} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                              {busy && pendingAction.action === 'approve'
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Approving…</>
                                : <><CheckCircle2 className="w-4 h-4 mr-2" />Approve + register warranty</>}
                            </Button>
                          )}
                          <Button disabled={busy || !(notes[claim.id] || claim.review_note || '').trim()} onClick={() => update.mutate({
                            id: claim.id,
                            action: 'info',
                            data: {
                              status: 'needs_information',
                              review_note: (notes[claim.id] || claim.review_note || '').trim(),
                              information_request_count: (claim.information_request_count || 0) + 1,
                              reviewed_by_name: identity.user.full_name || identity.user.email,
                              reviewed_by_email: identity.user.email,
                              reviewed_at: new Date().toISOString(),
                            },
                          })} variant="outline" className="border-amber-400/40 text-amber-700 dark:text-amber-200">
                            {busy && pendingAction.action === 'info'
                              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                              : <><TriangleAlert className="w-4 h-4 mr-2" />Needs information</>}
                          </Button>
                          {claim.status !== 'approved' && (
                            <Button disabled={busy || !(reasons[claim.id] || claim.rejection_reason)} onClick={() => update.mutate({
                              id: claim.id,
                              action: 'reject',
                              chargerId: claim.charger_record_id,
                              data: {
                                status: 'rejected',
                                warranty_status: 'declined',
                                reward_status: 'rejected',
                                rejection_reason: reasons[claim.id] || claim.rejection_reason,
                                review_note: (notes[claim.id] || claim.review_note || '').trim(),
                                reviewed_by_name: identity.user.full_name || identity.user.email,
                                reviewed_by_email: identity.user.email,
                                reviewed_at: new Date().toISOString(),
                              },
                            })} variant="outline" className="border-destructive/35 text-destructive">
                              {busy && pendingAction.action === 'reject'
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rejecting…</>
                                : <><XCircle className="w-4 h-4 mr-2" />Reject claim</>}
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground/80">
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Warranty {claim.warranty_status}</span>
                    <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5" />Reward {formatStatus(claim.reward_status)}</span>
                    <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />Submitted {new Date(claim.created_date).toLocaleDateString('en-GB')}</span>
                    {claim.reviewed_by_name && <span>Last reviewed by {claim.reviewed_by_name}{claim.reviewed_at ? ` on ${new Date(claim.reviewed_at).toLocaleString('en-GB')}` : ''}</span>}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {visibleClaims.length === 0 && <div className="rounded-2xl border border-border bg-muted/60 p-8 text-center text-sm text-muted-foreground">{selectedClaimId ? 'This installation claim could not be found or is no longer active.' : 'No installation claims match this view.'}</div>}
        </div>
      )}
    </div>
  );
}