import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { createClaimUrl, STATIC_WEBSITE_URL } from '@/lib/appUrl';
import { createBrandedQrLabel } from '@/lib/qrLabel';
import { formatStatus } from '@/utils/formatStatus';

// Show the real reason the register refused the charger instead of the raw 409 status.
function creationErrorText(error) {
  const data = error?.response?.data;
  const details = (Array.isArray(data?.issues) ? data.issues : [])
    .map((issue) => issue?.message)
    .filter(Boolean)
    .join(' ');
  return details || data?.error || error?.message || 'Test charger creation failed. Please try again.';
}

function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function stageState(charger, claim) {
  return [
    { label: 'Test charger created', complete: Boolean(charger) },
    { label: 'Installer claim submitted', complete: Boolean(claim) },
    { label: 'Two evidence photos uploaded', complete: Boolean(claim?.serial_photo_url && claim?.install_photo_url) },
    { label: 'Admin reviewed warranty and installation', complete: claim?.status === 'approved' },
    { label: 'Demo reward approved (non-payable)', complete: claim?.status === 'approved' && claim?.reward_status === 'approved' },
  ];
}

export default function AdminBetaTest() {
  const queryClient = useQueryClient();
  const { data: identity, isLoading: loadingIdentity } = useInstaller();
  const isAdmin = identity?.user?.role === 'admin';
  const [serial, setSerial] = useState(() => `BETA-${Date.now().toString().slice(-8)}`);
  const [pin, setPin] = useState(randomPin);
  const [selectedId, setSelectedId] = useState('');
  const [specificQr, setSpecificQr] = useState('');
  const [websiteQr, setWebsiteQr] = useState('');

  const { data: chargers = [], isLoading: loadingChargers } = useQuery({
    queryKey: ['home-beta-chargers'],
    enabled: isAdmin,
    queryFn: () => base44.entities.Charger.list('-created_date', 100),
    refetchInterval: 4000,
  });

  const betaChargers = useMemo(
    () => chargers.filter((charger) => String(charger.batch_reference || '').startsWith('HOME-BETA')),
    [chargers],
  );
  const charger = selectedId === 'new'
    ? null
    : betaChargers.find((item) => item.id === selectedId) || betaChargers[0] || null;

  const { data: claims = [], isLoading: loadingClaim, refetch } = useQuery({
    queryKey: ['home-beta-claim', charger?.id],
    enabled: isAdmin && Boolean(charger?.id),
    queryFn: () => base44.entities.InstallClaim.filter(
      { charger_record_id: charger.id },
      '-created_date',
      5,
    ),
    refetchInterval: 4000,
  });
  const claim = claims[0] || null;

  const { data: templates = [] } = useQuery({
    queryKey: ['qr-fixed-label-template'],
    enabled: isAdmin,
    queryFn: () => base44.entities.QrLabelTemplate.list('-created_date', 5),
  });
  const template = templates[0] || null;

  useEffect(() => {
    const makeQrs = async () => {
      const plainQr = (url) => QRCode.toDataURL(url, {
        width: 720,
        margin: 2,
        color: { dark: '#071b31', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      const specific = charger?.claim_token
        // The printed label always uses the approved artwork, exactly like production.
        ? await createBrandedQrLabel({
            claimUrl: createClaimUrl(charger.claim_token),
            serialNumber: charger.serial_number,
            pinCode: charger.pin_code,
            productModel: charger.product_model,
            templateUrl: template?.image_url || null,
          }).catch(() => plainQr(createClaimUrl(charger.claim_token)))
        : '';
      const website = await plainQr(STATIC_WEBSITE_URL);
      setSpecificQr(specific);
      setWebsiteQr(website);
    };
    makeQrs().catch(() => {
      setSpecificQr('');
      setWebsiteQr('');
    });
  }, [charger?.claim_token, charger?.serial_number, charger?.pin_code, template?.image_url]);

  const createTest = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('import-charger-batch', {
        action: 'import', single: true, is_demo: true,
        batch_reference: `HOME-BETA-${new Date().toISOString().slice(0,10)}`,
        qr_generated: true,
        rows: [{ serial_number: serial.trim().toUpperCase(), pin_code: pin.trim(),
          product_model: 'Alpha 7' }],
      }).catch((error) => {
        throw new Error(creationErrorText(error));
      });
      const result = response?.data || response;
      if (!result.success || result.created_count !== 1)
        throw new Error(result.error || 'Test charger creation was not confirmed.');
      return result.chargers[0];
    },
    onSuccess: async (created) => {
      setSelectedId(created.id);
      await queryClient.invalidateQueries({ queryKey: ['home-beta-chargers'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-chargers'] });
      toast({ title: 'Beta charger ready', description: 'Scan the charger-specific QR with a separate installer session. The static website QR must only open the public Connect homepage.' });
    },
  });

  const copy = async (value, label) => {
    await navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  };

  const downloadQr = (dataUrl, filename) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  if (loadingIdentity) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!isAdmin) return (
    <div className="rounded-2xl border border-border bg-muted/60 p-8">
      <h1 className="text-xl font-semibold">FastAmps team access only</h1>
      <p className="mt-2 text-sm text-muted-foreground">Only an administrator can run the beta-test journey.</p>
    </div>
  );

  const specificUrl = charger ? createClaimUrl(charger.claim_token) : '';
  const stages = stageState(charger, claim);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps team</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Home beta test</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
Test real installer registration and warranty evidence using a deliberately marked demo charger. Demo claims are excluded from payable rewards. Record outcomes in the separate QA checklist.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild><Link to="/admin/qa">Open 36-step QA checklist</Link></Button>
        <Button variant="outline" asChild><Link to="/admin/fraud-review">Open fraud review</Link></Button>
      </div>

      <section className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-5">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-200" />
          <div>
            <div className="font-semibold text-amber-900 dark:text-amber-100">Use two separate sessions</div>
            <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-100/65">
              Keep this admin screen open on your computer. Scan the QR with your phone and sign in using a separate installer account. Alternatively, open the installer link in a private browser window. A normal new tab shares your admin login and will not simulate the real installer experience.
            </p>
          </div>
        </div>
      </section>

      {!charger ? (
        <section className="max-w-2xl rounded-3xl border border-border bg-muted/60 p-6 md:p-8">
          <h2 className="text-xl font-semibold">1. Create a test charger</h2>
          <p className="mt-2 text-sm text-muted-foreground">Creates a registered charger marked HOME-BETA. It can be scanned and reviewed but its installation claim is excluded from real reward payouts.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="beta-serial">Test serial number</Label>
              <Input id="beta-serial" value={serial} onChange={(event) => setSerial(event.target.value)} className="mt-2 h-12 bg-background border-border" />
            </div>
            <div>
              <Label htmlFor="beta-pin">Unique test PIN</Label>
              <Input id="beta-pin" value={pin} onChange={(event) => setPin(event.target.value)} inputMode="numeric" className="mt-2 h-12 bg-background border-border" />
            </div>
          </div>
          <Button
            onClick={() => createTest.mutate()}
            disabled={createTest.isPending || !serial.trim() || !pin.trim()}
            className="mt-6 h-12 bg-primary text-white"
          >
            {createTest.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating test...</> : <><QrCode className="mr-2 h-4 w-4" />Create test charger and QR codes</>}
          </Button>
          {createTest.isError && <p className="mt-3 text-sm text-destructive">{createTest.error?.message}</p>}
        </section>
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
            <article className="rounded-3xl border border-border bg-muted/60 p-6">
              <div className="text-[11px] uppercase tracking-[0.18em] text-accent">Current test charger</div>
              <div className="mt-4 text-2xl font-semibold">{charger.serial_number}</div>
              <div className="mt-2 flex items-center gap-2 text-foreground/80"><KeyRound className="h-4 w-4 text-accent" />PIN {charger.pin_code}</div>
              <div className="mt-5 rounded-xl bg-black/[0.04] dark:bg-black/15 p-4 text-sm">
                <div className="text-muted-foreground/80">Charger status</div>
                <div className="mt-1 font-semibold capitalize">{charger.claim_status}</div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedId('new');
                  setSerial(`BETA-${Date.now().toString().slice(-8)}`);
                  setPin(randomPin());
                }}
                className="mt-5 w-full border-border bg-background"
              >
                Create another test
              </Button>
            </article>

            <article className="rounded-3xl border border-border bg-muted/60 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Live test progress</h2>
                  <p className="mt-1 text-sm text-muted-foreground">This screen refreshes automatically as the installer completes each step.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh test status">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-6 space-y-3">
                {stages.map((stage, index) => (
                  <div key={stage.label} className="flex items-center gap-3 rounded-xl border border-border bg-black/[0.03] dark:bg-black/10 p-3">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${stage.complete ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200' : 'bg-muted text-muted-foreground/50'}`}>
                      {stage.complete ? <Check className="h-4 w-4" /> : <span className="text-xs">{index + 1}</span>}
                    </div>
                    <span className={stage.complete ? 'text-foreground' : 'text-muted-foreground/80'}>{stage.label}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section>
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">2. Test the installer entry route</div>
              <h2 className="mt-1 text-xl font-semibold">Charger claim QR vs static website QR</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The charger-specific QR must identify this unique unit. The trade-show / marketing QR is a static website link only and must never create a claim.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {[
                {
                  title: 'Charger-specific QR',
                  description: 'Resolves this unique claim token to the beta charger. Installer then uploads two evidence photos.',
                  qr: specificQr,
                  url: specificUrl,
                  filename: `FastAmps-beta-${charger.serial_number}-warranty-label.png`,
                },
                {
                  title: 'Static website QR',
                  description: 'Trade-show / marketing QR. Opens https://connect.fastamps.com only — no charger claim, installation, warranty or reward.',
                  qr: websiteQr,
                  url: STATIC_WEBSITE_URL,
                  filename: 'FastAmps-website-QR.png',
                },
              ].map((route) => (
                <article key={route.title} className="rounded-3xl border border-border bg-muted/60 p-6 text-center">
                  <h3 className="text-lg font-semibold">{route.title}</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{route.description}</p>
                  {route.qr ? <img src={route.qr} alt={route.title} className="mx-auto mt-5 w-full max-w-56 rounded-xl bg-white p-2" /> : <Loader2 className="mx-auto mt-8 h-7 w-7 animate-spin text-accent" />}
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <Button variant="outline" onClick={() => downloadQr(route.qr, route.filename)} disabled={!route.qr} className="border-border bg-background">Download</Button>
                    <Button variant="outline" onClick={() => copy(route.url, 'Link')} disabled={!route.url} className="border-border bg-background"><Clipboard className="mr-2 h-4 w-4" />Copy</Button>
                    {route.url ? (
                      <Button asChild className="bg-primary text-white"><a href={route.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open</a></Button>
                    ) : (
                      <Button disabled variant="outline" className="border-border bg-background">Not set up</Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-muted/60 p-6 md:p-8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">3. Review as FastAmps</div>
            {loadingChargers || loadingClaim ? (
              <div className="mt-5 text-sm text-muted-foreground">Checking for the installer claim...</div>
            ) : !claim ? (
              <div className="mt-5 rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-8 text-center">
                <Smartphone className="mx-auto h-8 w-8 text-accent" />
                <div className="mt-3 font-semibold">Waiting for the installer submission</div>
                <p className="mt-1 text-sm text-muted-foreground">Scan the charger-specific QR with a separate installer account, submit both installation photos, then use normal admin review to check the claim.</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-5 lg:grid-cols-[180px_1fr]">
                <div className="space-y-2">
                  <img src={claim.serial_photo_url} alt="Beta charger serial label evidence" loading="lazy" decoding="async" width="720" height="520" className="h-40 w-full rounded-2xl border border-border object-contain bg-muted" />
                  <img src={claim.install_photo_url} alt="Beta finished installation evidence" loading="lazy" decoding="async" width="720" height="520" className="h-40 w-full rounded-2xl border border-border object-contain bg-muted" />
                </div>
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{claim.installer_name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{claim.installer_email} · {claim.site_postcode}</p>
                    </div>
                    <div className="rounded-full bg-muted px-3 py-1 text-xs capitalize text-accent">{claim.status.replace('_', ' ')}</div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-foreground/80 sm:grid-cols-2">
                    <span>Warranty: {claim.warranty_status}</span>
                    <span>Reward: £{claim.reward_amount || 10} · {formatStatus(claim.reward_status)}</span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild className="bg-primary text-white">
                      <Link to={`/admin/installs?claim=${encodeURIComponent(claim.id)}`}><ShieldCheck className="mr-2 h-4 w-4" />Review via normal admin process</Link>
                    </Button>
                    <Button asChild variant="outline"><Link to="/admin/qa">Record QA result</Link></Button>
                  </div>
                  {claim.reward_status === 'approved' && (
                    <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-200/70">Demo approval is recorded. This test claim is not payable and must not add to a real installer wallet.</p>
                  )}
                  {claim.reward_status === 'redemption_requested' && (
                    <p className="mt-3 text-xs text-muted-foreground">This is a demo claim. Do not issue a voucher for this test; use the controlled payout checklist instead.</p>
                  )}
                  {claim.reward_status === 'issued' && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" />This test shows an issued status. Confirm no actual gift card was sent and record this in QA.</p>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
