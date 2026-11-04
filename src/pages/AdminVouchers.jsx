import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, Gift, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { Button } from '@/components/ui/button';
import { formatStatus } from '@/utils/formatStatus';

export default function AdminVouchers() {
  const queryClient = useQueryClient();
  const { data: identity, isLoading: loadingIdentity } = useInstaller();
  const isAdmin = identity?.user?.role === 'admin';
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-voucher-requests'],
    enabled: isAdmin,
    queryFn: () => base44.entities.VoucherRequest.list('-created_date', 250),
  });

  const action = useMutation({
    mutationFn: async ({ request, action: actionName }) => {
      const response = await base44.functions.invoke('admin-voucher-action', {
        request_id: request.id,
        action: actionName,
      });
      return response.data;
    },
    onMutate: async ({ request, action: actionName }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-voucher-requests'] });
      const previous = queryClient.getQueryData(['admin-voucher-requests']);
      const optimisticStatus = actionName === 'manual_sent' || actionName === 'send'
        ? 'processing'
        : actionName === 'refresh'
          ? request.status
          : request.status;
      queryClient.setQueryData(['admin-voucher-requests'], (current = []) =>
        current.map((row) => (row.id === request.id
          ? { ...row, status: optimisticStatus, provider_status: actionName === 'refresh' ? 'checking…' : row.provider_status }
          : row)),
      );
      return { previous };
    },
    onSuccess: async (result) => {
      toast.success(result.message || 'Voucher request updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-voucher-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-install-claims'] });
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['admin-voucher-requests'], context.previous);
      toast.error(error?.response?.data?.error || error?.message || 'Voucher action failed.');
    },
  });

  const runAction = (request, actionName) => {
    if (actionName === 'manual_sent' && !window.confirm(
      `Only continue if a £${Number(request.amount).toLocaleString()} reward has already been sent outside Giftbit. Mark it as sent?`,
    )) return;
    action.mutate({ request, action: actionName });
  };

  if (loadingIdentity) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin) return (
    <div className="rounded-2xl border border-border bg-muted/60 p-8">
      <h1 className="text-xl font-semibold">FastAmps team access only</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your account does not have permission to manage voucher requests.</p>
    </div>
  );

  const activeRequests = requests.filter((request) => !request.excluded_from_reporting);
  const outstanding = activeRequests.filter((request) => request.status !== 'sent');

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps team</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Voucher requests</h1>
        <p className="mt-2 text-muted-foreground">{outstanding.length} reward request{outstanding.length === 1 ? '' : 's'} need attention. Giftbit campaigns can be checked and managed here without creating duplicates.</p>
      </div>

      {isLoading ? <div className="text-sm text-muted-foreground">Loading voucher requests…</div> : (
        <div className="space-y-3">
          {activeRequests.map((request) => {
            const busy = action.isPending && action.variables?.request?.id === request.id;
            const waitingForFunds = request.provider_status?.includes('FUNDS') || request.provider_status === 'AWAITING_FUNDS';
            return (
              <article key={request.id} className="rounded-2xl border border-border bg-muted/60 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Gift className="h-5 w-5 text-accent" />
                      <h2 className="font-semibold">{request.installer_name || request.installer_email}</h2>
                      {request.is_demo && <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-200">{request.demo_label || 'BETA-DEMO'}</span>}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{request.installer_email} · {request.installer_mobile}</p>
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      {request.claim_ids?.length || 0} installation reward{request.claim_ids?.length === 1 ? '' : 's'} in this claim
                      {request.includes_welcome_reward ? ' plus £10 welcome bonus' : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      {request.eligible_approved_install_count ?? request.claim_ids?.length ?? 0} total approved installation{(request.eligible_approved_install_count ?? request.claim_ids?.length ?? 0) === 1 ? '' : 's'} when requested · 3 required before first redemption
                    </p>
                    {waitingForFunds && (
                      <div className="mt-3 max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                        {request.provider_environment === 'testbed'
                          ? <>Giftbit Testbed is holding this GBP campaign because its virtual funding does not cover this test currency. Do not resend it. The live UK account will be tested separately with production permissions.</>
                          : <>Giftbit accepted this campaign, but the live account needs available funds. Do not resend it. Add funds in Giftbit, then use <strong>Check Giftbit status</strong>.</>}
                      </div>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <div className="text-2xl font-semibold">£{(request.amount || 0).toLocaleString()}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs uppercase tracking-[0.13em] text-muted-foreground/80 sm:justify-end">
                      {request.status === 'sent' ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <Clock3 className="h-4 w-4 text-amber-700 dark:text-amber-200" />}
                      {request.status}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground/70">
                      {request.fulfilment_provider === 'giftbit'
                        ? `Giftbit ${request.provider_environment === 'live' ? 'Live' : 'Testbed'}`
                        : 'Manual fulfilment'}
                      {request.provider_status ? ` · ${formatStatus(request.provider_status)}` : ''}
                    </div>
                    {request.fraud_review_status === 'held' && <div className="mt-2 max-w-sm text-xs font-semibold text-amber-700 dark:text-amber-300">Held for fraud review. Do not send.</div>}
                    {request.provider_error && <div className="mt-2 max-w-sm text-xs text-destructive">{request.provider_error}</div>}
                    {request.actioned_by_email && <div className="mt-2 text-[11px] text-muted-foreground/70">Last action: {request.actioned_by_name || request.actioned_by_email}</div>}
                  </div>
                </div>

                {request.status !== 'sent' && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button asChild variant="outline" className="min-h-11"><Link to="/admin/fraud-review">Fraud hold / review</Link></Button>
                    {request.fulfilment_provider === 'giftbit' && request.status === 'processing' && (
                      <Button onClick={() => runAction(request, 'refresh')} disabled={busy} className="min-h-11">
                        <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                        Check Giftbit status
                      </Button>
                    )}
                    {['requested', 'failed'].includes(request.status) && (
                      <Button onClick={() => runAction(request, 'send')} disabled={busy || request.fraud_review_status === 'held'} className="min-h-11 bg-sky-600 text-white hover:bg-sky-500">
                        <Send className="mr-2 h-4 w-4" />Send with Giftbit
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => runAction(request, 'manual_sent')} disabled={busy} className="min-h-11">
                      <CheckCircle2 className="mr-2 h-4 w-4" />Mark as sent manually
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
          {activeRequests.length === 0 && <div className="rounded-2xl border border-border bg-muted/60 p-8 text-center text-sm text-muted-foreground/80">No voucher requests yet.</div>}
        </div>
      )}
    </div>
  );
}