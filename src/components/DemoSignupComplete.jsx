import { Link } from 'react-router-dom';
import { KeyRound, ScanLine, Sparkles, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Shown to a demo installer after sign-up so they continue into a real charger
// scan / manual serial+PIN path rather than inventing a stand auto-claim.
export default function DemoSignupComplete({ onScan, onManual }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps Connect</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">You're signed up</h1>
        <p className="mt-2 text-muted-foreground">
          Your installer account is ready and your £10 welcome bonus is active in your wallet.
        </p>
      </div>

      <div className="rounded-3xl border border-accent/30 bg-accent/10 p-5 sm:p-6">
        <Sparkles className="h-6 w-6 text-accent" />
        <div className="mt-3 font-semibold">Demo installer account</div>
        <p className="mt-2 text-sm leading-6 text-foreground/80">
          An installation can only be submitted against a charger that is in the FastAmps register. Scan a charger label QR, or enter its serial number and PIN. Anything submitted from a demo account is reviewed but never paid.
        </p>
      </div>

      <div className="grid gap-3">
        <Button onClick={onScan} className="h-12 w-full bg-primary font-semibold text-white">
          <ScanLine className="mr-2 h-4 w-4" />Scan a charger QR code
        </Button>
        <Button asChild variant="outline" className="h-12 w-full border-border">
          <Link to="/earnings"><Wallet className="mr-2 h-4 w-4" />View my rewards</Link>
        </Button>
        <Button type="button" variant="ghost" onClick={onManual} className="h-11 w-full text-muted-foreground">
          <KeyRound className="mr-2 h-4 w-4" />Enter a charger serial and PIN instead
        </Button>
      </div>
    </div>
  );
}
