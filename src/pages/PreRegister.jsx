import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Loader2, Lock, Mail, UserPlus,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AuthLayout from '@/components/AuthLayout';
import WholesalerBranchSearch from '@/components/WholesalerBranchSearch';
import PhoneNumberField, { isValidUkMobile, normaliseUkMobile } from '@/components/PhoneNumberField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/components/ui/use-toast';

const blank = {
  first_name: '',
  last_name: '',
  business_name: '',
  email: '',
  password: '',
  confirm_password: '',
  mobile: '',
  town_city: '',
  postcode: '',
  coverage_area: '',
  wholesaler: '',
  branch: '',
  manualWholesaler: '',
  manualBranch: '',
  notify: true,
  privacy_accepted: false,
};

export default function PreRegister() {
  const [params] = useSearchParams();
  const invite = (params.get('invite') || '').trim().toLowerCase();
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [step, setStep] = useState('details'); // details | verify | done
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const passwordOk = form.password.length >= 8;
  const passwordsMatch = form.password && form.password === form.confirm_password;
  const wholesalerOk = Boolean(
    (form.wholesaler && form.branch)
    || (form.manualWholesaler.trim() && form.manualBranch.trim()),
  );

  const detailsValid = useMemo(() => (
    form.first_name.trim()
    && form.last_name.trim()
    && form.business_name.trim()
    && form.email.trim()
    && passwordOk
    && passwordsMatch
    && isValidUkMobile(form.mobile)
    && form.town_city.trim()
    && form.postcode.trim()
    && form.coverage_area.trim()
    && wholesalerOk
    && form.privacy_accepted
  ), [form, passwordOk, passwordsMatch, wholesalerOk]);

  const startAccount = async (event) => {
    event.preventDefault();
    if (!detailsValid) {
      setError('Please complete all required fields before continuing.');
      return;
    }
    setLoading(true);
    setError('');
    const email = form.email.trim().toLowerCase();
    try {
      await base44.auth.register({ email, password: form.password });
      update('email', email);
      setStep('verify');
    } catch (err) {
      const message = err?.message || 'Registration failed';
      if (/already|exist/i.test(message)) {
        setError('An account with this email already exists. Sign in instead, or contact FastAmps if you need help.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyAndSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await base44.auth.verifyOtp({ email: form.email, otpCode: otp });
      if (result?.access_token) base44.auth.setToken(result.access_token);

      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        business_name: form.business_name.trim(),
        mobile: normaliseUkMobile(form.mobile),
        town_city: form.town_city.trim(),
        postcode: form.postcode.trim(),
        coverage_area: form.coverage_area.trim(),
        nominated_wholesaler: form.wholesaler || form.manualWholesaler.trim(),
        nominated_branch: form.branch || form.manualBranch.trim(),
        preferred_wholesaler_manual: form.wholesaler ? '' : form.manualWholesaler.trim(),
        preferred_branch_manual: form.branch ? '' : form.manualBranch.trim(),
        notify_programme_availability: form.notify,
        privacy_accepted: true,
        attributed_programme_code: invite,
      };
      const response = await base44.functions.invoke('pre-register-installer', payload);
      const data = response?.data || response;
      if (data?.error) throw new Error(data.error);
      setConfirmation(data?.confirmation || {
        heading: "You're on the list!",
        message: "Thank you for registering your interest in FastAmps Connect.",
      });
      setStep('done');
    } catch (err) {
      setError(err?.message || 'We could not complete pre-registration.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <AuthLayout
        icon={CheckCircle2}
        title={confirmation?.heading || "You're on the list!"}
        subtitle={confirmation?.message}
        footer={
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in later
          </Link>
        }
      >
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/80">
          You&apos;re on the interest list — not an active rewards member yet. We&apos;ll email you when your area opens.
        </div>
        <Button className="mt-6 w-full h-12" onClick={() => navigate('/')}>
          Go to FastAmps Connect
        </Button>
      </AuthLayout>
    );
  }

  if (step === 'verify') {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a code to ${form.email}`}
      >
        {error ? <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div> : null}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12" disabled={loading || otp.length < 6} onClick={verifyAndSubmit}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming…</> : 'Confirm and join the list'}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn&apos;t receive the code?{' '}
          <button
            type="button"
            className="text-primary font-medium hover:underline"
            onClick={async () => {
              try {
                await base44.auth.resendOtp(form.email);
                toast({ title: 'Code sent', description: 'Check your email for the new code.' });
              } catch (err) {
                setError(err?.message || 'Failed to resend code');
              }
            }}
          >
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Pre-register your interest"
      subtitle="Tell us your preferred wholesaler branch. We'll email you when FastAmps Connect opens nearby."
      footer={
        <>
          Prefer to join an active programme?{' '}
          <Link to="/welcome" className="text-primary font-medium hover:underline">Back to options</Link>
        </>
      }
    >
      <div className="fa-auth-back-row">
        <Link to="/welcome">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
      </div>

      {error ? <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div> : null}

      <form onSubmit={startAccount} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">First name</Label>
            <Input id="first_name" className="h-12" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name</Label>
            <Input id="last_name" className="h-12" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_name">Business name</Label>
          <Input id="business_name" className="h-12" value={form.business_name} onChange={(e) => update('business_name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" className="h-12 pl-10" value={form.email} onChange={(e) => update('email', e.target.value)} required />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" className="h-12 pl-10" value={form.password} onChange={(e) => update('password', e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm password</Label>
            <Input id="confirm_password" type="password" className="h-12" value={form.confirm_password} onChange={(e) => update('confirm_password', e.target.value)} required />
          </div>
        </div>
        <PhoneNumberField value={form.mobile} onChange={(value) => update('mobile', value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="town_city">Town or city</Label>
            <Input id="town_city" className="h-12" value={form.town_city} onChange={(e) => update('town_city', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode</Label>
            <Input id="postcode" className="h-12" value={form.postcode} onChange={(e) => update('postcode', e.target.value.toUpperCase())} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coverage_area">Primary installation coverage area</Label>
          <Input
            id="coverage_area"
            className="h-12"
            value={form.coverage_area}
            onChange={(e) => update('coverage_area', e.target.value)}
            placeholder="e.g. Shropshire and mid-Wales"
            required
          />
        </div>

        <WholesalerBranchSearch
          wholesaler={form.wholesaler}
          branch={form.branch}
          manualWholesaler={form.manualWholesaler}
          manualBranch={form.manualBranch}
          onSelect={({ wholesaler, branch }) => setForm((current) => ({
            ...current,
            wholesaler,
            branch,
            manualWholesaler: '',
            manualBranch: '',
          }))}
          onManualChange={({ manualWholesaler, manualBranch }) => setForm((current) => ({
            ...current,
            wholesaler: '',
            branch: '',
            manualWholesaler,
            manualBranch,
          }))}
        />

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.notify}
            onChange={(e) => update('notify', e.target.checked)}
          />
          <span>Notify me when FastAmps Connect becomes available through my preferred wholesaler or in my area.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.privacy_accepted}
            onChange={(e) => update('privacy_accepted', e.target.checked)}
            required
          />
          <span>
            I accept the{' '}
            <Link to="/privacy" className="text-primary hover:underline" target="_blank" rel="noreferrer">privacy notice</Link>
            {' '}and understand I am registering interest only — not joining an active rewards programme yet.
          </span>
        </label>

        <Button type="submit" className="w-full h-12 font-semibold" disabled={loading || !detailsValid}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Continuing…</> : 'Continue'}
        </Button>
      </form>
    </AuthLayout>
  );
}
