import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Loader2, QrCode, Store } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';

export default function ProgrammeInvite() {
  const { programmeCode = '' } = useParams();
  const code = decodeURIComponent(programmeCode).trim().toLowerCase();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await base44.functions.invoke('manage-incentive-programme', {
          action: 'public_invite',
          programme_code: code,
        });
        const data = response?.data || response;
        if (!cancelled) setState({ loading: false, ...data });
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            found: false,
            active: false,
            message: error?.message || 'This invitation could not be loaded.',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (state.loading) {
    return (
      <AuthLayout title="Checking invitation" subtitle="Please wait…">
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  const active = Boolean(state.active);
  const title = active ? 'Join the installer programme' : 'Programme not active yet';
  const joinPath = `/register?intent=join&invite=${encodeURIComponent(code)}`;
  const preRegPath = `/pre-register?invite=${encodeURIComponent(code)}`;

  return (
    <AuthLayout
      icon={QrCode}
      title={title}
      subtitle={state.message}
      footer={
        <>
          Prefer the main options?{' '}
          <Link to="/welcome" className="text-primary font-medium hover:underline">Open welcome</Link>
        </>
      }
    >
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
          <Store className="h-3.5 w-3.5" /> Programme invitation
        </div>
        <div className="mt-3 text-sm">
          <div className="font-medium">{state.name || 'FastAmps Connect programme'}</div>
          {(state.wholesaler_name || state.branch_name) ? (
            <div className="mt-1 text-muted-foreground">
              {state.wholesaler_name}{state.branch_name ? ` – ${state.branch_name}` : ''}
            </div>
          ) : null}
          <div className="mt-2 text-xs text-muted-foreground">
            This invitation identifies the participating programme. It does not prove a charger purchase or authorise a reward by itself.
          </div>
        </div>
      </div>

      {active ? (
        <div className="mt-4 space-y-3">
          <Button asChild className="w-full h-12 font-semibold">
            <Link to={joinPath}>
              Join FastAmps Connect
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-12">
            <Link to={`/login?returnTo=${encodeURIComponent('/')}`}>Sign in</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Button asChild className="w-full h-12 font-semibold">
            <Link to={preRegPath}>
              Pre-register your interest
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The Links Electrical Shrewsbury controlled beta remains inactive until FastAmps authorises genuine charger codes and programme activation.
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
