import { AlertCircle, CheckCircle2, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const normaliseUkMobile = (value = '') => {
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('0044')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('44')) digits = `0${digits.slice(2)}`;
  return digits.slice(0, 11);
};
export const isValidUkMobile = (value = '') => /^07\d{9}$/.test(normaliseUkMobile(value));

const preserveUkMobileInput = (value = '') => {
  const trimmed = String(value).trimStart();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '').slice(0, hasPlus ? 12 : 14);
  return hasPlus ? `+${digits}` : digits;
};

export default function PhoneNumberField({
  value,
  onChange,
  id = 'mobile',
  label = 'UK mobile number',
  required = true,
  disabled = false,
}) {
  const displayValue = String(value || '');
  const digits = normaliseUkMobile(displayValue);
  const touched = displayValue.length > 0;
  const valid = isValidUkMobile(displayValue);
  const error = touched && !valid;
  let guidance = 'Enter 11 digits beginning with 07 or +44 7…';
  if (digits.length > 0 && !digits.startsWith('07')) guidance = 'Enter a UK mobile number beginning with 07 or +44 7…';
  else if (digits.length < 11 && digits.length > 0) guidance = `Enter ${11 - digits.length} more digit${11 - digits.length === 1 ? '' : 's'}.`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
        <span className={`text-xs tabular-nums ${valid ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {valid ? 'Valid UK mobile' : `${digits.length}/11 digits`}
        </span>
      </div>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={required}
          disabled={disabled}
          maxLength={15}
          placeholder="07123456789 or +447123456789"
          value={displayValue}
          onChange={(event) => onChange(preserveUkMobileInput(event.target.value))}
          aria-invalid={error}
          aria-describedby={`${id}-help`}
          className={`h-12 bg-background pl-10 pr-10 ${error ? 'border-destructive focus-visible:ring-destructive' : valid ? 'border-emerald-500' : 'border-border'}`}
        />
        {valid && <CheckCircle2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500" aria-hidden="true" />}
        {error && <AlertCircle className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-destructive" aria-hidden="true" />}
      </div>
      <p id={`${id}-help`} className={`text-xs ${valid ? 'text-emerald-500' : error ? 'text-destructive' : 'text-muted-foreground'}`} role={error ? 'alert' : undefined}>
        {valid ? 'Mobile number looks correct.' : guidance}
      </p>
    </div>
  );
}