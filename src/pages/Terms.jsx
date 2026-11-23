import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import ProgrammeTerms from '@/pages/ProgrammeTerms';

const FASTAMPS_TERMS_URL = 'https://www.fastamps.com/terms-conditions';

export default function Terms() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground font-body">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/login" className="inline-flex items-center gap-3 text-sm text-accent underline-offset-2 hover:underline">
          <BrandLogo className="h-10 w-auto" />
          <span>Back to FastAmps Connect</span>
        </Link>
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">FastAmps Connect</p>
          <h1 className="text-3xl font-semibold tracking-tight">Terms</h1>
          <p className="text-sm text-muted-foreground">
            Use of FastAmps Connect is subject to FastAmps website terms and the installer programme terms below. This page does not replace FastAmps legal review of those published documents.
          </p>
        </header>

        <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5 space-y-3">
          <h2 className="text-lg font-semibold">FastAmps website terms</h2>
          <p className="text-sm text-foreground/80">
            The general FastAmps terms and conditions published on fastamps.com apply to FastAmps products and services.
          </p>
          <a
            href={FASTAMPS_TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Open FastAmps terms &amp; conditions
          </a>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Connect installer and referral programme</h2>
          <p className="text-sm text-muted-foreground">
            Installers who enrol in Connect must also accept these programme terms. They govern installation claims, referrals and rewards.
          </p>
          <ProgrammeTerms embedded />
        </section>

        <nav className="flex flex-wrap gap-4 border-t border-border pt-5 text-sm">
          <Link to="/privacy" className="text-accent underline">Privacy</Link>
          <Link to="/programme-terms" className="text-accent underline">Programme terms only</Link>
          <Link to="/login" className="text-accent underline">Sign in</Link>
          <Link to="/register" className="text-accent underline">Create account</Link>
        </nav>
      </div>
    </main>
  );
}
