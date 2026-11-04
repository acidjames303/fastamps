import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Gift, Plus, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import OnboardingCard from '@/components/OnboardingCard';
import { Button } from '@/components/ui/button';
import { formatStatus } from '@/utils/formatStatus';

const statusMeta = {
  submitted: { label: 'Under review', Icon: Clock3, className: 'text-amber-700 dark:text-amber-200 bg-amber-400/15 dark:bg-amber-400/10' },
  needs_information: { label: 'Action needed', Icon: TriangleAlert, className: 'text-orange-700 dark:text-orange-200 bg-orange-400/15 dark:bg-orange-400/10' },
  approved: { label: 'Approved', Icon: CheckCircle2, className: 'text-emerald-700 dark:text-emerald-200 bg-emerald-400/15 dark:bg-emerald-400/10' },
  rejected: { label: 'Not approved', Icon: XCircle, className: 'text-red-700 dark:text-red-200 bg-red-400/15 dark:bg-red-400/10' },
};

export default function Installs() {
  const { data, isLoading: loadingInstaller } = useInstaller();
  const installer = data?.installer;
  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['install-claims', data?.user?.email],
    enabled: !!data?.user?.email,
    queryFn: () => base44.entities.InstallClaim.filter(
      { installer_email: data.user.email },
      '-created_date',
      100
    ),
  });

  if (loadingInstaller) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!installer) return <OnboardingCard user={data?.user} />;

  const activeClaims = claims.filter((claim) => !claim.excluded_from_reporting);
  const approved = activeClaims.filter((claim) => claim.status === 'approved');
  const pending = activeClaims.filter((claim) => ['submitted', 'needs_information'].includes(claim.status));
  const rewards = approved.reduce((sum, claim) => sum + (claim.reward_amount || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent">Proof. Warranty. Reward.</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">My installs</h1>
          <p className="mt-2 text-muted-foreground">Track every FastAmps charger you have registered.</p>
        </div>
        <Button asChild className="h-11 bg-primary text-white hover:bg-primary/85 font-semibold">
          <Link to="/register-install"><Plus className="w-4 h-4 mr-2" />Register an install</Link>
        </Button>
      </div>

      <section className="grid grid-cols-3 gap-3">
        {[
          ['Submitted', activeClaims.length],
          ['Pending', pending.length],
          ['Approved rewards', `£${rewards.toLocaleString()}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-muted/60 p-4 md:p-5">
            <div className="text-xl md:text-3xl font-semibold">{value}</div>
            <div className="mt-1 text-[10px] md:text-xs uppercase tracking-[0.12em] text-muted-foreground/70">{label}</div>
          </div>
        ))}
      </section>

      {isLoading ? <div className="text-sm text-muted-foreground">Loading installs…</div> : activeClaims.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-8 md:p-12 text-center">
          <ShieldCheck className="mx-auto w-9 h-9 text-accent" />
          <h2 className="mt-4 text-xl font-semibold">Your first reward starts here</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">Upload a clear installation photo and the charger details. FastAmps will validate the warranty and reward together.</p>
          <Button asChild className="mt-6 bg-primary text-white hover:bg-primary/85">
            <Link to="/register-install">Register your first install</Link>
          </Button>
        </section>
      ) : (
        <section className="space-y-3">
          {activeClaims.map((claim) => {
            const meta = statusMeta[claim.status] || statusMeta.submitted;
            return (
              <article key={claim.id} className="rounded-2xl border border-border bg-muted/60 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <img src={claim.install_photo_url} alt="Installed FastAmps charger" loading="lazy" decoding="async" width="64" height="64" className="w-16 h-16 rounded-xl object-cover border border-border bg-muted" />
                    <div className="min-w-0">
                      <div className="font-semibold">{claim.product_model}</div>
                      <div className="mt-1 text-xs text-muted-foreground truncate">{claim.serial_number} · {claim.site_postcode}</div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground/80">
                        <span>{new Date(claim.install_date).toLocaleDateString('en-GB')}</span>
                        <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Warranty: {claim.warranty_status}</span>
                        <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5" />£{claim.reward_amount || 10}: {formatStatus(claim.reward_status)}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${meta.className}`}>
                    <meta.Icon className="w-3.5 h-3.5" />{meta.label}
                  </div>
                </div>
                {claim.review_note && <div className="mt-4 rounded-xl bg-black/[0.04] dark:bg-black/15 p-3 text-xs text-foreground/75">{claim.review_note}</div>}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}