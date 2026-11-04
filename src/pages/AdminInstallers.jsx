import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, Download, Info, Mail, MapPin, Search, ShieldCheck, Store, UserRound, Users, Wrench } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { calculateInstallerStatus } from '@/lib/installerScore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SheetSelect from '@/components/ui/sheet-select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import InstallerDocumentsList from '@/components/InstallerDocumentsList';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TIERS = ['New', 'Verified', 'Trusted', 'FastAmps Elite'];

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'FA';
const date = (value) => value ? new Date(value).toLocaleDateString('en-GB') : 'Not recorded';
const rangeLabel = (range) => range === '7d' ? 'last 7 days' : range === '30d' ? 'last 30 days' : range === '90d' ? 'last 90 days' : 'all time';
const inReportingRange = (value, range) => {
  if (!range || range === 'all') return true;
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const recordDate = value ? new Date(value) : null;
  return Boolean(recordDate && !Number.isNaN(recordDate.getTime()) && recordDate >= start);
};
async function copyText(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through for mobile browsers that expose but block Clipboard API.
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.left = '-9999px';
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(field);
  }
  return copied;
}

const tierTone = {
  New: 'bg-slate-500/15 text-slate-700 dark:text-slate-200',
  Verified: 'bg-sky-500/15 text-sky-700 dark:text-sky-200',
  Trusted: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200',
  'FastAmps Elite': 'bg-violet-500/15 text-violet-700 dark:text-violet-200',
};

