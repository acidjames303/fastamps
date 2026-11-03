import { useEffect, useMemo, useState } from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, KeyRound, Loader2, ScanLine, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import OnboardingCard from '@/components/OnboardingCard';
import DemoSignupComplete from '@/components/DemoSignupComplete';
import QrScanner from '@/components/QrScanner';
import PhotoLocationNote from '@/components/PhotoLocationNote';
import { readPhotoLocation } from '@/lib/photoLocation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

const initialForm = {
  install_date: new Date().toISOString().slice(0, 10),
  site_postcode: '',
  wholesaler: '',
  wholesaler_branch: '',
  consent_confirmed: false,
};

const UK_POSTCODE_PATTERN = /^(GIR 0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/;

function formatPostcode(value) {
  const compact = value.toUpperCase().replace(/\s+/g, '');
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

async function compressInstallPhoto(file) {
  if (!file || file.size <= 350 * 1024) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The selected photo could not be prepared for upload.'));
      element.src = objectUrl;
    });

    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(image, 0, 0, width, height);

    const makeBlob = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await makeBlob('image/webp', 0.78);
    let extension = 'webp';
    if (!blob) {
      blob = await makeBlob('image/jpeg', 0.8);
      extension = 'jpg';
    }
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'fastamps-install';
    return new File([blob], `${baseName}.${extension}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function photoLocationFields(prefix, location) {
  if (!location) return {};
  return {
    [`${prefix}_latitude`]: location.latitude,
    [`${prefix}_longitude`]: location.longitude,
    [`${prefix}_location_accuracy`]: location.accuracy_m ?? undefined,
    [`${prefix}_location_source`]: location.source,
    [`${prefix}_location_captured_at`]: location.captured_at,
  };
}

export default function SubmitInstall() {
  const navigate = useNavigate();
  // Mobile tab panes render beside the outlet, outside the child route context.
  const claimToken = useMatch('/claim/:claimToken')?.params.claimToken;
  const queryClient = useQueryClient();
  const { data, isLoading } = useInstaller();
  const installer = data?.installer;
  const isDemoAccount = installer?.is_demo === true;
  const [charger, setCharger] = useState(null);
  const [pin, setPin] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [resolving, setResolving] = useState(Boolean(claimToken));
  const [resolveError, setResolveError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState(null);
  const [serialPhoto, setSerialPhoto] = useState(null);
  const [photoLocations, setPhotoLocations] = useState({ installed: null, serial: null });
  const [locatingPhoto, setLocatingPhoto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState('');
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [postcodeError, setPostcodeError] = useState('');

  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : null, [photo]);
  const serialPreview = useMemo(() => serialPhoto ? URL.createObjectURL(serialPhoto) : null, [serialPhoto]);

  // Pre-fill the wholesaler fields from the installer's nominated wholesaler
  // so a previously saved preference carries into each new install claim.
  useEffect(() => {
    if (!installer) return;
    setForm((current) => ({
      ...current,
      wholesaler: current.wholesaler || installer.nominated_wholesaler || '',
      wholesaler_branch: current.wholesaler_branch || installer.nominated_branch || '',
    }));
  }, [installer]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      if (serialPreview) URL.revokeObjectURL(serialPreview);
    };
  }, [preview, serialPreview]);

  useEffect(() => {
    if (!installer || !claimToken) return;
    let active = true;
    const resolveQr = async () => {
      setResolving(true);
      setResolveError('');
      try {
        const response = await base44.functions.invoke('resolve-charger-claim', {
          claim_token: claimToken,
        });
        if (active) {
          setCharger(response.data.charger);
          // The QR resolves the charger, so its serial and PIN arrive filled in.
          setSerialNumber(response.data.charger.serial_number || '');
          setPin(response.data.charger.pin_code || '');
        }
      } catch (err) {
        if (active) {
          setResolveError(err.response?.data?.error || err.message || 'This charger QR code could not be verified.');
        }
      } finally {
        if (active) setResolving(false);
      }
    };
    resolveQr();
    return () => {
      active = false;
    };
  }, [claimToken, installer]);

  const resolvePin = async (event) => {
    event.preventDefault();
    setResolveError('');
    setResolving(true);
    try {
      const response = await base44.functions.invoke('resolve-charger-claim', {
        serial_number: serialNumber.trim().toUpperCase(),
        pin_code: pin.trim(),
      });
      setCharger(response.data.charger);
    } catch (err) {
      setResolveError(err.response?.data?.error || err.message || 'That charger PIN could not be verified.');
    } finally {
      setResolving(false);
    }
  };

  const resetToPin = () => {
    setCharger(null);
    setPhoto(null);
    setSerialPhoto(null);
    setPhotoLocations({ installed: null, serial: null });
    setError('');
    setResolveError('');
    if (claimToken) navigate('/register-install', { replace: true });
  };

  const handleQrDetected = async (payload = {}) => {
    const { token, serial, pin, registration, website, kind } = payload;
    setShowScanner(false);
    setCharger(null);
    setResolveError('');
    if (website || kind === 'website') {
      setManualEntry(true);
      setResolveError('That QR opens the FastAmps Connect website only. Scan a charger label QR, or enter its serial number and PIN.');
      return;
    }
    if (token) {
      navigate(`/claim/${encodeURIComponent(token)}`, { replace: true });
      return;
    }
    if (registration || kind === 'registration') {
      setManualEntry(true);
      setResolveError('This is a general registration QR. Enter the charger serial number and PIN, or scan its individual label.');
      return;
    }
    if (serial) {
      // Older labels list the serial and PIN instead of a claim link.
      setSerialNumber(serial);
      setPin(/^\d{6}$/.test(pin) ? pin : '');
      setManualEntry(true);
      setResolveError('That label lists a serial number. Enter its six-digit PIN, then verify.');
      return;
    }
    setResolveError('That QR code did not contain a charger reference. Scan the label printed on the charger, or enter its serial number and PIN.');
  };

  const choosePhoto = async (file, type = 'installed') => {
    setError('');
    const setter = type === 'serial' ? setSerialPhoto : setPhoto;
    const clearLocation = () => setPhotoLocations((current) => ({ ...current, [type]: null }));
    if (!file) {
      setter(null);
      clearLocation();
      return;
    }
    if (!String(file.type || '').startsWith('image/')) {
      setter(null);
      clearLocation();
      setError('Choose an image from your camera or photo library.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setter(null);
      clearLocation();
      setError('That photo is larger than 15 MB. Choose a smaller image and try again.');
      return;
    }
    setter(file);
    clearLocation();
    setLocatingPhoto(type);
    try {
      const location = await readPhotoLocation(file);
      setPhotoLocations((current) => ({ ...current, [type]: location }));
    } finally {
      setLocatingPhoto('');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!charger?.claim_token || !charger.serial_number || !charger.pin_code) {
      setError('Verify the charger serial number and PIN before continuing.');
      return;
    }
    if (!serialPhoto || !photo) {
      setError('Add both photos: a readable serial number fixed to the charger, and the complete fitted charger.');
      return;
    }

    const formattedPostcode = formatPostcode(form.site_postcode);
    if (!UK_POSTCODE_PATTERN.test(formattedPostcode)) {
      setPostcodeError('Enter a valid UK postcode, for example NG1 1AA.');
      return;
    }
    setPostcodeError('');
    setForm((current) => ({ ...current, site_postcode: formattedPostcode }));

    setSubmitting(true);
    setSubmitStage('Uploading two photos…');
    try {
      const [preparedSerialPhoto, preparedInstallPhoto] = await Promise.all([
        compressInstallPhoto(serialPhoto), compressInstallPhoto(photo),
      ]);
      const [serialUpload, installUpload] = await Promise.all([
        base44.integrations.Core.UploadFile({ file: preparedSerialPhoto }),
        base44.integrations.Core.UploadFile({ file: preparedInstallPhoto }),
      ]);
      setSubmitStage('Verifying installation and submitting claim…');
      await base44.functions.invoke('submit-install-claim-v2', {
        claim_token: charger.claim_token,
        serial_number: charger.serial_number,
        pin_code: charger.pin_code,
        serial_photo_url: serialUpload.file_url,
        install_photo_url: installUpload.file_url,
        ...photoLocationFields('serial_photo', photoLocations.serial),
        ...photoLocationFields('install_photo', photoLocations.installed),
        install_date: form.install_date,
        site_postcode: formattedPostcode,
        wholesaler: form.wholesaler,
        wholesaler_branch: form.wholesaler_branch,
        consent_confirmed: form.consent_confirmed,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['install-claims'] }),
        queryClient.invalidateQueries({ queryKey: ['programme-report'] }),
      ]);
      toast({
        title: 'Install submitted',
        description: 'Your warranty and £10 reward are pending FastAmps approval.',
      });
      navigate('/installs');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'We could not submit this install. Please try again.');
    } finally {
      setSubmitting(false);
      setSubmitStage('');
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!installer) return <OnboardingCard user={data?.user} />;

  if (resolving && !charger) {
    return (
      <div className="max-w-xl rounded-3xl border border-border bg-muted/60 p-8 text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-accent" />
        <h1 className="mt-4 text-xl font-semibold">Checking your charger</h1>
        <p className="mt-2 text-sm text-muted-foreground">This will only take a moment.</p>
      </div>
    );
  }

  if (!charger && isDemoAccount && !claimToken && !manualEntry && !showScanner) {
    return (
      <div className="max-w-xl">
        <DemoSignupComplete onScan={() => setShowScanner(true)} onManual={() => setManualEntry(true)} />
      </div>
    );
  }

  if (!charger) {
    return (
      <div className="max-w-xl space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps Connect</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Register an install</h1>
          <p className="mt-2 text-muted-foreground">
            Scan the charger QR code, or enter both its serial number and six-digit PIN. Then take two quick photos to register your installation.
          </p>
        </div>

        {claimToken && resolveError && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-amber-800 dark:text-amber-100/75">
            {resolveError}
          </div>
        )}

        {isDemoAccount && (
          <div className="rounded-2xl border border-accent/30 bg-accent/10 p-5 text-sm text-foreground/80">
            <span className="font-semibold">Demo installer account.</span> Installations submitted from this account are reviewed but never paid.
          </div>
        )}

        {showScanner ? (
          <QrScanner onDetected={handleQrDetected} onClose={() => setShowScanner(false)} />
        ) : (
          <form onSubmit={resolvePin} className="rounded-3xl border border-border bg-muted/60 p-6 md:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-accent">
              <KeyRound className="h-6 w-6" />
            </div>
            <Label htmlFor="charger-serial" className="mt-6 block">Charger serial number</Label>
            <Input
              id="charger-serial"
              required
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="From the physical charger label"
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value.toUpperCase())}
              className="mt-2 h-12 bg-background border-border"
            />
            <Label htmlFor="charger-pin" className="mt-4 block">Six-digit charger PIN</Label>
            <Input
              id="charger-pin"
              required
              autoComplete="off"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="6 digits, including leading zeros"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="mt-2 h-14 bg-background border-border text-lg tracking-wider"
            />
            {!claimToken && resolveError && (
              <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {resolveError}
              </div>
            )}
            <Button type="submit" disabled={resolving || !serialNumber.trim() || !/^[0-9]{6}$/.test(pin)} className="mt-5 h-12 w-full bg-primary text-white">
              {resolving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking charger...</> : 'Verify serial number and PIN'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowScanner(true)} className="mt-3 h-12 w-full border-accent/30 text-accent">
              <ScanLine className="mr-2 h-4 w-4" />Scan QR code with camera
            </Button>
            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground/80">
              Scanning the QR code securely retrieves its linked serial number and PIN. If scanning fails, both values are required manually.
            </p>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-7">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-accent">FastAmps Connect</div>
        <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">Photograph the installed charger</h1>
        <p className="mt-2 text-muted-foreground">
          Charger {charger.serial_number} is verified. Take two photos to confirm the physical unit and its finished installation.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          [CheckCircle2, '1. Charger verified', charger.product_model],
          [Camera, '2. Take two photos', 'Serial label + fitted charger'],
          [ShieldCheck, '3. Submit', 'Warranty and £10 pending'],
        ].map(([Icon, title, copy]) => (
          <div key={title} className="rounded-2xl border border-border bg-muted/60 p-4">
            <Icon className="w-5 h-5 text-accent" />
            <div className="mt-3 text-sm font-semibold">{title}</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="rounded-3xl border border-border bg-muted/60 p-5 md:p-8 space-y-6">
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4 sm:flex sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200/70">Verified charger</div>
            <div className="mt-1 font-semibold">{charger.product_model} · {charger.serial_number}</div>
            <div className="mt-2 text-sm text-foreground/75">PIN: <span className="font-semibold tracking-wider text-foreground">{charger.pin_code}</span></div>
            {charger.is_demo && (
              <div className="mt-2 text-xs text-accent">Demo charger — this claim is reviewed but never paid.</div>
            )}
          </div>
          <Button type="button" variant="ghost" onClick={resetToPin} className="mt-2 px-0 text-xs text-muted-foreground sm:mt-0 sm:px-3">
            Use another charger
          </Button>
        </div>

        <div>
          <Label htmlFor="serial-photo">1. Photo of serial number on charger *</Label>
          <p className="mt-1 text-xs text-muted-foreground">Show the physical serial-number label attached to this charger. Ensure every character is readable.</p>
          <label htmlFor="serial-photo" className="relative mt-2 block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors">
            {serialPreview ? (
              <img src={serialPreview} alt="Serial number evidence preview" decoding="async" className="w-full max-h-64 object-contain" />
            ) : (
              <div className="min-h-36 flex flex-col items-center justify-center px-5 text-center">
                <Camera className="w-7 h-7 text-accent" />
                <div className="mt-2 text-sm font-semibold">Photograph the serial-number label</div>
                <div className="mt-1 text-xs text-muted-foreground">Take photo or choose from gallery</div>
              </div>
            )}
            <input id="serial-photo" type="file" accept="image/*" required aria-label="Photo showing the serial number on the charger" className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" onChange={(event) => choosePhoto(event.target.files?.[0] || null, 'serial')} />
          </label>
          {serialPhoto && (
            <div className="mt-2 space-y-1 text-xs">
              <div className="text-accent">Serial photo ready · {serialPhoto.name}</div>
              <PhotoLocationNote location={photoLocations.serial} locating={locatingPhoto === 'serial'} />
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="photo">2. Complete installed charger photo *</Label>
          <label htmlFor="photo" className="relative mt-2 block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors">
            {preview ? (
              <img src={preview} alt="Install preview" decoding="async" className="w-full max-h-80 object-cover" />
            ) : (
              <div className="min-h-52 flex flex-col items-center justify-center px-6 text-center">
                <Camera className="w-8 h-8 text-accent" />
                <div className="mt-3 text-sm font-semibold">Photograph the complete fitted charger</div>
                <div className="mt-1 text-xs text-muted-foreground">Make sure the fitted charger and its position on the wall are clear.</div>
              </div>
            )}
            <input
              id="photo"
              type="file"
              accept="image/*"
              required
              aria-label="Take or choose an installed charger photo"
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              onChange={(event) => choosePhoto(event.target.files?.[0] || null)}
            />
          </label>
          {photo && (
            <div className="mt-2 space-y-1 text-xs">
              <div className="text-accent">Installation photo ready · {photo.name}</div>
              <PhotoLocationNote location={photoLocations.installed} locating={locatingPhoto === 'installed'} />
            </div>
          )}
        </div>

        <p className="rounded-xl border border-border bg-black/[0.03] p-3 text-xs leading-5 text-muted-foreground dark:bg-black/10">
          FastAmps records where each photo was taken — from the photo's own location data, or from your device when the photo has none. This location registers the extra year of warranty cover for this installation.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="date">Install date *</Label>
            <Input id="date" type="date" required value={form.install_date}
              onChange={(event) => setForm({ ...form, install_date: event.target.value })} className="h-12 bg-background border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postcode">Site postcode *</Label>
            <Input id="postcode" required autoCapitalize="characters" autoComplete="postal-code" placeholder="e.g. NG1 1AA"
              value={form.site_postcode}
              onChange={(event) => {
                setForm({ ...form, site_postcode: event.target.value.toUpperCase() });
                if (postcodeError) setPostcodeError('');
              }}
              onBlur={() => {
                const formatted = formatPostcode(form.site_postcode);
                setForm({ ...form, site_postcode: formatted });
                setPostcodeError(formatted && !UK_POSTCODE_PATTERN.test(formatted) ? 'Enter a valid UK postcode, for example NG1 1AA.' : '');
              }}
              aria-invalid={Boolean(postcodeError)}
              aria-describedby={postcodeError ? 'postcode-error' : undefined}
              className={`h-12 bg-background border-border ${postcodeError ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
            {postcodeError && <p id="postcode-error" className="text-xs text-destructive">{postcodeError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="wholesaler">Wholesaler</Label>
            <Input id="wholesaler" placeholder="Where was it purchased?"
              value={form.wholesaler} onChange={(event) => setForm({ ...form, wholesaler: event.target.value })}
              className="h-12 bg-background border-border" />
            <p className="text-xs text-muted-foreground">Pre-filled from your usual wholesaler — change it if this charger was bought elsewhere.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="branch">Wholesaler branch</Label>
            <Input id="branch" placeholder="Town or branch name"
              value={form.wholesaler_branch} onChange={(event) => setForm({ ...form, wholesaler_branch: event.target.value })}
              className="h-12 bg-background border-border" />
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border bg-black/[0.03] dark:bg-black/10 p-4 text-sm text-foreground/80">
          <input type="checkbox" required checked={form.consent_confirmed}
            onChange={(event) => setForm({ ...form, consent_confirmed: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-blue-500" />
          <span>I confirm this is a genuine FastAmps installation and the information supplied is accurate.</span>
        </label>

        {error && <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}

        <Button type="submit" disabled={submitting} className="w-full h-13 bg-primary text-white hover:bg-primary/85 font-semibold text-base">
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{submitStage || 'Submitting…'}</> : 'Submit warranty and £10 reward'}
        </Button>
        <p className="text-center text-xs text-muted-foreground/80">The £10 reward appears as pending until FastAmps approves the installation.</p>
      </form>

      <Link to="/installs" className="inline-flex text-sm text-muted-foreground hover:text-accent">View existing installation claims</Link>
    </div>
  );
}