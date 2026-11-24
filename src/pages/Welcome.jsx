import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ClipboardList, LogIn, Store } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';

export default function Welcome() {
  const [params] = useSearchParams();
  const invite = params.get('invite') || '';
  const joinTo = invite
    ? `/register?intent=join&invite=${encodeURIComponent(invite)}`
    : '/register?intent=join';
  const preRegTo = invite
    ? `/pre-register?invite=${encodeURIComponent(invite)}`
    : '/pre-register';

  return (
    <AuthLayout
      title="FastAmps Connect"
      subtitle="Installer rewards for eligible FastAmps charger installations across the UK."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
            <Store className="h-3.5 w-3.5" /> Active installer programme
          </div>
          <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
            Purchased a FastAmps charger through a participating electrical wholesaler? Join FastAmps Connect and start earning rewards for your installations.
          </p>
          <Button asChild className="mt-4 w-full h-12 font-semibold">
            <Link to={joinTo}>
              Join FastAmps Connect
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Initially Links Electrical, Shrewsbury is the controlled beta branch once FastAmps authorises activation.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent font-semibold">
            <ClipboardList className="h-3.5 w-3.5" /> Nationwide pre-registration
          </div>
          <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
            FastAmps Connect is rolling out across the UK. Register your interest and we&apos;ll notify you when the programme becomes available in your area.
          </p>
          <Button asChild variant="outline" className="mt-4 w-full h-12 font-semibold">
            <Link to={preRegTo}>
              Pre-register your interest
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>

        <Button asChild variant="ghost" className="w-full h-11">
          <Link to="/login">
            <LogIn className="mr-2 h-4 w-4" />
            Sign in to an existing account
          </Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
