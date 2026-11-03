import { CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';

const installerSteps = [
  'Scan the charger QR code with the installer phone',
  'Register or sign in and return to the linked charger',
  'Confirm the charger model, serial number and PIN',
  'Take a photo or choose one from the phone gallery',
  'Enter the date, verified postcode and wholesaler details',
  'Confirm the declaration and submit the claim',
  'Open My installs and review the claim status',
  'Return to Register to add another charger',
];

const adminSteps = [
  'Open Overview and explain the live programme indicators',
  'Open Review installs and inspect the photo and claim details',
  'Add a clear note and request more information',
  'Approve a completed claim and register its warranty',
  'Check reward status and the voucher queue',
  'Open QR batches and inspect or download a charger label',
  'Open Reports and demonstrate the date filters and CSV export',
];

export default function BetaMeetingGuide() {
  return (
    <section className="rounded-3xl border border-sky-400/25 bg-sky-400/[0.06] p-6 md:p-8">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-sky-600 dark:text-sky-300" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-sky-700 dark:text-sky-200">Meeting run-through</div>
          <h2 className="mt-1 text-xl font-semibold">Alan and Kara admin onboarding</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Give each person a separate named account, promote both accounts to admin, then sign out and back in before starting.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background/70 p-5">
          <div className="flex items-center gap-2 font-semibold"><Smartphone className="h-5 w-5 text-accent" />Installer journey</div>
          <ol className="mt-4 space-y-3">
            {installerSteps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-foreground/80">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-accent">{index + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 p-5">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-accent" />Administrator journey</div>
          <ol className="mt-4 space-y-3">
            {adminSteps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-foreground/80">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-accent">{index + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Records marked BETA-DEMO are training examples. They are deliberately separated from retired legacy tests and future live installer submissions.
      </p>
    </section>
  );
}
