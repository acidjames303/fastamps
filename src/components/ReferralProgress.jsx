import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Gift, Loader2, RefreshCw, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

function ukDate(value) {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusDescription(referral) {
  if (referral.reward_status === 'rejected') return 'Referral declined after FastAmps review';
  if (referral.reward_status === 'held') return 'Referral reward temporarily on review hold';
  if (referral.reward_status === 'reward_earned') return '£20 reward earned';
  if (referral.reward_status === 'awaiting_reward_confirmation') return '5/5 complete · Reward being confirmed';
  if (referral.approved_installs > 0) return `${referral.installs_remaining} install${referral.installs_remaining === 1 ? '' : 's'} to go`;
  return 'Registered · Waiting for first approved install';
}

export default function ReferralProgress({ userEmail }) {
  const { data: summary, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['referral-progress', userEmail],
    enabled: Boolean(userEmail),
    queryFn: async () => {
      const response = await base44.functions.invoke('get-referral-progress', {});
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });

  const referrals = summary?.referrals || [];

  return (
    <div id="referral-progress" className="mt-5 scroll-mt-24 rounded-2xl border border-border/70 bg-background/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold"><Users className="h-4 w-4 text-accent" /> Track your referrals</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            See who registered with your referral code and how close each person is to five approved, unique FastAmps installations.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading referral progress…
        </div>
      )}
      {isError && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          {error?.response?.data?.error || 'We could not load your referral progress.'} Use Refresh to try again.
        </div>
      )}

      {!isLoading && !isError && summary && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['Registered', summary.registered_count || 0],
              ['Reward earned', summary.qualified_count || 0],
              ['In progress', referrals.filter((item) => !['reward_earned', 'rejected', 'held'].includes(item.reward_status)).length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-muted/35 p-3">
                <div className="text-xl font-semibold">{value}</div>
                <div className="mt-1 text-[10px] leading-4 uppercase tracking-wide text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {referrals.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/25 px-4 py-6 text-center">
              <Users className="mx-auto h-6 w-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-semibold">No registered referrals yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Share your code with another installer. They'll appear here once they enter it during sign-up.
                Sharing the code alone doesn't register a referral.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {referrals.map((referral) => {
                const approved = Number(referral.approved_installs || 0);
                const remaining = Number(referral.installs_remaining || 0);
                const progress = Math.min(100, (approved / 5) * 100);
                const earned = referral.reward_status === 'reward_earned';
                const confirming = referral.reward_status === 'awaiting_reward_confirmation';
                const disputed = ['held', 'rejected'].includes(referral.reward_status);
                return (
                  <article key={referral.referral_id} className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{referral.display_name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Used your code · Joined {ukDate(referral.joined_at)}</div>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${earned ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : confirming ? 'bg-amber-500/10 text-amber-700 dark:text-amber-200' : 'bg-accent/10 text-accent'}`}>
                        {earned ? <CheckCircle2 className="h-3.5 w-3.5" /> : confirming ? <Clock3 className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
                        {disputed ? (referral.reward_status === 'held' ? 'Under review' : 'Rejected') : earned ? '£20 earned' : confirming ? 'Checking reward' : '£20 to unlock'}
                      </div>
                    </div>
                    <div className="mt-4 flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-foreground/80">Approved installs</span>
                      <span className="text-sm font-semibold tabular-nums">{Math.min(approved, 5)} / 5</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${referral.display_name} approved installations`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={Math.min(approved, 5)}>
                      <div className={`h-full rounded-full transition-all ${earned ? 'bg-emerald-600' : 'bg-accent'}`} style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className={earned ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'font-medium text-foreground'}>
                        {statusDescription(referral)}
                      </span>
                      {referral.pending_review > 0 && (
                        <span className="text-amber-700 dark:text-amber-300">{referral.pending_review} install{referral.pending_review === 1 ? '' : 's'} awaiting review</span>
                      )}
                    </div>
                    {earned && approved < 5 && (
                      <p className="mt-2 text-xs text-muted-foreground">Reward was awarded previously. The approved installation count has changed since then.</p>
                    )}
                    {!earned && !confirming && !disputed && remaining > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">The £20 reward unlocks after {remaining} more approved, unique installation{remaining === 1 ? '' : 's'}. Claims awaiting review don't count yet.</p>
                    )}
                    {earned && referral.reward_awarded_at && (
                      <p className="mt-2 text-xs text-muted-foreground">Reward earned on {ukDate(referral.reward_awarded_at)}</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              The £20 referral credit is added to your wallet after qualification. Voucher redemption follows the usual £30 minimum and any other eligibility rules.
            </p>
            <Button asChild variant="outline" size="sm"><Link to="/earnings">View reward wallet</Link></Button>
          </div>
        </>
      )}
    </div>
  );
}
