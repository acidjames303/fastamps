import { useEffect } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, QrCode, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { rememberPendingClaimPath, clearPendingClaimPath } from '@/lib/authReturnTo';
import { Button } from '@/components/ui/button';

export default function ChargerClaimEntry() {
  const { claimToken } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const params = new URLSearchParams(location.search);
  // Older labels carry the serial and PIN in the link rather than a claim token.
  const serialParam = (params.get('serial') || params.get('s') || '').trim().toUpperCase();
  const pinParam = (params.get('pin') || params.get('p') || '').trim();
  const hasReference = Boolean(claimToken) || (serialParam && /^\d{6}$/.test(pinParam));

  // Keep the claim destination across login/register/OAuth/refresh.
  useEffect(() => {
    if (!hasReference) return;
    const search = new URLSearchParams(location.search);
    search.delete('demo');
    const qs = search.toString();
    rememberPendingClaimPath(`${location.pathname}${qs ? `?${qs}` : ''}`);
  }, [hasReference, location.pathname, location.search]);

  useEffect(() => {
    if (isAuthenticated && hasReference) clearPendingClaimPath();
  }, [isAuthenticated, hasReference]);

  const { data: charger, isPending, error } = useQuery({
    queryKey: ['charger-entry', claimToken, serialParam, pinParam],
    enabled: !isAuthenticated && hasReference,
    retry: false,
    queryFn: async () => {
      const response = await base44.functions.invoke('resolve-charger-claim', {
        claim_token: claimToken,
        serial_number: serialParam,
        pin_code: pinParam,
      });
      return response.data.charger;
    },
  });

  if (isAuthenticated) return <Outlet />;

  if (!hasReference) {
    return (
      <main className="min-h-dvh bg-background px-5 py-12 text-foreground font-body">
        <section className="mx-auto max-w-md space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">FastAmps Connect</div>
          <QrCode className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-semibold">That code does not identify a charger</h1>
          <p className="text-sm text-muted-foreground">
            This link is a general website address. Scan the QR code printed on the charger label, or sign in and enter the charger&apos;s serial number and PIN.
          </p>
          <Button asChild className="h-12 w-full"><Link to="/login">Sign in and enter the charger details</Link></Button>
        </section>
      </main>
    );
  }

  const search = new URLSearchParams(location.search);
  search.delete('demo');
  const cleanedSearch = search.toString();
  const returnTo = encodeURIComponent(`${location.pathname}${cleanedSearch ? `?${cleanedSearch}` : ''}`);
  return (
    <main className="min-h-dvh bg-background px-5 py-12 text-foreground font-body">
      <section className="mx-auto max-w-md space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">FastAmps Connect</div>
        {isPending ? <div className="flex items-center gap-3 py-6" role="status"><Loader2 className="h-5 w-5 animate-spin text-primary" />Finding your charger…</div> : error ? <div role="alert"><h1 className="text-xl font-semibold">Charger could not be opened</h1><p className="mt-3 text-sm text-muted-foreground">{error.response?.data?.error || error.message}</p><p className="mt-3 text-sm text-muted-foreground">Ask the FastAmps team for a current charger QR code.</p><Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Try again</Button></div> : (
          <>
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold">Your charger is ready</h1>
            <dl className="space-y-3 rounded-2xl bg-muted p-4 text-sm">
              <div><dt className="text-muted-foreground">Model</dt><dd className="font-semibold">{charger.product_model}</dd></div>
              <div><dt className="text-muted-foreground">Serial number</dt><dd className="break-all font-semibold">{charger.serial_number}</dd></div>
            </dl>
            <p className="text-sm text-muted-foreground">
              Create an account or sign in to continue with this charger. After authentication you will add your two installation photos. Keep the physical label handy — its six-digit PIN is required to submit.
            </p>
            {charger.is_demo && <p className="text-xs text-muted-foreground">Demo charger — installation claims from this unit are reviewed but never paid.</p>}
            <Button asChild className="h-12 w-full"><Link to={`/register?returnTo=${returnTo}`}>Create account and continue</Link></Button>
            <Button asChild variant="outline" className="h-12 w-full"><Link to={`/login?returnTo=${returnTo}`}>Sign in and continue</Link></Button>
          </>
        )}
      </section>
    </main>
  );
}
