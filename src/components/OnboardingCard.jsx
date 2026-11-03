import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ProgrammeTerms, { PROGRAMME_TERMS_VERSION } from '@/pages/ProgrammeTerms';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plus, ShieldCheck, Store, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PhoneNumberField, { isValidUkMobile, normaliseUkMobile } from '@/components/PhoneNumberField';
import InstallerDocumentsUpload from '@/components/InstallerDocumentsUpload';

const blankForm = {
  mobile: '',
  full_name: '',
  business_name: '',
  region: '',
  wholesalers: [{ wholesaler: '', branch: '' }],
  referral_code: '',
  terms_accepted: false,
  documents: [],
};

// Short parts with no vowels are initials, e.g. "jp" -> "JP"
function capitaliseInitials(value) {
  return String(value || '')
    .split(' ')
    .map((token) => {
      const lower = token.toLocaleLowerCase('en-GB');
      return /^[a-z]{1,3}$/.test(lower) && !/[aeiouy]/.test(lower) ? lower.toLocaleUpperCase('en-GB') : token;
    })
    .join(' ');
}

function titleCaseNamePart(value) {
  const lower = String(value || '').toLocaleLowerCase('en-GB');
  const titled = lower.replace(/(^|[-'])\p{L}/gu, (match) => match.toLocaleUpperCase('en-GB'));
  return capitaliseInitials(titled);
}

function suggestedFullName(user) {
  const profileName = String(user?.full_name || '').trim();
  const emailLocalPart = String(user?.email || '').trim().split('@')[0]?.split('+')[0] || '';
  const source = profileName || emailLocalPart;
  const parts = source
    .replace(/^[._\s]+|[._\s]+$/g, '')
    .split(/[._\s]+/)
    .filter(Boolean);

  const withoutMiddleInitials = parts.length > 1
    ? parts.filter((part, index) => !(part.length === 1 && index > 0 && index < parts.length - 1))
    : parts;

  return withoutMiddleInitials.map(titleCaseNamePart).join(' ');
}

export default function OnboardingCard({ user }) {
  const qc = useQueryClient();
  const location = useLocation();
  const storageKey = `fastamps-installer-onboarding:${user?.email || 'new'}`;
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      const restored = { ...blankForm, full_name: suggestedFullName(user), ...saved };
      if (saved?.full_name) restored.full_name = capitaliseInitials(saved.full_name);
      if (!Array.isArray(saved?.wholesalers) || !saved.wholesalers.length) {
        restored.wholesalers = [{ wholesaler: saved?.nominated_wholesaler || '', branch: saved?.nominated_branch || '' }];
      }
      if (!Array.isArray(restored.documents)) restored.documents = [];
      return restored;
    } catch {
      return { ...blankForm, full_name: suggestedFullName(user) };
    }
  });
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);
  const isClaimJourney = location.pathname.includes('/claim/') || location.pathname.includes('/register-install');

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(form));
  }, [form, storageKey]);

  const stepOneValid = useMemo(
    () => form.full_name.trim().length >= 2 && isValidUkMobile(form.mobile),
    [form.full_name, form.mobile]
  );
  const validWholesalers = form.wholesalers.filter((item) => item.wholesaler.trim());
  const stepTwoValid = form.region.trim().length > 0 && validWholesalers.length > 0 && form.terms_accepted === true;

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const updateWholesaler = (index, field, value) => {
    setForm((current) => ({
      ...current,
      wholesalers: current.wholesalers.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
    setError('');
  };

  const addWholesaler = () => {
    setForm((current) => ({ ...current, wholesalers: [...current.wholesalers, { wholesaler: '', branch: '' }] }));
  };

  const removeWholesaler = (index) => {
    setForm((current) => ({ ...current, wholesalers: current.wholesalers.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const goNext = (event) => {
    event.preventDefault();
    if (!stepOneValid) {
      setError('Check your full name and enter a valid 11-digit UK mobile number.');
      return;
    }
    setError('');
    setStep(2);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!stepOneValid || !stepTwoValid) {
      setError('Complete the required fields before creating your profile.');
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('register-installer', {
        mobile: normaliseUkMobile(form.mobile),
        full_name: form.full_name.trim(),
        business_name: form.business_name.trim(),
        region: form.region.trim(),
        nominated_wholesaler: validWholesalers.map((item) => item.wholesaler.trim()).join('; '),
        nominated_branch: validWholesalers.map((item) => `${item.wholesaler.trim()}: ${item.branch.trim() || 'Branch not specified'}`).join('; '),
        referral_code: form.referral_code.trim().toUpperCase(),
        // Trade-show ?demo=1 auto-demo accounts are retired. Demo installers
        // are marked only through deliberate admin/beta tooling.
        demo: false,
        terms_accepted: form.terms_accepted === true,
        programme_terms_version: PROGRAMME_TERMS_VERSION,
        approval_documents: form.documents.map((doc) => doc.uri),
        approval_document_names: form.documents.map((doc) => doc.name),
      });
      sessionStorage.removeItem(storageKey);
      await qc.invalidateQueries({ queryKey: ['installer'] });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'We could not create your installer profile. Your details have been kept; please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-border bg-muted/60 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Step {step} of 2</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{step === 1 ? 'Tell us about you' : 'Your work and wholesalers'}</h1>
        </div>
        <div className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-accent">{step === 1 ? 'Your details' : 'Work details'}</div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: step === 1 ? '50%' : '100%' }} />
      </div>

      {isClaimJourney && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-accent/25 bg-accent/10 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <div className="font-medium">Your charger is saved</div>
            <div className="mt-1 text-muted-foreground">Complete your installer profile and you will return directly to this charger claim.</div>
          </div>
        </div>
      )}

      <p className="mt-5 text-sm text-muted-foreground">
        {step === 1
          ? 'Create your installer profile to receive a £10 welcome bonus.'
          : 'This helps FastAmps understand where installer demand is coming from.'}
      </p>

      {error && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}

      <form onSubmit={step === 1 ? goNext : submit} className="mt-6 space-y-5" noValidate>
        {step === 1 ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="installer-full-name">Full name *</Label>
              <Input id="installer-full-name" autoComplete="name" required value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="Your full name" className="h-12 bg-background border-border" />
              <p className="text-xs text-muted-foreground">We have suggested this from your sign-up details. You can edit it if needed.</p>
            </div>
            <PhoneNumberField value={form.mobile} onChange={(value) => update('mobile', value)} />
            <div className="space-y-2">
              <Label htmlFor="installer-business">Business name <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="installer-business" autoComplete="organization" value={form.business_name} onChange={(e) => update('business_name', e.target.value)} placeholder="Your company or trading name" className="h-12 bg-background border-border" />
            </div>
            <Button type="submit" disabled={!stepOneValid} className="h-12 w-full bg-primary font-semibold text-white hover:bg-primary/80">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="installer-region">Coverage area *</Label>
              <Input id="installer-region" required value={form.region} onChange={(e) => update('region', e.target.value)} placeholder="For example, Midlands" className="h-12 bg-background border-border" />
            </div>
            <div className="space-y-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-5">
              <div className="flex gap-3">
                <Store className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <Label>Your nominated wholesalers *</Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Add the electrical wholesalers you normally use. Add one if you mainly use a single supplier, or add several.</p>
                </div>
              </div>

              <datalist id="fastamps-wholesaler-options">
                <option value="CEF" />
                <option value="Edmundson Electrical" />
                <option value="Yesss Electrical" />
                <option value="Links Electrical" />
                <option value="Rexel" />
              </datalist>

              <div className="space-y-3">
                {form.wholesalers.map((item, index) => (
                  <div key={index} className="rounded-xl border border-border bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Wholesaler {index + 1}</div>
                      {form.wholesalers.length > 1 && (
                        <button type="button" onClick={() => removeWholesaler(index)} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove wholesaler ${index + 1}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`installer-wholesaler-${index}`} className="text-xs">Wholesaler name *</Label>
                        <Input id={`installer-wholesaler-${index}`} list="fastamps-wholesaler-options" required={index === 0} value={item.wholesaler} onChange={(e) => updateWholesaler(index, 'wholesaler', e.target.value)} placeholder="Select or type a name" className="h-11 bg-background border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`installer-branch-${index}`} className="text-xs">Branch or town <span className="font-normal text-muted-foreground">(optional)</span></Label>
                        <Input id={`installer-branch-${index}`} value={item.branch} onChange={(e) => updateWholesaler(index, 'branch', e.target.value)} placeholder="For example, Shrewsbury" className="h-11 bg-background border-border" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" onClick={addWholesaler} className="h-11 w-full border-dashed">
                <Plus className="mr-2 h-4 w-4" />Add another wholesaler
              </Button>
              <p className="text-xs text-muted-foreground">You can update this later from your profile if your usual suppliers change.</p>
            </div>
            <InstallerDocumentsUpload
              documents={form.documents}
              onChange={(documents) => update('documents', documents)}
              disabled={saving}
            />
            <div className="space-y-2 rounded-2xl border border-border bg-background/60 p-4">
              <Label htmlFor="installer-referral-code">Were you referred by another installer? <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="installer-referral-code" autoCapitalize="characters" value={form.referral_code} onChange={(e) => update('referral_code', e.target.value.toUpperCase())} placeholder="Enter their code, for example FA-12AB34CD" className="h-12 bg-background border-border uppercase" />
              <p className="text-xs text-muted-foreground">Ask the installer who invited you for their FastAmps referral code. We will verify it when you create your profile.</p>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/5 p-4 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-600" checked={Boolean(form.terms_accepted)} onChange={(event) => update('terms_accepted', event.target.checked)} required />
              <span>I have read and agree to the <button type="button" onClick={() => setTermsOpen(true)} className="font-semibold text-accent underline underline-offset-2">installer and referral programme terms</button>. I confirm that my reward and referral submissions will reflect genuine work and comply with applicable employer or client rules.</span>
            </label>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => { setStep(1); setError(''); }} disabled={saving} className="h-12 sm:w-36">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button type="submit" disabled={saving || !stepTwoValid} className="h-12 flex-1 bg-primary font-semibold text-white hover:bg-primary/80">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating profile…</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Create installer profile</>}
              </Button>
            </div>
          </>
        )}
      </form>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Installer and referral programme terms</DialogTitle>
            <DialogDescription>Please review these before creating your profile.</DialogDescription>
          </DialogHeader>
          <ProgrammeTerms embedded />
        </DialogContent>
      </Dialog>
    </div>
  );
}