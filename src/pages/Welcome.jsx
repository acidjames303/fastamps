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
      subtitle="Earn rewards for eligible FastAmps charger installations."
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
            <Store className="h-3.5 w-3.5" /> Active programme
          </div>
          <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
            Bought a FastAmps charger from a participating wholesaler? Join and start earning.
          </p>
          <Button asChild className="mt-4 w-full h-12 font-semibold">
            <Link to={joinTo}>
              Join FastAmps Connect
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>

        <section className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent font-semibold">
            <ClipboardList className="h-3.5 w-3.5" /> Nationwide interest list
          </div>
          <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
            Not near an active branch yet? Register your interest and we&apos;ll tell you when it opens in your area.
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
            Sign in
          </Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
