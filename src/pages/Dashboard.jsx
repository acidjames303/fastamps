import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Camera, CheckCircle2, Clock3, Gift, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import OnboardingCard from '@/components/OnboardingCard';
import AdminOverview from '@/pages/AdminOverview';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { data, isLoading } = useInstaller();
  const installer = data?.installer;
  const { data: claims = [] } = useQuery({
    queryKey: ['install-claims', data?.user?.email],
    enabled: !!data?.user?.email,
    queryFn: () => base44.entities.InstallClaim.filter(
      { installer_email: data.user.email },
      '-created_date',
      100
    ),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (data?.user?.role === 'admin') return <AdminOverview />;
  if (!installer) return <OnboardingCard user={data?.user} />;

  const activeClaims = claims.filter((claim) => !claim.excluded_from_reporting);
  const firstName = installer.full_name?.split(' ')[0] || 'Installer';
  const approved = activeClaims.filter((claim) => claim.status === 'approved');
  const pending = activeClaims.filter((claim) => ['submitted', 'needs_information'].includes(claim.status));
  const welcomeAmount = installer.welcome_reward_amount || 10;
  const approvedRewards = activeClaims.filter((claim) => claim.reward_status === 'approved')
    .reduce((sum, claim) => sum + (claim.reward_amount || 0), 0)
    + (installer.welcome_reward_status === 'available' ? welcomeAmount : 0);
  const issuedRewards = activeClaims.filter((claim) => claim.reward_status === 'issued')
    .reduce((sum, claim) => sum + (claim.reward_amount || 0), 0)
    + (installer.welcome_reward_status === 'issued' ? welcomeAmount : 0);
  const monthlyApproved = approved.filter((claim) => {
    const date = new Date(claim.install_date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/20 via-muted/60 to-transparent">
        <div className="p-7 md:p-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent">Simple. Robust. Reliable.</div>
          <h1 className="mt-3 max-w-2xl text-4xl md:text-5xl font-semibold tracking-tight">{firstName}, every FastAmps install should pay.</h1>
          <p className="mt-4 max-w-xl text-foreground/70">Enter the unique charger PIN or scan its QR code, photograph the fitted charger, then submit the warranty and reward in one go.</p>
          <Button asChild className="mt-7 h-12 bg-primary text-white hover:bg-primary/85 font-semibold px-6">
            <Link to="/register-install"><Camera className="w-4 h-4 mr-2" />Register an install</Link>
          </Button>
        </div>
        <div className="grid grid-cols-3 border-t border-border bg-black/[0.03] dark:bg-black/10">
          {[
            ['Approved', approved.length],
            ['In review', pending.length],
            ['Reward value', `£${approvedRewards.toLocaleString()}`],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-4 md:px-8 md:py-5 border-r last:border-r-0 border-border">
              <div className="text-xl md:text-2xl font-semibold">{value}</div>
              <div className="mt-1 text-[9px] md:text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="rounded-3xl border border-border bg-muted/60 p-6 md:p-7">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">This month</div>
              <h2 className="mt-2 text-xl font-semibold">20 installs unlock a free Alpha 7</h2>
            </div>
            <Gift className="w-7 h-7 text-accent" />
          </div>
          <div className="mt-6 h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${Math.min((monthlyApproved / 20) * 100, 100)}%` }} />
          </div>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground/80">
            <span>{monthlyApproved} approved</span>
            <span>{Math.max(20 - monthlyApproved, 0)} to go</span>
          </div>
        </div>

        <div className="rounded-3xl border border-accent/25 bg-accent/[0.07] p-6 md:p-7">
          <div className="flex items-center gap-2 text-accent"><ShieldCheck className="w-5 h-5" /><span className="text-[11px] uppercase tracking-[0.18em]">Current offer</span></div>
          <div className="mt-3 text-3xl font-semibold">£10 + £10</div>
          <div className="mt-1 text-sm text-foreground/70">A £10 welcome bonus, then £10 for every approved FastAmps installation.</div>
          <div className="mt-4 text-xs text-muted-foreground/80">Voucher claims unlock when your available wallet balance reaches £30. Warranty registration is included in each submission.</div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Latest activity</div>
            <h2 className="mt-1 text-xl font-semibold">Your installation claims</h2>
          </div>
          <Link to="/installs" className="text-sm text-accent flex items-center gap-1">View all <ArrowRight className="w-4 h-4" /></Link>
        </div>

        <div className="rounded-2xl border border-border bg-muted/60 divide-y divide-border">
          {activeClaims.slice(0, 4).map((claim) => (
            <div key={claim.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{claim.product_model} · {claim.serial_number}</div>
                <div className="mt-1 text-xs text-muted-foreground/70">{claim.site_postcode} · {new Date(claim.install_date).toLocaleDateString('en-GB')}</div>
              </div>
              <div className="shrink-0 flex items-center gap-2 text-xs">
                {claim.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" /> : <Clock3 className="w-4 h-4 text-amber-700 dark:text-amber-200" />}
                <span className="capitalize text-foreground/75">{claim.status.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
          {activeClaims.length === 0 && (
            <div className="px-5 py-8 text-center">
              <div className="text-sm font-medium">No installs registered yet</div>
              <div className="mt-1 text-xs text-muted-foreground/70">Your £10 welcome bonus is ready. Keep building your wallet until it reaches the £30 voucher minimum.</div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-muted/60 p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Reward wallet</div>
          <div className="mt-1 text-xs text-muted-foreground/80">£{issuedRewards.toLocaleString()} issued · £{approvedRewards.toLocaleString()} available</div>
        </div>
        <Button asChild variant="outline" className="border-border bg-background">
          <Link to="/earnings">View wallet</Link>
        </Button>
      </section>
    </div>
  );
}