export default function AdminInstallers() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activityFilter = searchParams.get('activity') || 'all';
  const rangeFilter = searchParams.get('range') || 'all';
  const { data: identity, isLoading: loadingIdentity } = useInstaller();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('all');
  const [sort, setSort] = useState('recent');
  const [copiedReferralId, setCopiedReferralId] = useState(null);
  const [trainingDraft, setTrainingDraft] = useState({ hqCompleted: false, certificatesReceived: false });
  const [statusDraft, setStatusDraft] = useState('New');
  const [statusReason, setStatusReason] = useState('');

  const { data: installers = [], isLoading: loadingInstallers } = useQuery({
    queryKey: ['admin-installer-directory'],
    enabled: identity?.user?.role === 'admin',
    queryFn: () => base44.entities.Installer.list('-created_date', 500),
  });
  const { data: claims = [], isLoading: loadingClaims } = useQuery({
    queryKey: ['admin-installer-directory-claims'],
    enabled: identity?.user?.role === 'admin',
    queryFn: () => base44.entities.InstallClaim.list('-created_date', 1000),
  });

  const rows = useMemo(() => installers
    .filter((installer) => !installer.excluded_from_reporting)
    .map((installer) => {
      const installerClaims = claims.filter((claim) => !claim.excluded_from_reporting && claim.installer_email?.toLowerCase() === installer.user_email?.toLowerCase());
      const programme = calculateInstallerStatus(installerClaims, installer.training_progress);
      const approved = installerClaims.filter((claim) => claim.status === 'approved');
      const reviewed = installerClaims.filter((claim) => ['approved', 'rejected', 'needs_information'].includes(claim.status));
      const approvalRate = reviewed.length ? Math.round((approved.length / reviewed.length) * 100) : null;
      const lastActivity = installerClaims[0]?.created_date || installer.updated_date || installer.created_date;
      const automaticStatus = programme.status;
      const effectiveTier = installer.tier_override_reason ? installer.tier : automaticStatus;
      return { installer, claims: installerClaims, programme: { ...programme, automaticStatus, status: effectiveTier }, approved, reviewed, approvalRate, lastActivity };
    }), [installers, claims]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = rows.map((row) => ({
      ...row,
      reportingApproved: row.approved.filter((claim) => inReportingRange(claim.created_date, rangeFilter)),
    })).filter(({ installer, programme, reportingApproved }) => {
      const haystack = [installer.full_name, installer.user_email, installer.mobile, installer.business_name, installer.region, installer.nominated_wholesaler, installer.nominated_branch, installer.referral_code, installer.referred_by_name, installer.referred_by_email].filter(Boolean).join(' ').toLowerCase();
      const matchesActivity = activityFilter === 'active'
        ? reportingApproved.length >= 1
        : activityFilter === 'repeat'
          ? reportingApproved.length >= 2
          : inReportingRange(installer.created_date, rangeFilter);
      return (!needle || haystack.includes(needle)) && (tier === 'all' || programme.status === tier) && matchesActivity;
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'approved') return b.reportingApproved.length - a.reportingApproved.length;
      if (sort === 'approval') return (b.approvalRate ?? -1) - (a.approvalRate ?? -1);
      if (sort === 'name') return (a.installer.full_name || '').localeCompare(b.installer.full_name || '');
      return new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0);
    });
  }, [rows, search, tier, sort, activityFilter, rangeFilter]);

  const selectedReferrals = useMemo(() => {
    if (!selected?.installer) return [];
    return rows.filter(({ installer }) =>
      installer.referred_by_installer_id === selected.installer.id
      || (selected.installer.referral_code && installer.referred_by_code === selected.installer.referral_code)
    );
  }, [rows, selected]);

  const updateTrainingVerification = useMutation({
    mutationFn: async ({ row, hqCompleted, certificatesReceived }) => {
      const now = new Date().toISOString();
      const updates = {
        hq_training_completed: hqCompleted,
        certificates_received: certificatesReceived,
        ...(hqCompleted && !row.installer.hq_training_completed ? { hq_training_completed_at: now } : {}),
        ...(certificatesReceived && !row.installer.certificates_received ? { certificates_received_at: now } : {}),
        training_progress: hqCompleted || certificatesReceived ? 100 : 0,
        training_verification_updated_by: identity.user.email,
        training_verification_updated_at: now,
      };
      await base44.entities.Installer.update(row.installer.id, updates);
      return updates;
    },
    onMutate: async ({ row, hqCompleted, certificatesReceived }) => {
      const optimistic = {
        hq_training_completed: hqCompleted,
        certificates_received: certificatesReceived,
        training_progress: hqCompleted || certificatesReceived ? 100 : 0,
      };
      setSelected((current) => current ? {
        ...current,
        installer: { ...current.installer, ...optimistic },
      } : current);
      setTrainingDraft({ hqCompleted, certificatesReceived });
      await queryClient.cancelQueries({ queryKey: ['admin-installer-directory'] });
      const previous = queryClient.getQueryData(['admin-installer-directory']);
      queryClient.setQueryData(['admin-installer-directory'], (current = []) =>
        current.map((installer) => (installer.id === row.installer.id ? { ...installer, ...optimistic } : installer)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['admin-installer-directory'], context.previous);
    },
    onSuccess: async (updates) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-installer-directory'] });
      setSelected((current) => current ? {
        ...current,
        installer: { ...current.installer, ...updates },
      } : current);
      setTrainingDraft({
        hqCompleted: Boolean(updates.hq_training_completed),
        certificatesReceived: Boolean(updates.certificates_received),
      });
    },
  });

  useEffect(() => {
    if (!selected?.installer) return;
    setTrainingDraft({
      hqCompleted: Boolean(selected.installer.hq_training_completed),
      certificatesReceived: Boolean(selected.installer.certificates_received),
    });
    setStatusDraft(selected.programme.status);
    setStatusReason(selected.installer.tier_override_reason || '');
    updateTrainingVerification.reset();
  }, [selected?.installer?.id]);

  const overrideTier = useMutation({
    mutationFn: async ({ row, nextTier, reason, clear }) => {
      const updates = {
        tier: clear ? row.programme.automaticStatus : nextTier,
        tier_override_reason: clear ? '' : reason,
        tier_overridden_by: identity.user.email,
        tier_overridden_at: new Date().toISOString(),
      };
      await base44.entities.Installer.update(row.installer.id, updates);
      return updates;
    },
    onMutate: async ({ row, nextTier, reason, clear }) => {
      const nextStatus = clear ? row.programme.automaticStatus : nextTier;
      const optimistic = {
        tier: nextStatus,
        tier_override_reason: clear ? '' : reason,
      };
      setSelected((current) => current ? {
        ...current,
        installer: { ...current.installer, ...optimistic },
        programme: { ...current.programme, status: nextStatus },
      } : current);
      setStatusDraft(nextStatus);
      setStatusReason(clear ? '' : reason);
      await queryClient.cancelQueries({ queryKey: ['admin-installer-directory'] });
      const previous = queryClient.getQueryData(['admin-installer-directory']);
      queryClient.setQueryData(['admin-installer-directory'], (current = []) =>
        current.map((installer) => (installer.id === row.installer.id ? { ...installer, ...optimistic } : installer)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['admin-installer-directory'], context.previous);
    },
    onSuccess: async (updates, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-installer-directory'] });
      const nextStatus = variables.clear ? variables.row.programme.automaticStatus : variables.nextTier;
      setSelected((current) => current ? {
        ...current,
        installer: { ...current.installer, ...updates },
        programme: { ...current.programme, status: nextStatus },
      } : current);
      setStatusDraft(nextStatus);
      setStatusReason(variables.clear ? '' : variables.reason);
    },
  });

  const saveStatusOverride = () => {
    const reason = statusReason.trim();
    const existingReason = String(selected?.installer.tier_override_reason || '').trim();
    if (!selected || !reason || (statusDraft === selected.programme.status && reason === existingReason)) return;
    overrideTier.mutate({ row: selected, nextTier: statusDraft, reason, clear: false });
  };

  const useAutomaticStatus = () => {
    if (!selected?.installer.tier_override_reason) return;
    overrideTier.mutate({ row: selected, nextTier: selected.programme.automaticStatus, reason: '', clear: true });
  };

  const exportCsv = () => {
    const headers = ['Name', 'Email', 'Mobile', 'Business', 'Region', 'Wholesaler', 'Branch', 'Referral code', 'Referred by', 'People referred', 'Qualified referrals', 'Available £20 referral credits', 'Issued £20 referral credits', 'Programme status', 'FastAmps quality score', 'Approved installs', 'Reviewed claims', 'Approval rate', 'Training verified', 'HQ training completed', 'Certificates received', 'Training checked by', 'Training checked at', 'Last activity', 'Demo'];
    const values = visibleRows.map(({ installer, programme, approved, reviewed, approvalRate, lastActivity }) => [
      installer.full_name, installer.user_email, installer.mobile, installer.business_name, installer.region,
      installer.nominated_wholesaler, installer.nominated_branch, installer.referral_code, installer.referred_by_name || installer.referred_by_email, installer.referrals || 0, installer.qualified_referrals || 0, installer.referral_discounts_available || 0, installer.referral_discounts_redeemed || 0, programme.status, programme.score ?? '', approved.length, reviewed.length,
      approvalRate == null ? '' : approvalRate + '%',
      installer.hq_training_completed || installer.certificates_received ? 'Yes' : 'No',
      installer.hq_training_completed ? 'Yes' : 'No',
      installer.certificates_received ? 'Yes' : 'No',
      installer.training_verification_updated_by,
      date(installer.training_verification_updated_at),
      date(lastActivity),
      installer.is_demo ? 'BETA-DEMO' : '',
    ]);
    const csv = [headers, ...values].map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `fastamps-installers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loadingIdentity) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (identity?.user?.role !== 'admin') return (
    <div className="rounded-2xl border border-border bg-muted/60 p-8">
      <h1 className="text-xl font-semibold">FastAmps team access only</h1>
      <p className="mt-2 text-sm text-muted-foreground">Installer programme records are available only to administrators.</p>
    </div>
  );

  const loading = loadingInstallers || loadingClaims;
  const trainingChanged = Boolean(selected) && (
    trainingDraft.hqCompleted !== Boolean(selected.installer.hq_training_completed)
    || trainingDraft.certificatesReceived !== Boolean(selected.installer.certificates_received)
  );
  const statusOverrideChanged = Boolean(selected) && (
    statusDraft !== selected.programme.status
    || statusReason.trim() !== String(selected.installer.tier_override_reason || '').trim()
  );

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps team</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Installers</h1>
          <p className="mt-2 text-muted-foreground">Track participation and programme progress. This is private operational oversight, not a public ranking.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!visibleRows.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </div>

      {(activityFilter !== 'all' || rangeFilter !== 'all') && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] p-4">
          <div>
            <div className="text-sm font-semibold">{activityFilter === 'repeat' ? 'Repeat installers' : activityFilter === 'active' ? 'Active installers' : 'Installer registrations'}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {activityFilter === 'repeat'
                ? `Showing installers with two or more approved installations in the ${rangeLabel(rangeFilter)}.`
                : activityFilter === 'active'
                  ? `Showing installers with at least one approved installation in the ${rangeLabel(rangeFilter)}.`
                  : `Showing registrations from the ${rangeLabel(rangeFilter)}.`}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setSearchParams({})}>Show all installers</Button>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TIERS.map((name) => (
          <button key={name} onClick={() => setTier(tier === name ? 'all' : name)} className={`rounded-2xl border p-4 text-left transition-colors ${tier === name ? 'border-accent bg-accent/10' : 'border-border bg-muted/60 hover:border-accent/40'}`}>
            <div className="text-2xl font-semibold">{rows.filter((row) => row.programme.status === name).length}</div>
            <div className="mt-1 text-xs text-muted-foreground">{name}</div>
          </button>
        ))}
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-muted/40 p-4 md:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, business, email, region or wholesaler" className="h-11 bg-background pl-10" />
        </label>
        <SheetSelect
          aria-label="Filter by status"
          value={tier}
          onChange={setTier}
          options={[
            { value: 'all', label: 'All statuses' },
            ...TIERS.map((name) => ({ value: name, label: name })),
          ]}
        />
        <SheetSelect
          aria-label="Sort installers"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: 'Most recent activity' },
            { value: 'approved', label: 'Most approved installs' },
            { value: 'approval', label: 'Highest approval rate' },
            { value: 'name', label: 'Name A–Z' },
          ]}
        />
      </section>

      {loading ? <div className="text-sm text-muted-foreground">Loading installer records…</div> : (
        <div className="overflow-hidden rounded-2xl border border-border bg-muted/50">
          {visibleRows.map((row) => {
            const { installer, programme, approved, reportingApproved, approvalRate, lastActivity } = row;
            const displayedApproved = rangeFilter === 'all' ? approved.length : reportingApproved.length;
            return (
              <button key={installer.id} onClick={() => setSelected(row)} className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left last:border-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-5">
                <Avatar className="h-12 w-12 border border-border">
                  <AvatarImage src={installer.avatar_url} alt={installer.full_name || 'Installer'} />
                  <AvatarFallback>{initials(installer.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{installer.full_name || installer.user_email}</span>
                    {installer.is_demo && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-200">{installer.demo_label || 'BETA-DEMO'}</span>}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{installer.business_name || 'Independent installer'} · {installer.region || 'Region not supplied'}</div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-semibold">{displayedApproved} approved{rangeFilter === 'all' ? '' : ' in period'}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{approvalRate == null ? 'No reviewed claims' : `${approvalRate}% approval`} · {date(lastActivity)}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tierTone[programme.status]}`}>{programme.status}</span>
              </button>
            );
          })}
          {!visibleRows.length && <div className="px-5 py-10 text-center text-sm text-muted-foreground">No installers match these filters.</div>}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl p-0">
            <div className="p-6 sm:p-8">
              <DialogHeader className="pr-8">
                <div className="flex items-center gap-4 text-left">
                  <Avatar className="h-16 w-16 border border-border">
                    <AvatarImage src={selected.installer.avatar_url} alt={selected.installer.full_name || 'Installer'} />
                    <AvatarFallback className="text-lg">{initials(selected.installer.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="flex flex-wrap items-center gap-2 text-2xl">
                      {selected.installer.full_name || selected.installer.user_email}
                      {selected.installer.is_demo && <span className="rounded-full bg-sky-500/15 px-2 py-1 text-[9px] uppercase tracking-wider text-sky-700 dark:text-sky-200">BETA-DEMO</span>}
                    </DialogTitle>
                    <DialogDescription className="mt-1">{selected.installer.business_name || 'Independent installer'} · Joined {date(selected.installer.created_date)}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ['Quality score', selected.programme.score == null ? '—' : selected.programme.score + '/100'],
                  ['Approved', selected.approved.length],
                  ['All claims', selected.claims.length],
                  ['Approval rate', selected.approvalRate == null ? '—' : selected.approvalRate + '%'],
                  ['Training', selected.installer.hq_training_completed || selected.installer.certificates_received ? 'Verified' : 'Not verified'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border bg-muted/60 p-3">
                    {label === 'Quality score' ? (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="w-full cursor-help text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md" aria-label="Show FastAmps Quality Score breakdown">
                              <div className="flex items-center gap-1.5 text-xl font-semibold">{value}<Info className="h-3.5 w-3.5 text-accent" /></div>
                              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">FastAmps Quality Score</div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" className="w-72 border border-border bg-popover p-4 text-popover-foreground shadow-xl">
                            <div className="font-semibold">How the score is calculated</div>
                            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Internal quality indicator. It is not a public ranking.</p>
                            {selected.programme.scoreBreakdown ? (
                              <div className="mt-3 space-y-2.5">
                                {[
                                  ['Claim quality', selected.programme.scoreBreakdown.claimQuality, '60%'],
                                  ['Integrity', selected.programme.scoreBreakdown.integrity, '20%'],
                                  ['Experience', selected.programme.scoreBreakdown.experience, '10%'],
                                  ['Training', selected.programme.scoreBreakdown.training, '10%'],
                                ].map(([part, partValue, weight]) => (
                                  <div key={part}>
                                    <div className="flex justify-between gap-3 text-[11px]"><span>{part} · {weight}</span><strong>{partValue}/100</strong></div>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${partValue}%` }} /></div>
                                  </div>
                                ))}
                                <p className="border-t border-border pt-2 text-[10px] leading-4 text-muted-foreground">Claim quality rewards first-time approvals. Integrity is reduced by rejections. Experience grows across the first 15 approved installs. Training is verified through HQ training or received certificates.</p>
                              </div>
                            ) : (
                              <p className="mt-3 text-xs text-muted-foreground">A score appears after the first claim has been reviewed.</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <>
                        <div className="text-xl font-semibold">{value}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <InstallerDocumentsList
                documents={selected.installer.approval_documents}
                names={selected.installer.approval_document_names}
              />

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <section className="rounded-2xl border border-border p-4">
                  <h3 className="font-semibold">Account and contact</h3>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-all">{selected.installer.user_email}</span></div>
                    <div className="flex gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0" /><span>{selected.installer.mobile || 'Mobile not supplied'}</span></div>
                    <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{selected.installer.region || 'Region not supplied'}</span></div>
                    <div className="flex gap-2"><Store className="mt-0.5 h-4 w-4 shrink-0" /><span>{selected.installer.nominated_wholesaler || 'Wholesaler not nominated'}{selected.installer.nominated_branch ? ` · ${selected.installer.nominated_branch}` : ''}</span></div>
                    <div className="rounded-xl border border-border bg-muted/50 p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-medium text-foreground">Referral code:</span>{' '}
                          <span className="font-mono font-semibold tracking-wide text-foreground">{selected.installer.referral_code || 'Not assigned'}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!selected.installer.referral_code}
                          onClick={async () => {
                            const copied = await copyText(selected.installer.referral_code);
                            if (copied) {
                              setCopiedReferralId(selected.installer.id);
                              window.setTimeout(() => setCopiedReferralId(null), 2000);
                            }
                          }}
                          className="gap-1.5"
                        >
                          {copiedReferralId === selected.installer.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedReferralId === selected.installer.id ? 'Copied' : 'Copy code'}
                        </Button>
                      </div>
                      <div className="mt-1"><span className="font-medium text-foreground">Referred by:</span> {selected.installer.referred_by_name || selected.installer.referred_by_email || 'Not referred'}</div>
                      <div className="mt-1"><span className="font-medium text-foreground">People registered with this code:</span> {selectedReferrals.length}</div>
                    </div>
                  </div>
                </section>
                <section className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Programme status</h3>
                    <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tierTone[selected.programme.status]}`}>{selected.programme.status}</div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Automatically calculated from approved work, claim quality and verified training.</p>

                  <div className="mt-4 space-y-2">
                    {[
                      ['New', 'Registered; first approved installation still pending.', true],
                      ['Verified', 'At least 1 approved installation.', selected.approved.length >= 1],
                      ['Trusted', 'At least 5 approved installations with no rejected claims.', selected.approved.length >= 5 && !selected.claims.some((claim) => claim.status === 'rejected')],
                      ['FastAmps Elite', 'At least 15 approved installations, 90%+ approval and verified training.', selected.approved.length >= 15 && (selected.approvalRate || 0) >= 90 && (selected.installer.hq_training_completed || selected.installer.certificates_received)],
                    ].map(([name, requirement, reached]) => (
                      <div key={name} className={`rounded-xl border p-3 ${selected.programme.status === name ? 'border-accent bg-accent/[0.07]' : 'border-border bg-muted/30'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{name}</span>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${reached ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>{reached ? 'Criteria met' : 'Not yet'}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{requirement}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-border bg-muted/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="installer-status-override" className="text-xs font-semibold">Manual admin override</label>
                      <span className="text-[10px] text-muted-foreground">Automatic: {selected.programme.automaticStatus}</span>
                    </div>
                    <SheetSelect
                      id="installer-status-override"
                      className="mt-2"
                      value={statusDraft}
                      onChange={(next) => {
                        overrideTier.reset();
                        setStatusDraft(next);
                      }}
                      disabled={overrideTier.isPending}
                      options={TIERS.map((name) => ({ value: name, label: name }))}
                    />
                    <label htmlFor="installer-status-reason" className="mt-3 block text-xs font-medium">Internal reason for override</label>
                    <Input
                      id="installer-status-reason"
                      value={statusReason}
                      onChange={(event) => {
                        overrideTier.reset();
                        setStatusReason(event.target.value);
                      }}
                      placeholder="For example: approved by FastAmps after manual review"
                      className="mt-2 h-10 bg-background"
                    />
                    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">This reason is stored in the FastAmps audit record. It is not sent to or shown to the installer.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveStatusOverride}
                        disabled={overrideTier.isPending || !statusReason.trim() || !statusOverrideChanged}
                        className="bg-primary text-white"
                      >
                        {overrideTier.isPending ? 'Saving…' : overrideTier.isSuccess ? 'Saved' : 'Save status override'}
                      </Button>
                      {selected.installer.tier_override_reason && (
                        <Button type="button" size="sm" variant="outline" onClick={useAutomaticStatus} disabled={overrideTier.isPending}>Use automatic status</Button>
                      )}
                    </div>
                    {statusOverrideChanged && <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">Unsaved status changes</p>}
                    {overrideTier.isError && <p className="mt-2 text-[11px] font-medium text-red-500">The status override could not be saved.</p>}
                  </div>
                </section>
              </div>

              <section className="mt-5 rounded-2xl border border-border p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-accent" />
                    <div>
                      <h3 className="font-semibold">Training verification</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">For V1, either accepted route verifies the installer's training.</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.installer.hq_training_completed || selected.installer.certificates_received ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                    {selected.installer.hq_training_completed || selected.installer.certificates_received ? 'Training verified' : 'Not yet verified'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
                    <input
                      type="checkbox"
                      checked={trainingDraft.hqCompleted}
                      disabled={updateTrainingVerification.isPending}
                      onChange={(event) => {
                        updateTrainingVerification.reset();
                        setTrainingDraft((current) => ({ ...current, hqCompleted: event.target.checked }));
                      }}
                      className="mt-1 h-4 w-4 accent-blue-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold">Full training completed at HQ</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {selected.installer.hq_training_completed && selected.installer.hq_training_completed_at ? `Confirmed ${date(selected.installer.hq_training_completed_at)}` : 'FastAmps has confirmed in-person training.'}
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
                    <input
                      type="checkbox"
                      checked={trainingDraft.certificatesReceived}
                      disabled={updateTrainingVerification.isPending}
                      onChange={(event) => {
                        updateTrainingVerification.reset();
                        setTrainingDraft((current) => ({ ...current, certificatesReceived: event.target.checked }));
                      }}
                      className="mt-1 h-4 w-4 accent-blue-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold">Certificates received</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {selected.installer.certificates_received && selected.installer.certificates_received_at ? `Confirmed ${date(selected.installer.certificates_received_at)}` : 'FastAmps has received the required certificates.'}
                      </span>
                    </span>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => updateTrainingVerification.mutate({
                      row: selected,
                      hqCompleted: trainingDraft.hqCompleted,
                      certificatesReceived: trainingDraft.certificatesReceived,
                    })}
                    disabled={updateTrainingVerification.isPending || !trainingChanged}
                    className={`font-semibold text-white ${updateTrainingVerification.isSuccess && !trainingChanged ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-primary hover:bg-primary/85'}`}
                  >
                    {updateTrainingVerification.isPending ? 'Saving…' : updateTrainingVerification.isSuccess && !trainingChanged ? 'Saved' : 'Save training verification'}
                  </Button>
                  {trainingChanged && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Unsaved changes</span>}
                  {updateTrainingVerification.isSuccess && !trainingChanged && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Training verification saved.</span>}
                </div>
                {updateTrainingVerification.isError && (
                  <p className="mt-3 text-xs font-medium text-red-500" role="alert">Training verification could not be saved. Please try again.</p>
                )}
                {selected.installer.training_verification_updated_by && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last updated by {selected.installer.training_verification_updated_by} on {date(selected.installer.training_verification_updated_at)}.
                  </p>
                )}
              </section>

              <section className="mt-5 rounded-2xl border border-border p-4 sm:p-5">
                <div className="flex items-start gap-2">
                  <Users className="mt-0.5 h-5 w-5 text-accent" />
                  <div>
                    <h3 className="font-semibold">Referral programme</h3>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Each referred installer who completes five approved unique installs adds £20 voucher credit to this installer&apos;s wallet. It is claimed through the normal reward process and counts towards the £30 minimum.</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['People referred', selectedReferrals.length],
                    ['Qualified 5/5', selectedReferrals.filter((row) => row.installer.referral_qualified).length],
                    ['Available credit', `£${Number(selected.installer.referral_discounts_available || 0) * 20}`],
                    ['Issued credit', `£${Number(selected.installer.referral_discounts_redeemed || 0) * 20}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border bg-muted/50 p-3">
                      <div className="text-xl font-semibold">{value}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">Referral code</span>
                    <span className="font-mono font-semibold tracking-wide">{selected.installer.referral_code || 'Not assigned'}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {selectedReferrals.map((referral) => (
                    <div key={referral.installer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                      <div>
                        <div className="text-sm font-semibold">{referral.installer.full_name || referral.installer.user_email}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Joined {date(referral.installer.created_date)} · {referral.approved.length} of 5 approved installs</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${referral.installer.referral_qualified ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                        {referral.installer.referral_qualified ? 'Qualified' : `${Math.max(5 - referral.approved.length, 0)} remaining`}
                      </span>
                    </div>
                  ))}
                  {!selectedReferrals.length && (
                    <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No installers have registered with this code yet.</div>
                  )}
                </div>

              </section>

              <section className="mt-5">
                <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-accent" /><h3 className="font-semibold">Installation history</h3></div>
                <div className="mt-3 space-y-3">
                  {selected.claims.slice(0, 20).map((claim) => (
                    <Link
                      key={claim.id}
                      to={`/admin/installs?claim=${encodeURIComponent(claim.id)}`}
                      onClick={() => setSelected(null)}
                      aria-label={`Review ${claim.product_model} installation ${claim.serial_number}`}
                      className="grid gap-3 rounded-xl border border-border p-3 transition-colors hover:border-accent hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:grid-cols-[64px_1fr_auto] sm:items-center"
                    >
                      {claim.install_photo_url ? <img src={claim.install_photo_url} alt="Installed charger" loading="lazy" decoding="async" width="64" height="64" className="h-16 w-16 rounded-lg border border-border object-cover bg-muted" /> : <div className="h-16 w-16 rounded-lg bg-muted" />}
                      <div>
                        <div className="text-sm font-medium">{claim.product_model} · {claim.serial_number}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{claim.site_postcode} · Installed {date(claim.install_date)}</div>
                      </div>
                      <div className="text-xs font-medium capitalize">{String(claim.status || '').replace(/_/g, ' ')}</div>
                    </Link>
                  ))}
                  {!selected.claims.length && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No installation claims yet.</div>}
                </div>
              </section>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}