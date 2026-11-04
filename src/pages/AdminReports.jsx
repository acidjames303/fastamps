import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Download,
  Gift,
  Loader2,
  PoundSterling,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

const ranges = [
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['90d', '90 days'],
  ['all', 'All time'],
];

function money(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function downloadFile(filename, content) {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  const [range, setRange] = useState('30d');
  const [exporting, setExporting] = useState({ installers: false, claims: false });
  const [selectedWholesaler, setSelectedWholesaler] = useState(null);
  const { data: identity, isLoading: loadingIdentity } = useInstaller();
  const isAdmin = identity?.user?.role === 'admin';

  const { data: report, error, isError, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['programme-report', range],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await base44.functions.invoke('get-programme-report', { range });
      return response.data;
    },
  });

  const exportReport = async (type) => {
    try {
      setExporting((current) => ({ ...current, [type]: true }));
      const response = await base44.functions.invoke('get-programme-report', {
        range,
        export_type: type,
      });
      downloadFile(response.data.filename, response.data.csv);
    } catch (exportError) {
      toast({
        title: 'Report could not be downloaded',
        description: exportError?.response?.data?.error || exportError?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting((current) => ({ ...current, [type]: false }));
    }
  };

  if (loadingIdentity) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!isAdmin) return (
    <div className="rounded-2xl border border-border bg-muted/60 p-8">
      <h1 className="text-xl font-semibold">FastAmps team access only</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your account does not have permission to view programme reports.</p>
    </div>
  );

  const summary = report?.summary || {};
  const maxFunnel = Math.max(...(report?.funnel || []).map((item) => item.value), 1);
  const cards = [
    {
      label: 'Registrations',
      value: summary.registrations || 0,
      Icon: Users,
      to: `/admin/installers?range=${range}`,
      helper: 'View registered installer profiles',
    },
    {
      label: 'Active installers',
      value: summary.active_installers || 0,
      Icon: Activity,
      to: `/admin/installers?activity=active&range=${range}`,
      helper: 'Installers with an approved claim',
    },
    {
      label: 'Approved installs',
      value: summary.approved || 0,
      Icon: ShieldCheck,
      to: `/admin/installs?status=approved&range=${range}`,
      helper: 'Open approved installation records',
    },
    {
      label: 'Repeat rate',
      value: `${summary.repeat_rate || 0}%`,
      Icon: RefreshCw,
      target: 'repeat-rate',
      helper: `${summary.repeat_installers || 0} of ${summary.active_installers || 0} active installers returned`,
    },
    {
      label: 'Programme cost',
      value: money(summary.programme_cost),
      Icon: PoundSterling,
      target: 'pilot-economics',
      helper: 'Rewards plus programme usage fees',
    },
    {
      label: 'Attributed value',
      value: money(summary.reference_order_value),
      Icon: BarChart3,
      target: 'pilot-economics',
      helper: `${summary.approved || 0} approved × ${money(report?.assumptions?.reference_charger_value || 220)}`,
    },
  ];

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps team</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Programme reporting</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Measure installer activation, repeat use, approved installations, wholesaler activity and pilot cost.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ranges.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={range === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRange(value)}
              className={range === value ? 'bg-primary text-white' : 'border-border bg-transparent text-foreground'}
            >
              {label}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh report">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-muted/60 p-8 text-sm text-muted-foreground">
          Building the report...
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-8">
          <h2 className="font-semibold text-destructive">The report could not be loaded</h2>
          <p className="mt-2 text-sm text-destructive/80">{error?.response?.data?.error || error?.message || 'Please refresh and try again.'}</p>
          <Button type="button" onClick={() => refetch()} className="mt-5 bg-primary text-white">
            <RefreshCw className="mr-2 h-4 w-4" />Try again
          </Button>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map(({ label, value, Icon, to, target, helper }) => {
              const content = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <Icon className="h-5 w-5 text-accent" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.13em] text-muted-foreground/70">{label}</div>
                  <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{helper}</p>
                </>
              );
              const className = 'group min-h-40 rounded-2xl border border-border bg-muted/60 p-4 text-left transition-colors hover:border-accent/50 hover:bg-accent/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
              return to ? (
                <Link key={label} to={to} className={className}>{content}</Link>
              ) : (
                <button key={label} type="button" onClick={() => scrollToSection(target)} className={className}>{content}</button>
              );
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <article className="rounded-3xl border border-border bg-muted/60 p-6">
              <h2 className="text-lg font-semibold">Installer funnel</h2>
              <p className="mt-1 text-sm text-muted-foreground">Shows whether sign-ups are turning into approved and repeat installations.</p>
              <div className="mt-6 space-y-5">
                {(report?.funnel || []).map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-foreground/80">{item.label}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.max((item.value / maxFunnel) * 100, item.value ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div id="repeat-rate" className="mt-6 rounded-xl border border-accent/20 bg-accent/[0.06] p-4 scroll-mt-24">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">What does repeat rate mean?</div>
                  <div className="text-xl font-semibold text-accent">{summary.repeat_rate || 0}%</div>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  An active installer has at least one approved installation. A repeat installer has two or more. Here, {summary.repeat_installers || 0} of {summary.active_installers || 0} active installers have returned with another approved installation.
                </p>
                <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs text-accent">
                  <Link to={`/admin/installers?activity=repeat&range=${range}`}>View repeat installers <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted p-3">
                  <div className="text-xl font-semibold">{summary.approval_rate || 0}%</div>
                  <div className="text-xs text-muted-foreground/80">Claim approval rate</div>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <div className="text-xl font-semibold">{summary.voucher_requests || 0}</div>
                  <div className="text-xs text-muted-foreground/80">Voucher requests</div>
                </div>
              </div>
            </article>

            <article className="min-w-0 rounded-3xl border border-border bg-muted/60 p-6">
              <h2 className="text-lg font-semibold">Programme activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">Registrations, claims and approvals within the selected period.</p>
              <div className="mt-6 h-72">
                {report?.trend?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.trend}>
                      <CartesianGrid stroke="rgba(120,140,170,0.18)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#7a859e', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
                      <YAxis allowDecimals={false} tick={{ fill: '#7a859e', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#0a1122', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: '#fff' }} />
                      <Legend />
                      <Line type="monotone" dataKey="registrations" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="submitted" stroke="#a78bfa" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="approved" stroke="#34d399" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground/80">No activity in this period yet.</div>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-3xl border border-border bg-muted/60 p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold">Wholesaler and branch activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a distributor to see its linked installers, their nominated distributor and any purchases made elsewhere.
              </p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    <tr>
                      <th className="pb-3 font-medium">Wholesaler</th>
                      <th className="pb-3 font-medium">Branch</th>
                      <th className="pb-3 text-right font-medium">Installers</th>
                      <th className="pb-3 text-right font-medium">Claims</th>
                      <th className="pb-3 text-right font-medium">Approved</th>
                      <th className="pb-3 text-right font-medium">Elsewhere</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(report?.wholesalers || []).map((row) => (
                      <tr key={`${row.wholesaler}-${row.branch}`} className="transition-colors hover:bg-accent/[0.04]">
                        <td className="py-3 font-medium">
                          <button type="button" onClick={() => setSelectedWholesaler(row)} className="group flex w-full items-center gap-2 text-left hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md">
                            <span>{row.wholesaler}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                          </button>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          <button type="button" onClick={() => setSelectedWholesaler(row)} className="w-full text-left hover:text-foreground">{row.branch}</button>
                        </td>
                        <td className="py-3 text-right"><button type="button" onClick={() => setSelectedWholesaler(row)} className="hover:text-accent">{row.installers}</button></td>
                        <td className="py-3 text-right"><button type="button" onClick={() => setSelectedWholesaler(row)} className="hover:text-accent">{row.submitted}</button></td>
                        <td className="py-3 text-right text-accent"><button type="button" onClick={() => setSelectedWholesaler(row)}>{row.approved}</button></td>
                        <td className="py-3 text-right">
                          <button type="button" onClick={() => setSelectedWholesaler(row)} className={row.bought_elsewhere ? 'font-semibold text-amber-600 dark:text-amber-300' : 'text-muted-foreground'}>
                            {row.bought_elsewhere || 0}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!report?.wholesalers?.length && (
                      <tr><td colSpan="6" className="py-8 text-center text-muted-foreground/80">No wholesaler activity in this period yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article id="pilot-economics" className="scroll-mt-24 rounded-3xl border border-accent/25 bg-accent/[0.06] p-6">
              <Gift className="h-6 w-6 text-accent" />
              <h2 className="mt-4 text-lg font-semibold">Pilot economics</h2>
              <p className="mt-1 text-sm text-muted-foreground">Estimated programme-attributed charger value compared with the direct pilot costs.</p>

              <div className="mt-5 rounded-2xl border border-accent/20 bg-background/50 p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Reference sales value generated</div>
                <div className="mt-1 text-3xl font-semibold">{money(summary.reference_order_value)}</div>
                <p className="mt-1 text-xs text-muted-foreground">{summary.approved || 0} approved chargers × {money(report?.assumptions?.reference_charger_value || 220)} reference value</p>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Installation rewards</span><strong>{money(summary.installation_reward_cost)}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Welcome bonuses</span><strong>{money(summary.welcome_reward_cost)}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">JP usage fees</span><strong>{money(summary.usage_fee_cost)}</strong></div>
                <div className="border-t border-border pt-3 flex justify-between gap-4"><span>Total programme cost</span><strong className="text-accent">{money(summary.programme_cost)}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Reference value after programme cost</span><strong>{money(summary.reference_value_after_programme_cost)}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Value generated per £1 programme cost</span><strong>{summary.reference_value_multiple || 0}×</strong></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Programme cost as % of value</span><strong>{summary.programme_cost_ratio || 0}%</strong></div>
              </div>
              <p className="mt-5 rounded-xl border border-border bg-background/40 p-3 text-xs leading-5 text-muted-foreground">
                This is an attributed sales-value estimate using £{report?.assumptions?.reference_charger_value || 220} per approved charger. It is not revenue confirmation, gross profit or net profit. Actual margin can be added when FastAmps confirms the unit contribution.
              </p>
            </article>
          </section>

          <Dialog open={Boolean(selectedWholesaler)} onOpenChange={(open) => !open && setSelectedWholesaler(null)}>
            <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-accent" />{selectedWholesaler?.wholesaler} · {selectedWholesaler?.branch}</DialogTitle>
                <DialogDescription>Installer nominations and recorded purchase activity for the selected reporting period.</DialogDescription>
              </DialogHeader>

              {selectedWholesaler && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['Linked installers', selectedWholesaler.installers || 0],
                      ['Claims', selectedWholesaler.submitted || 0],
                      ['Approved', selectedWholesaler.approved || 0],
                      ['Bought elsewhere', selectedWholesaler.bought_elsewhere || 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-border bg-muted/60 p-3">
                        <div className="text-xl font-semibold">{value}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
                      </div>
                    ))}
                  </div>

                  <section>
                    <h3 className="text-sm font-semibold">Linked installer profiles</h3>
                    <div className="mt-3 space-y-2">
                      {(selectedWholesaler.linked_installers || []).map((installer) => (
                        <div key={installer.email} className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                          <div className="font-medium">{installer.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{installer.business_name || installer.email}</div>
                          <div className="mt-2 text-xs"><span className="text-muted-foreground">Nominated:</span> {installer.nominated_wholesaler} · {installer.nominated_branch}</div>
                        </div>
                      ))}
                      {!selectedWholesaler.linked_installers?.length && <p className="text-sm text-muted-foreground">No linked installer profile is recorded for this row.</p>}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold">Installation purchase checks</h3>
                    <div className="mt-3 space-y-2">
                      {(selectedWholesaler.claims || []).map((claim) => (
                        <div key={claim.id} className={`rounded-xl border p-3 text-sm ${claim.bought_elsewhere ? 'border-amber-400/40 bg-amber-400/[0.08]' : 'border-border bg-muted/40'}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-medium">{claim.installer_name}</div>
                              <div className="mt-1 text-xs text-muted-foreground">Charger {claim.serial_number} · {String(claim.status || '').replaceAll('_', ' ')}</div>
                            </div>
                            {claim.bought_elsewhere ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-200"><AlertTriangle className="h-3 w-3" />Bought elsewhere</span>
                            ) : !claim.purchase_recorded ? (
                              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Purchase not recorded</span>
                            ) : (
                              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-200">Matches nomination</span>
                            )}
                          </div>
                          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                            <div><span className="text-muted-foreground">Nominated:</span> {claim.nominated_wholesaler} · {claim.nominated_branch}</div>
                            <div><span className="text-muted-foreground">Purchased from:</span> {claim.purchase_wholesaler} · {claim.purchase_branch}</div>
                          </div>
                        </div>
                      ))}
                      {!selectedWholesaler.claims?.length && <p className="text-sm text-muted-foreground">No installation purchases are recorded against this distributor in this period.</p>}
                    </div>
                  </section>

                  <p className="rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                    “Bought elsewhere” means the distributor entered on an installation claim does not match the installer’s nominated distributor. Branch differences alone are shown but are not counted as buying elsewhere.
                  </p>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Downloadable reports</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose the report by what each row represents. Both downloads use the reporting period selected at the top of this page.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <article className="flex flex-col rounded-3xl border border-border bg-muted/60 p-6">
                <div className="flex items-start justify-between gap-3">
                  <BarChart3 className="h-5 w-5 text-accent" />
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">One row per installer</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">Installer directory and activity</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Use this to manage installer relationships. It includes installers who registered or submitted a claim during the selected period.</p>
                <ul className="mt-4 space-y-2 text-sm text-foreground/80">
                  <li>• Contact, business and regional details</li>
                  <li>• Nominated distributor and branch</li>
                  <li>• Claims, approvals and repeat activity</li>
                  <li>• Training, referrals and verification</li>
                </ul>
                <div className="mt-auto pt-5">
                  <div className="mb-3 text-xs text-muted-foreground">Expected rows: {summary.installer_report_rows || 0}</div>
                  <Button onClick={() => exportReport('installers')} disabled={exporting.installers} aria-busy={exporting.installers} className="w-full bg-primary text-white sm:w-auto">
                    {exporting.installers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {exporting.installers ? 'Preparing installer report...' : 'Download installer directory'}
                  </Button>
                </div>
              </article>

              <article className="flex flex-col rounded-3xl border border-border bg-muted/60 p-6">
                <div className="flex items-start justify-between gap-3">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">One row per claim</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">Installation, warranty and rewards</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Use this for operational checks and audit history. Each row represents one charger installation claim.</p>
                <ul className="mt-4 space-y-2 text-sm text-foreground/80">
                  <li>• Charger, installation date and postcode</li>
                  <li>• Nominated versus actual distributor</li>
                  <li>• Claim, warranty and reward status</li>
                  <li>• Admin reviewer, review time and notes</li>
                </ul>
                <div className="mt-auto pt-5">
                  <div className="mb-3 text-xs text-muted-foreground">Expected rows: {summary.submitted || 0}</div>
                  <Button onClick={() => exportReport('claims')} disabled={exporting.claims} aria-busy={exporting.claims} className="w-full bg-primary text-white sm:w-auto">
                    {exporting.claims ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {exporting.claims ? 'Preparing claims report...' : 'Download installation claims'}
                  </Button>
                </div>
              </article>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">CSV files are formatted for Excel and Google Sheets. Dates use UK format, currency is shown in pounds and internal status codes are converted into readable labels.</p>
          </section>
        </>
      )}
    </div>
  );
}