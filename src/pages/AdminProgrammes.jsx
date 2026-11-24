import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  CheckCircle2, Loader2, Pause, Play, Power, QrCode, RefreshCw, Users,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { FASTAMPS_CONNECT_URL } from '@/lib/appUrl';

function statusBadge(status) {
  const styles = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    paused: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    closed: 'bg-destructive/10 text-destructive',
  };
  return styles[status] || styles.draft;
}

export default function AdminProgrammes() {
  const { data: identity } = useInstaller();
  const isAdmin = identity?.user?.role === 'admin';
  const qc = useQueryClient();
  const [inviteQr, setInviteQr] = useState('');
  const [filter, setFilter] = useState('');

  const { data: programmes = [], isLoading } = useQuery({
    queryKey: ['incentive-programmes'],
    enabled: isAdmin,
    queryFn: async () => {
      await base44.functions.invoke('manage-incentive-programme', { action: 'ensure_links_beta' });
      const response = await base44.functions.invoke('manage-incentive-programme', { action: 'list' });
      return response?.data?.programmes || response?.programmes || [];
    },
  });

  const { data: demand = [] } = useQuery({
    queryKey: ['programme-demand'],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await base44.functions.invoke('manage-incentive-programme', { action: 'demand_summary' });
      return response?.data?.branches || response?.branches || [];
    },
  });

  const { data: installers = [] } = useQuery({
    queryKey: ['admin-installers-membership'],
    enabled: isAdmin,
    queryFn: () => base44.entities.Installer.list('-created_date', 500),
  });

  const preRegistered = useMemo(
    () => installers.filter((item) => item.membership_status === 'pre_registered' && !item.excluded_from_reporting),
    [installers],
  );

  const filteredDemand = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return demand;
    return demand.filter((row) =>
      [row.wholesaler_name, row.branch_name, row.town, row.postcode].join(' ').toLowerCase().includes(needle));
  }, [demand, filter]);

  const statusMutation = useMutation({
    mutationFn: async ({ programme, status }) => {
      const response = await base44.functions.invoke('manage-incentive-programme', {
        action: 'set_status',
        programme_id: programme.id,
        status,
        confirm_activation: status === 'active',
      });
      const data = response?.data || response;
      if (data?.error) throw new Error(data.error);
      return data.programme;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incentive-programmes'] });
      toast({ title: 'Programme updated' });
    },
    onError: (error) => toast({ title: 'Update failed', description: error.message, variant: 'destructive' }),
  });

  const activateInstaller = useMutation({
    mutationFn: async (installer) => {
      const response = await base44.functions.invoke('activate-installer-membership', {
        action: 'activate',
        installer_id: installer.id,
        send_notification: false,
        programme_code: 'links-electrical-shrewsbury',
      });
      const data = response?.data || response;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-installers-membership'] });
      toast({ title: 'Installer activated' });
    },
    onError: (error) => toast({ title: 'Activation failed', description: error.message, variant: 'destructive' }),
  });

  const linksProgramme = programmes.find((item) => item.programme_code === 'links-electrical-shrewsbury') || programmes[0];
  const inviteUrl = linksProgramme
    ? `${FASTAMPS_CONNECT_URL}/invite/${encodeURIComponent(linksProgramme.programme_code)}`
    : '';

  const renderInviteQr = async () => {
    if (!inviteUrl) return;
    const dataUrl = await QRCode.toDataURL(inviteUrl, { width: 360, margin: 2 });
    setInviteQr(dataUrl);
  };

  if (!isAdmin) return <div className="text-sm text-muted-foreground">Administrator access required.</div>;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-primary">Programme management</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Controlled beta & rollout demand</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Links Electrical Shrewsbury stays draft/inactive until genuine codes are authorised. Nationwide pre-registration demand is listed below without activating unrelated branches.
            </p>
          </div>
          <Button variant="outline" onClick={() => qc.invalidateQueries()} className="h-11">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading programmes…</div>
      ) : linksProgramme ? (
        <section className="rounded-3xl border border-border p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{linksProgramme.name}</h2>
              <div className="mt-1 text-sm text-muted-foreground">
                {linksProgramme.wholesaler_name} – {linksProgramme.branch_name} · {linksProgramme.currency} · {linksProgramme.country}
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadge(linksProgramme.status)}`}>
              {linksProgramme.status}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-2xl border border-border p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Expected allocation</div>
              <div className="mt-1 text-2xl font-semibold">{linksProgramme.expected_charger_allocation || '—'}</div>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Claim verification</div>
              <div className="mt-1 font-medium">Manual administrator approval</div>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Payout mode</div>
              <div className="mt-1 font-medium">Held pending authorisation</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={statusMutation.isPending || linksProgramme.status === 'active'}
              onClick={() => {
                if (!window.confirm('Activate only after Edd-authorised codes are imported and JP approves go-live. Continue?')) return;
                statusMutation.mutate({ programme: linksProgramme, status: 'active' });
              }}
            >
              <Play className="mr-2 h-4 w-4" /> Activate
            </Button>
            <Button
              variant="outline"
              disabled={statusMutation.isPending || linksProgramme.status === 'paused'}
              onClick={() => statusMutation.mutate({ programme: linksProgramme, status: 'paused' })}
            >
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
            <Button
              variant="outline"
              disabled={statusMutation.isPending || linksProgramme.status === 'closed'}
              onClick={() => statusMutation.mutate({ programme: linksProgramme, status: 'closed' })}
            >
              <Power className="mr-2 h-4 w-4" /> Close
            </Button>
            <Button variant="outline" onClick={renderInviteQr}>
              <QrCode className="mr-2 h-4 w-4" /> Invitation QR
            </Button>
          </div>
          {inviteUrl ? (
            <div className="text-xs text-muted-foreground break-all">Invitation URL: {inviteUrl}</div>
          ) : null}
          {inviteQr ? (
            <div className="rounded-2xl border border-border p-4 inline-block">
              <img src={inviteQr} alt="Links Electrical programme invitation QR" className="h-48 w-48" />
              <div className="mt-2 text-xs text-muted-foreground max-w-[12rem]">
                Counter display QR. Inactive programmes route installers to pre-registration.
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-3xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Pre-registered installers</h2>
          <span className="text-sm text-muted-foreground">({preRegistered.length})</span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Installer</th>
                <th className="py-2 pr-4">Preferred branch</th>
                <th className="py-2 pr-4">Area</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {preRegistered.slice(0, 50).map((installer) => (
                <tr key={installer.id} className="border-t border-border">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{installer.full_name}</div>
                    <div className="text-xs text-muted-foreground">{installer.user_email}</div>
                  </td>
                  <td className="py-3 pr-4">
                    {installer.nominated_wholesaler || installer.preferred_wholesaler_manual}
                    {' – '}
                    {installer.nominated_branch || installer.preferred_branch_manual}
                  </td>
                  <td className="py-3 pr-4">
                    {[installer.town_city, installer.postcode].filter(Boolean).join(' · ') || installer.coverage_area}
                  </td>
                  <td className="py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={activateInstaller.isPending}
                      onClick={() => activateInstaller.mutate(installer)}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Activate
                    </Button>
                  </td>
                </tr>
              ))}
              {!preRegistered.length ? (
                <tr><td className="py-4 text-muted-foreground" colSpan={4}>No pre-registered installers yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-border p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Installer demand by wholesaler branch</h2>
          <Input
            className="h-11 max-w-sm"
            placeholder="Filter by wholesaler, branch, town, postcode"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Wholesaler</th>
                <th className="py-2 pr-4">Branch</th>
                <th className="py-2 pr-4">Interested</th>
                <th className="py-2 pr-4">Invited</th>
                <th className="py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {filteredDemand.map((row) => (
                <tr key={`${row.wholesaler_name}-${row.branch_name}`} className="border-t border-border">
                  <td className="py-3 pr-4">{row.wholesaler_name}</td>
                  <td className="py-3 pr-4">
                    {row.branch_name}
                    {(row.town || row.postcode) ? (
                      <div className="text-xs text-muted-foreground">{[row.town, row.postcode].filter(Boolean).join(' · ')}</div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{row.interested}</td>
                  <td className="py-3 pr-4">{row.invited}</td>
                  <td className="py-3">{row.active}</td>
                </tr>
              ))}
              {!filteredDemand.length ? (
                <tr><td className="py-4 text-muted-foreground" colSpan={5}>No demand rows yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
