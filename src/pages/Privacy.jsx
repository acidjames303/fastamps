import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';

const FASTAMPS_PRIVACY_URL = 'https://www.fastamps.com/privacy-policy';

export default function Privacy() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground font-body">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/login" className="inline-flex items-center gap-3 text-sm text-accent underline-offset-2 hover:underline">
          <BrandLogo className="h-10 w-auto" />
          <span>Back to FastAmps Connect</span>
        </Link>
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">FastAmps Connect</p>
          <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
          <p className="text-sm text-muted-foreground">
            FastAmps Connect is operated by FastAmps. Personal data handling follows the official FastAmps privacy notice.
          </p>
        </header>

        <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5 space-y-3">
          <h2 className="text-lg font-semibold">Official privacy notice</h2>
          <p className="text-sm text-foreground/80">
            Read the current FastAmps Privacy and Cookie Policy on the FastAmps website. That notice is the authoritative privacy statement for FastAmps services, including Connect.
          </p>
          <a
            href={FASTAMPS_PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Open FastAmps privacy policy
          </a>
        </section>

        <section className="space-y-3 text-sm leading-6 text-foreground/80">
          <h2 className="text-lg font-semibold text-foreground">How Connect uses data</h2>
          <p>
            Connect processes installer account details, contact information, charger serial numbers and PINs, installation claim records, and installation photographs to verify registrations, administer rewards, prevent abuse, and keep an audit trail. Only provide images and details you are permitted to share.
          </p>
          <p>
            Account deletion is available from your profile after you sign in. Approved installation records may be retained for warranty and audit purposes, as described in the product experience and the FastAmps privacy notice.
          </p>
          <p>
            For questions about personal data, use the contact routes published on{' '}
            <a href="https://www.fastamps.com/" className="text-accent underline" target="_blank" rel="noopener noreferrer">fastamps.com</a>
            {' '}or in the privacy policy.
          </p>
        </section>

        <nav className="flex flex-wrap gap-4 border-t border-border pt-5 text-sm">
          <Link to="/terms" className="text-accent underline">Terms</Link>
          <Link to="/programme-terms" className="text-accent underline">Programme terms</Link>
          <Link to="/login" className="text-accent underline">Sign in</Link>
        </nav>
      </div>
    </main>
  );
}
