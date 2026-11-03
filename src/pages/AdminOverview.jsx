import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronRight, QrCode, ShieldCheck, Users, Wallet } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function AdminOverview() {
  const { data: installers = [], isLoading: loadingInstallers } = useQuery({
    queryKey: ['admin-installers-overview'],
    queryFn: () => base44.entities.Installer.list('-created_date', 250),
  });

  const { data: claims = [], isLoading: loadingClaims } = useQuery({
    queryKey: ['admin-claims-overview'],
    queryFn: () => base44.entities.InstallClaim.list('-created_date', 250),
  });

  const { data: chargers = [], isLoading: loadingChargers } = useQuery({
    queryKey: ['admin-chargers-overview'],
    queryFn: () => base44.entities.Charger.list('-created_date', 500),
  });

  const { data: vouchers = [], isLoading: loadingVouchers } = useQuery({
    queryKey: ['admin-vouchers-overview'],
    queryFn: () => base44.entities.VoucherRequest.list('-created_date', 250),
  });

  const activeInstallers = installers.filter((installer) => !installer.excluded_from_reporting);
  const activeClaims = claims.filter((claim) => !claim.excluded_from_reporting);
  const activeChargers = chargers.filter((charger) => !charger.excluded_from_reporting);
  const activeVouchers = vouchers.filter((voucher) => !voucher.excluded_from_reporting);
  const pending = activeClaims.filter((claim) => ['submitted', 'needs_information'].includes(claim.status));
  const needsInformation = activeClaims.filter((claim) => claim.status === 'needs_information');
  const approved = activeClaims.filter((claim) => claim.status === 'approved');
  const rewardsAwaitingAction = activeClaims.filter((claim) => ['approved', 'redemption_requested'].includes(claim.reward_status));
  const voucherRequests = activeVouchers.filter((request) => request.status === 'requested');
  const availableChargers = activeChargers.filter((charger) => charger.claim_status === 'available');
  const loading = loadingInstallers || loadingClaims || loadingChargers || loadingVouchers;

  const actions = [
    {
      to: '/admin/installs',
      title: 'Review installs',
      description: `${pending.length} claim${pending.length === 1 ? '' : 's'} awaiting review`,
      icon: ShieldCheck,
    },
    {
      to: '/admin/chargers',
      title: 'Add charger PINs and QR codes',
      description: 'Upload charger records and generate QR batches',
      icon: QrCode,
    },
    {
      to: '/admin/reports',
      title: 'Programme reports',
      description: 'Installer activity, warranties and pilot performance',
      icon: BarChart3,
    },
    {
      to: '/admin/vouchers',
      title: 'Voucher requests',
      description: `${voucherRequests.length} request${voucherRequests.length === 1 ? '' : 's'} ready to process`,
      icon: Wallet,
    },
  ];

  if (loading) return <div className="text-sm text-muted-foreground">Loading FastAmps overview...</div>;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/20 via-muted/60 to-transparent p-7 md:p-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps team</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Installer programme overview</h1>
        <p className="mt-4 max-w-2xl text-foreground/70">
          Manage installers, review warranty and reward claims, add charger PINs, generate QR codes and monitor programme performance.
        </p>
        <Button asChild className="mt-7 h-12 bg-primary px-6 font-semibold text-white hover:bg-primary/85">
          <Link to="/admin/installs"><ShieldCheck className="mr-2 h-4 w-4" />Review pending installs</Link>
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Installers', activeInstallers.length, Users, '/admin/installers'],
          ['Awaiting review', pending.filter((claim) => claim.status === 'submitted').length, ShieldCheck, '/admin/installs?status=pending'],
          ['Needs information', needsInformation.length, ShieldCheck, '/admin/installs?status=pending'],
          ['Approved installs', approved.length, BarChart3, '/admin/installs?status=approved'],
          ['Rewards to action', rewardsAwaitingAction.length, Wallet, '/admin/vouchers'],
          ['Voucher requests', voucherRequests.length, Wallet, '/admin/vouchers'],
          ['Available chargers', availableChargers.length, QrCode, '/admin/chargers'],
        ].map(([label, value, Icon, to]) => (
          <Link key={label} to={to} className="group rounded-2xl border border-border bg-muted/60 p-4 transition-colors hover:border-accent/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <div className="flex items-start justify-between gap-3">
              <Icon className="h-5 w-5 text-accent" />
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
            <div className="mt-3 text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.13em] text-muted-foreground/70">{label}</div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {actions.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to} className="group rounded-2xl border border-border bg-muted/60 p-5 transition-colors hover:border-accent/35 hover:bg-muted">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-accent/10 p-3 text-accent"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
              <ChevronRight className="mt-2 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Installer records</div>
            <h2 className="mt-1 text-xl font-semibold">Latest registrations</h2>
          </div>
          <Button asChild variant="outline" className="border-border bg-background">
            <Link to="/admin/installers">View all installers</Link>
          </Button>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-muted/60">
          {activeInstallers.slice(0, 6).map((installer) => (
            <Link key={installer.id} to="/admin/installers" className="flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">{installer.full_name || installer.user_email}</div>
                <div className="mt-1 text-xs text-muted-foreground">{installer.user_email}{installer.mobile ? ` · ${installer.mobile}` : ''}</div>
              </div>
              <div className="text-xs text-muted-foreground">{installer.nominated_wholesaler || 'Wholesaler not nominated'}{installer.nominated_branch ? ` · ${installer.nominated_branch}` : ''}</div>
            </Link>
          ))}
          {!activeInstallers.length && <div className="px-5 py-8 text-center text-sm text-muted-foreground">No installer registrations yet.</div>}
        </div>
      </section>
    </div>
  );
}