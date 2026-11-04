import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, LockKeyhole, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LABELS = {
  installer: 'Installer reward account',
  referral: 'Referred installer',
  installation: 'Installation reward',
  voucher: 'Voucher request',
};
const ACTIONS = {
  installer: ['hold', 'release', 'block'],
  referral: ['hold', 'release', 'reject'],
  installation: ['hold', 'release', 'reject'],
  voucher: ['hold', 'release'],
};
const stateFor = (scope, row) => scope === 'installer'
  ? (row.reward_account_status || 'active')
  : scope === 'referral' ? (row.referral_review_status || 'clear')
  : scope === 'installation' ? (row.reward_status || 'pending')
  : (row.fraud_review_status || 'clear');

export default function AdminFraudReview() {
  const { data: identity, isLoading: loadingIdentity } = useInstaller();
  const admin = identity?.user?.role === 'admin';
  const queryClient = useQueryClient();
  const [scope, setScope] = useState('installation');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const { data: installers = [] } = useQuery({ queryKey: ['fraud-installers'], enabled: admin,
    queryFn: () => base44.entities.Installer.list('-created_date', 500) });
  const { data: claims = [] } = useQuery({ queryKey: ['fraud-claims'], enabled: admin,
    queryFn: () => base44.entities.InstallClaim.list('-created_date', 500) });
  const { data: vouchers = [] } = useQuery({ queryKey: ['fraud-vouchers'], enabled: admin,
    queryFn: () => base44.entities.VoucherRequest.list('-created_date', 300) });
  const { data: history = [] } = useQuery({ queryKey: ['fraud-review-audit'], enabled: admin,
    queryFn: () => base44.entities.RewardReviewAudit.list('-created_date', 80) });

  const entries = useMemo(() => {
    const list = scope === 'installer' ? installers
      : scope === 'referral' ? installers.filter((row) => row.referred_by_installer_id || row.referred_by_code)
      : scope === 'installation' ? claims : vouchers;
    const needle = search.toLowerCase().trim();
    return list.filter((row) => !row.excluded_from_reporting &&
      (!needle || [row.full_name, row.user_email, row.installer_email, row.installer_name,
        row.serial_number, row.mobile, row.referral_code, row.id, row.claim_reference]
        .some((value) => String(value || '').toLowerCase().includes(needle))));
  }, [scope, installers, claims, vouchers, search]);

  const review = useMutation({
    mutationFn: async (action) => {
      const response = await base44.functions.invoke('admin-fraud-review', {
        scope, target_id: selected.id, action, reason: reason.trim(),
      });
      return response.data;
    },
    onSuccess: async (response) => {
      toast.success(response.warning || response.message || 'Review recorded.');
      setSelected(null);
      setReason('');
      await Promise.all(['fraud-installers', 'fraud-claims', 'fraud-vouchers', 'fraud-review-audit',
        'admin-install-claims', 'admin-installer-directory', 'admin-voucher-requests', 'installer', 'programme-report'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })));
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message || 'Review could not be saved.'),
  });

  if (loadingIdentity) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!admin) return <div className="rounded-xl border border-border p-6">FastAmps admin access required.</div>;

  const heading = (row) => scope === 'installer' || scope === 'referral'
    ? (row.full_name || row.user_email) : scope === 'installation'
      ? `${row.serial_number} · ${row.installer_name || row.installer_email}`
      : `${row.installer_name || row.installer_email} · £${Number(row.amount || 0)}`;

  return (
    <main className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-accent">FastAmps team</div>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold"><ShieldAlert className="h-7 w-7 text-accent" />Fraud and reward review</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Hold or reject questionable incentives separately from warranty decisions. Every action requires a reason and creates an admin audit record. Previously sent vouchers cannot be recalled.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.keys(LABELS).map((key) =>
          <Button key={key} variant={scope === key ? 'default' : 'outline'} size="sm"
            onClick={() => { setScope(key); setSelected(null); setReason(''); }}>{LABELS[key]}</Button>)}
      </div>
      <Input value={search} onChange={(event) => setSearch(event.target.value)}
        placeholder="Search installer, charger serial number or voucher ID" aria-label="Search review records" />
      <div className="text-xs text-muted-foreground">{entries.length} records shown · {LABELS[scope]}</div>
      <div className="space-y-3">
        {entries.slice(0, 200).map((row) => {
          const status = stateFor(scope, row);
          const open = selected?.id === row.id;
          return <article key={row.id} className="rounded-2xl border border-border bg-muted/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{heading(row)}</div>
                <div className="mt-1 text-xs text-muted-foreground">Review status: <strong>{status}</strong>
                  {scope === 'referral' && row.referral_qualified ? ' · Previously qualified for £20' : ''}
                  {scope === 'installation' ? ` · Warranty ${row.warranty_status || 'queued'}` : ''}
                  {scope === 'voucher' ? ` · Fulfilment ${row.status}` : ''}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSelected(open ? null : row); setReason(''); }}>{open ? 'Close review' : 'Review'}</Button>
            </div>
            {open && <div className="mt-4 space-y-3 border-t border-border pt-4">
              <label className="block text-sm font-medium" htmlFor="fraud-reason">Reason for the decision (required, 8–1,000 characters)</label>
              <textarea id="fraud-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm" placeholder="Describe the duplicate, suspicious evidence, investigation or reason for release…" />
              <div className="flex flex-wrap gap-2">
                {ACTIONS[scope].map((action) =>
                  <Button key={action} type="button" size="sm" variant={action === 'release' ? 'outline' : 'destructive'}
                    disabled={review.isPending || reason.trim().length < 8}
                    onClick={() => review.mutate(action)}>
                    {action === 'release' ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : action === 'hold' ? <Clock3 className="mr-1.5 h-4 w-4" /> : <LockKeyhole className="mr-1.5 h-4 w-4" />}
                    {action === 'hold' ? 'Hold for review' : action === 'release' ? 'Release hold' : action === 'block' ? 'Block reward account' : 'Reject reward'}
                  </Button>)}
              </div>
              {scope === 'referral' && <p className="text-xs text-amber-700 dark:text-amber-300">If credit was previously awarded, the referrer's wallet is also held. Release their wallet separately after investigating historic vouchers.</p>}
              {scope === 'installation' && <p className="text-xs text-muted-foreground">Holding or rejecting an incentive does not automatically decline its product warranty.</p>}
            </div>}
          </article>;
        })}
        {entries.length > 200 && <p className="text-sm text-muted-foreground">Showing the first 200 matching records. Search to narrow the list.</p>}
        {entries.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">No matching records.</p>}
      </div>
      <section className="rounded-2xl border border-border p-5">
        <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Recent review history</h2>
        <div className="mt-3 space-y-2">
          {history.slice(0, 20).map((entry) =>
            <div key={entry.id} className="rounded-lg bg-muted/40 p-3 text-xs">
              <strong>{entry.scope} · {entry.action}</strong> <span className="text-muted-foreground">by {entry.reviewer_email} · {new Date(entry.reviewed_at).toLocaleString('en-GB')}</span>
              <div className="mt-1 break-words">{entry.reason}</div>
            </div>)}
          {!history.length && <p className="text-xs text-muted-foreground">No fraud review actions recorded yet.</p>}
        </div>
      </section>
    </main>
  );
}
