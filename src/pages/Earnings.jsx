import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Gift, WalletCards, ShieldAlert, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PROGRAMME_TERMS_VERSION } from '@/pages/ProgrammeTerms';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import OnboardingCard from '@/components/OnboardingCard';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const MINIMUM_REDEMPTION_AMOUNT = 30;
const FIRST_REDEMPTION_INSTALLS = 3;
const REFERRAL_CREDIT_VALUE = 20;

const rewardStatusLabels = {
  pending: 'Pending review',
  approved: 'Available to claim',
  redemption_requested: 'Redemption requested',
  issued: 'Redeemed / issued',
  held: 'Held for review',
  rejected: 'Rejected',
  available: 'Available to claim',
};

function rewardStatusLabel(status) {
  return rewardStatusLabels[status] || String(status || '').replaceAll('_', ' ');
}

export default function Earnings() {
  const queryClient = useQueryClient();
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
  const { data: voucherRequests = [] } = useQuery({
    queryKey: ['installer-voucher-requests', data?.user?.email],
    enabled: !!data?.user?.email,
    queryFn: () => base44.entities.VoucherRequest.filter(
      { installer_email: data.user.email },
      '-created_date',
      100
    ),
  });

  const requestVoucher = useMutation({
    mutationFn: () => base44.functions.invoke('request-voucher-v2', {}),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['install-claims'] });
      await queryClient.cancelQueries({ queryKey: ['installer-voucher-requests'] });
      const previousClaims = queryClient.getQueryData(['install-claims', data?.user?.email]);
      const previousRequests = queryClient.getQueryData(['installer-voucher-requests', data?.user?.email]);
      queryClient.setQueryData(['install-claims', data?.user?.email], (current = []) =>
        current.map((claim) => (
          claim.status === 'approved' && claim.reward_status === 'approved'
            ? { ...claim, reward_status: 'redemption_requested' }
            : claim
        )),
      );
      queryClient.setQueryData(['installer-voucher-requests', data?.user?.email], (current = []) => ([
        {
          id: `optimistic-${Date.now()}`,
          installer_email: data?.user?.email,
          status: 'requested',
          amount: 0,
          excluded_from_reporting: false,
        },
        ...current,
      ]));
      return { previousClaims, previousRequests };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['install-claims'] });
      await queryClient.invalidateQueries({ queryKey: ['installer'] });
      await queryClient.invalidateQueries({ queryKey: ['installer-voucher-requests'] });
      const response = result?.data || result;
      toast({
        title: response?.status === 'sent' ? 'Reward choices sent' : 'Reward requested',
        description: response?.message || 'FastAmps has received your reward request.',
      });
    },
    onError: (_err, _vars, context) => {
      if (context?.previousClaims) {
        queryClient.setQueryData(['install-claims', data?.user?.email], context.previousClaims);
      }
      if (context?.previousRequests) {
        queryClient.setQueryData(['installer-voucher-requests', data?.user?.email], context.previousRequests);
      }
      toast({
        title: 'Request failed',
        description: _err?.response?.data?.error || _err?.message || 'Could not request a reward just now.',
        variant: 'destructive',
      });
    },
  });

  if (loadingInstaller) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!installer) return <OnboardingCard user={data?.user} />;

  const activeClaims = claims.filter((claim) => !claim.excluded_from_reporting && !claim.is_demo);
  const approved = activeClaims.filter((claim) => claim.reward_status === 'approved' && claim.status === 'approved' && claim.serial_photo_url && claim.install_photo_url);
  const requested = activeClaims.filter((claim) => claim.reward_status === 'redemption_requested');
  const issued = activeClaims.filter((claim) => claim.reward_status === 'issued');
  const held = activeClaims.filter((claim) => claim.reward_status === 'held');
  const rejected = activeClaims.filter((claim) => claim.reward_status === 'rejected' || claim.status === 'rejected');
  const pending = activeClaims.filter((claim) => claim.reward_status === 'pending' && claim.status !== 'rejected');
  const accountHeld = ['held', 'blocked'].includes(installer.reward_account_status);
  const termsAccepted = installer.programme_terms_version === PROGRAMME_TERMS_VERSION && Boolean(installer.programme_terms_accepted_at);
  const activeVoucherRequest = voucherRequests.find((request) => (
    !request.excluded_from_reporting && ['requested', 'processing'].includes(request.status)
  ));
  const activeVoucherAmount = Number(activeVoucherRequest?.amount || 0);
  const activeRequestClaimIds = new Set(activeVoucherRequest?.claim_ids || []);
  const approvedInstallCount = new Set(
    activeClaims
      .filter((claim) => claim.status === 'approved' && !['held', 'rejected'].includes(claim.reward_status) && claim.serial_photo_url && claim.install_photo_url)
      .map((claim) => String(claim.serial_number || '').trim().toUpperCase())
      .filter(Boolean)
  ).size;
  const hasCompletedRedemption = voucherRequests.some(
    (request) => !request.excluded_from_reporting && request.status === 'sent'
  );
  const firstRedemptionInstallRequirementMet = hasCompletedRedemption || approvedInstallCount >= FIRST_REDEMPTION_INSTALLS;
  const welcomeAmount = installer.welcome_reward_amount || 10;
  const welcomeAvailable = installer.welcome_reward_status === 'available';
  const welcomeRequested = installer.welcome_reward_status === 'redemption_requested';
  const welcomeIssued = installer.welcome_reward_status === 'issued';
  const value = (rows) => rows.reduce((sum, claim) => sum + (claim.reward_amount || 0), 0);
  const referralCreditAvailable = Number(installer.referral_discounts_available || 0) * REFERRAL_CREDIT_VALUE;
  const referralCreditIssued = Number(installer.referral_discounts_redeemed || 0) * REFERRAL_CREDIT_VALUE;
  const activeReferralCreditUnits = voucherRequests
    .filter((request) => !request.excluded_from_reporting && ['requested', 'processing'].includes(request.status))
    .flatMap((request) => request.claim_ids || [])
    .filter((value) => String(value).startsWith('referral-credit-')).length;
  const referralCreditRequested = activeReferralCreditUnits * REFERRAL_CREDIT_VALUE;
  const eligibleValue = value(approved) + (welcomeAvailable ? welcomeAmount : 0) + referralCreditAvailable;
  const availableValue = accountHeld || !termsAccepted ? 0 : eligibleValue;
  const requestedValue = value(requested) + (welcomeRequested ? welcomeAmount : 0) + referralCreditRequested;
  const issuedValue = value(issued) + (welcomeIssued ? welcomeAmount : 0) + referralCreditIssued;
  const amountRemaining = Math.max(MINIMUM_REDEMPTION_AMOUNT - availableValue, 0);
  const walletRequirementMet = availableValue >= MINIMUM_REDEMPTION_AMOUNT;
  const canRequest = !activeVoucherRequest && !accountHeld && termsAccepted && walletRequirementMet && firstRedemptionInstallRequirementMet;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-accent">Your rewards</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Reward wallet</h1>
        <p className="mt-2 text-muted-foreground">A clear view of rewards waiting for review, approved and issued.</p>
      </div>

      {(accountHeld || !termsAccepted) && <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm">
        <ShieldAlert className="mr-2 inline h-4 w-4" />
        {accountHeld ? 'Your rewards are on FastAmps review hold. Available funds cannot be redeemed until the review is resolved.'
          : <>Read and accept the updated <Link to="/profile" className="font-semibold underline">programme terms in My Profile</Link> to redeem rewards.</>}
      </div>}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          ['Pending', value(pending), Clock3, 'text-amber-700 dark:text-amber-200'],
          ['Approved', eligibleValue, CheckCircle2, 'text-emerald-700 dark:text-emerald-200'],
          ['Held', value(held), ShieldAlert, 'text-amber-700 dark:text-amber-300'],
          ['Rejected', value(rejected), XCircle, 'text-destructive'],
          ['Requested', requestedValue, Gift, 'text-muted-foreground'],
          ['Redeemed', issuedValue, WalletCards, 'text-accent'],
        ].map(([label, amount, Icon, colour]) => (
          <div key={label} className="rounded-2xl border border-border bg-muted/60 p-4 md:p-6">
            <Icon className={`w-5 h-5 ${colour}`} />
            <div className="mt-4 text-2xl md:text-3xl font-semibold">£{amount.toLocaleString()}</div>
            <div className="mt-1 text-[10px] md:text-xs uppercase tracking-[0.14em] text-muted-foreground/70">{label}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5 flex items-start gap-4">
        <Gift className="w-6 h-6 text-accent shrink-0" />
        <div>
          <div className="font-semibold">
            {activeVoucherRequest
              ? `Your £${activeVoucherAmount.toLocaleString()} reward request is in progress`
              : 'Complete three installs and build your wallet to £30'}
          </div>
          <p className="mt-1 text-sm leading-6 text-foreground/70">
            {activeVoucherRequest
              ? `This is one £${activeVoucherAmount.toLocaleString()} reward request, combining your eligible installation rewards and welcome bonus. No separate £10 voucher has been claimed.`
              : 'Your first voucher unlocks only after three unique installations have been approved and your available wallet balance is at least £30. The £10 welcome bonus, installation rewards and £20 referral credits all build your balance, but they do not replace the three-installation requirement. After your first redemption, the normal £30 wallet minimum applies.'}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground/80">
            Gift card availability depends on the value you claim. Your balance is only moved out of available rewards after the provider accepts the order.
          </p>
          <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
            {activeVoucherRequest && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-accent/25 bg-accent/[0.08] px-3 py-2 text-xs">
                <span className="text-muted-foreground">Reward request</span>
                <strong className="text-accent">£{activeVoucherAmount.toLocaleString()} · {activeVoucherRequest.status === 'processing' ? 'Giftbit processing' : 'Awaiting FastAmps'}</strong>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Available wallet balance</span>
              <strong className={walletRequirementMet ? 'text-emerald-600 dark:text-emerald-300' : 'text-accent'}>£{availableValue.toLocaleString()} / £{MINIMUM_REDEMPTION_AMOUNT}</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min((availableValue / MINIMUM_REDEMPTION_AMOUNT) * 100, 100)}%` }} />
            </div>
            {!hasCompletedRedemption && (
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">First redemption installs</span>
                <strong className={firstRedemptionInstallRequirementMet ? 'text-emerald-600 dark:text-emerald-300' : 'text-accent'}>
                  {Math.min(approvedInstallCount, FIRST_REDEMPTION_INSTALLS)} / {FIRST_REDEMPTION_INSTALLS} approved
                </strong>
              </div>
            )}
            <div className="mt-2 text-xs font-medium text-accent">
              {activeVoucherRequest
                ? 'Your balance is already included in the reward request above. You cannot submit a second request while it is processing.'
                : canRequest
                  ? `Unlocked. Your full £${availableValue.toLocaleString()} balance can be claimed.`
                  : !firstRedemptionInstallRequirementMet
                    ? `${FIRST_REDEMPTION_INSTALLS - approvedInstallCount} more approved installation${FIRST_REDEMPTION_INSTALLS - approvedInstallCount === 1 ? '' : 's'} needed for your first voucher.`
                    : `Add £${amountRemaining.toLocaleString()} more to unlock voucher claims.`}
            </div>
          </div>
          <Button onClick={() => requestVoucher.mutate()} disabled={!!activeVoucherRequest || !canRequest || requestVoucher.isPending} className="mt-4 bg-primary text-white">
            {requestVoucher.isPending
              ? 'Requesting…'
              : activeVoucherRequest
                ? `£${activeVoucherAmount.toLocaleString()} reward request in progress`
                : canRequest
                  ? `Claim £${availableValue.toLocaleString()} reward choices`
                  : accountHeld ? 'Rewards on review hold'
                    : !termsAccepted ? 'Accept programme terms first'
                    : !firstRedemptionInstallRequirementMet
                      ? `Locked until ${FIRST_REDEMPTION_INSTALLS} approved installs`
                      : `Locked until £${MINIMUM_REDEMPTION_AMOUNT}`}
          </Button>
          {requestVoucher.isError && <p className="mt-2 text-xs text-destructive">{requestVoucher.error?.response?.data?.error || requestVoucher.error?.message}</p>}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground mb-4">Reward activity</h2>
        {isLoading ? <div className="text-sm text-muted-foreground">Loading rewards…</div> : (
          <div className="rounded-2xl border border-border bg-muted/60 divide-y divide-border">
            {installer.welcome_reward_status && (
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium">£10 installer welcome bonus</div>
                  <div className="mt-1 text-xs text-muted-foreground/70">Added when your FastAmps installer profile was created</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">£{welcomeAmount}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.13em] text-accent">
                    {activeVoucherRequest?.includes_welcome_reward
                      ? `Included in £${activeVoucherAmount.toLocaleString()} reward request`
                      : rewardStatusLabel(installer.welcome_reward_status)}
                  </div>
                </div>
              </div>
            )}
            {(Number(installer.qualified_referrals || 0) > 0 || referralCreditAvailable > 0 || referralCreditRequested > 0 || referralCreditIssued > 0) && (
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Referral voucher credit</div>
                  <div className="mt-1 text-xs text-muted-foreground/70">£20 after each referred installer completes five unique approved installations</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">£{referralCreditAvailable + referralCreditRequested + referralCreditIssued}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.13em] text-accent">
                    {[
                      referralCreditAvailable > 0 ? `£${referralCreditAvailable} available` : '',
                      referralCreditRequested > 0 ? `£${referralCreditRequested} requested` : '',
                      referralCreditIssued > 0 ? `£${referralCreditIssued} issued` : '',
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
            )}
            {activeClaims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{claim.product_model} · {claim.serial_number}</div>
                  <div className="mt-1 text-xs text-muted-foreground/70">Submitted {new Date(claim.created_date).toLocaleDateString('en-GB')} · Warranty {claim.warranty_status}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">£{claim.reward_amount || 10}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.13em] text-accent">
                    {activeRequestClaimIds.has(claim.id)
                      ? `Included in £${activeVoucherAmount.toLocaleString()} reward request`
                      : rewardStatusLabel(claim.reward_status)}
                  </div>
                </div>
              </div>
            ))}
            {activeClaims.length === 0 && !installer.welcome_reward_status && <div className="px-5 py-8 text-center text-sm text-muted-foreground/80">No rewards yet. Register your first installation to begin.</div>}
          </div>
        )}
      </section>
    </div>
  );
}