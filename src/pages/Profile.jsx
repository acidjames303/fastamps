import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PROGRAMME_TERMS_VERSION } from '@/pages/ProgrammeTerms';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import OnboardingCard from '@/components/OnboardingCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Copy, Trash2, Users } from 'lucide-react';
import ProfileCard from '@/components/ProfileCard';
import PhoneNumberField, { isValidUkMobile, normaliseUkMobile } from '@/components/PhoneNumberField';
import { calculateInstallerStatus } from '@/lib/installerScore';
import ReferralProgress from '@/components/ReferralProgress';
import InstallerDocumentsUpload from '@/components/InstallerDocumentsUpload';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

async function copyText(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through for mobile browsers that expose but block Clipboard API.
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.left = '-9999px';
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(field);
  }
  return copied;
}

export default function Profile() {
  const qc = useQueryClient();
  const { data, isLoading } = useInstaller();
  const installer = data?.installer;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [formError, setFormError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [acceptExistingTerms, setAcceptExistingTerms] = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [savingDocuments, setSavingDocuments] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { data: claims = [] } = useQuery({
    queryKey: ['install-claims'],
    enabled: Boolean(installer),
    queryFn: () => base44.entities.InstallClaim.filter(
      { installer_email: data.user.email },
      '-created_date',
      250
    ),
  });

  useEffect(() => {
    if (installer) setForm({ full_name: installer.full_name, business_name: installer.business_name || '', region: installer.region || '', mobile: installer.mobile, nominated_wholesaler: installer.nominated_wholesaler || '', nominated_branch: installer.nominated_branch || '' });
  }, [installer]);

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading…</div>;
  if (!installer) return <OnboardingCard user={data.user} />;

  const save = async (e) => {
    e.preventDefault();
    setSaveStatus('idle');
    if (!form.full_name?.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await base44.entities.Installer.update(installer.id, {
        full_name: form.full_name.trim(),
        business_name: (form.business_name || '').trim(),
        region: (form.region || '').trim(),
        mobile: normaliseUkMobile(form.mobile),
        nominated_wholesaler: (form.nominated_wholesaler || '').trim(),
        nominated_branch: (form.nominated_branch || '').trim(),
      });
      await qc.invalidateQueries({ queryKey: ['installer'] });
      setSaveStatus('saved');
    } catch (error) {
      setFormError(error?.response?.data?.error || error?.message || '');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveStatus('idle');
    setFormError('');
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    setPhotoError('');
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      await base44.entities.Installer.update(installer.id, { avatar_url: file_url });
      await qc.invalidateQueries({ queryKey: ['installer'] });
    } catch (error) {
      setPhotoError(error?.message || 'We could not upload that photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    setPhotoError('');
    setUploadingPhoto(true);
    try {
      await base44.entities.Installer.update(installer.id, { avatar_url: '' });
      await qc.invalidateQueries({ queryKey: ['installer'] });
    } catch (error) {
      setPhotoError(error?.message || 'We could not remove that photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updateDocuments = async (next) => {
    setDocumentError('');
    setSavingDocuments(true);
    try {
      await base44.entities.Installer.update(installer.id, {
        approval_documents: next.map((doc) => doc.uri),
        approval_document_names: next.map((doc) => doc.name),
      });
      await qc.invalidateQueries({ queryKey: ['installer'] });
    } catch (error) {
      setDocumentError(error?.message || 'We could not save those documents. Please try again.');
    } finally {
      setSavingDocuments(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      await base44.functions.invoke('delete-account', {});
      base44.auth.logout(window.location.origin + '/login');
    } catch (error) {
      setDeleteError(error?.response?.data?.error || error?.message || 'We could not delete your account. Please try again.');
      setDeleting(false);
    }
  };

  const savedDocuments = (installer.approval_documents || []).map((uri, index) => ({
    uri,
    name: (installer.approval_document_names || [])[index] || `Document ${index + 1}`,
  }));

  const activeClaims = claims.filter((claim) => !claim.excluded_from_reporting);
  const installerStatus = calculateInstallerStatus(activeClaims, installer.training_progress);
  const stats = [
    ['Approved installs', installerStatus.approvedCount],
    ['Reviewed', installerStatus.reviewedCount],
    ['Referrals', installer.referrals || 0],
    ['Training', `${installer.training_progress || 0}%`],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ProfileCard
        name={installer.full_name}
        score={installerStatus.score}
        status={installerStatus.status}
        statusLabel={installerStatus.label}
        reviewedCount={installerStatus.reviewedCount}
        nextReviewCount={installerStatus.nextReviewCount}
        region={installer.region}
        stats={stats}
        avatarUrl={installer.avatar_url}
        onPhotoSelect={uploadPhoto}
        uploadingPhoto={uploadingPhoto}
      />

      {(photoError || installer.avatar_url) && (
        <div className="-mt-4 flex flex-col items-center gap-2 sm:items-start">
          {photoError && <p className="text-sm text-red-400" role="alert">{photoError}</p>}
          {installer.avatar_url && (
            <Button type="button" variant="ghost" onClick={removePhoto} disabled={uploadingPhoto} className="gap-2 text-muted-foreground hover:text-foreground">
              <Trash2 className="h-4 w-4" />
              Remove profile photo
            </Button>
          )}
        </div>
      )}

      <section className="rounded-3xl border border-accent/25 bg-accent/[0.06] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-accent/10 p-2.5 text-accent"><Users className="h-5 w-5" /></div>
          <h2 className="min-w-0 font-semibold">Invite another installer</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Your referral code links a new installer’s registration to your FastAmps Connect account.</p>
        {installer.programme_terms_version !== PROGRAMME_TERMS_VERSION && (
          <div className="mt-4 space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="text-sm text-foreground/80">Accept the updated programme terms to share your referral code and redeem rewards.</p>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="mt-0.5" checked={acceptExistingTerms} onChange={(event) => setAcceptExistingTerms(event.target.checked)} />
              <span>I agree to the <Link to="/programme-terms" target="_blank" rel="noopener noreferrer" className="text-accent underline">FastAmps installer and referral terms</Link> (version {PROGRAMME_TERMS_VERSION}).</span>
            </label>
            <Button type="button" size="sm" disabled={!acceptExistingTerms || termsSaving} onClick={async () => {
              setTermsSaving(true);
              setTermsError('');
              try {
                await base44.functions.invoke('acknowledge-programme-terms', { accepted: true, version: PROGRAMME_TERMS_VERSION });
                await qc.invalidateQueries({ queryKey: ['installer'] });
              } catch (err) {
                setTermsError(err.response?.data?.error || err.message || 'Could not save terms acknowledgement.');
              } finally {
                setTermsSaving(false);
              }
            }}>{termsSaving ? 'Saving…' : 'Accept programme terms'}</Button>
            {termsError && <p className="text-xs text-destructive" role="alert">{termsError}</p>}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex-1 rounded-xl border border-border bg-background px-4 py-3 font-mono text-lg font-semibold tracking-wider">{installer.referral_code || 'Code being prepared'}</div>
          <Button type="button" variant="outline" disabled={!installer.referral_code || installer.programme_terms_version !== PROGRAMME_TERMS_VERSION || installer.reward_account_status === 'blocked'} onClick={async () => {
            const copied = await copyText(installer.referral_code);
            if (copied) {
              setCodeCopied(true);
              window.setTimeout(() => setCodeCopied(false), 2000);
            }
          }} className="h-12 gap-2 border-border bg-background">
            {codeCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {codeCopied ? 'Copied' : 'Copy code'}
          </Button>
        </div>
        <div className="mt-4 rounded-2xl border border-border/70 bg-background/70 p-4">
          <h3 className="text-sm font-semibold">How it works</h3>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-3"><span className="font-semibold text-accent">1.</span><span>Copy your code and send it to the installer you are referring.</span></li>
            <li className="flex gap-3"><span className="font-semibold text-accent">2.</span><span>They enter it in the optional <span className="font-medium text-foreground">Referral code</span> box when creating their installer account.</span></li>
            <li className="flex gap-3"><span className="font-semibold text-accent">3.</span><span>FastAmps records the referral when they register. It qualifies after they complete five approved FastAmps installations.</span></li>
          </ol>
          <div className="mt-3 rounded-xl border border-accent/20 bg-accent/[0.06] p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">The referral deal:</span> once the installer you referred completes five approved, unique FastAmps installations, £20 voucher credit is added to your reward wallet. It combines with your other rewards and follows the normal £30 minimum voucher process.
          </div>
          <p className="mt-3 text-xs text-muted-foreground">The code must be entered during registration. Each installation requires FastAmps approval, and only one reward is issued for each referred installer who reaches five approved installs.</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border bg-background p-3"><div className="font-semibold">{installer.referrals || 0}</div><div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Referred</div></div>
          <div className="rounded-xl border border-border bg-background p-3"><div className="font-semibold">{installer.qualified_referrals || 0}</div><div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Qualified</div></div>
          <div className="rounded-xl border border-border bg-background p-3"><div className="font-semibold">£{Number(installer.referral_discounts_available || 0) * 20}</div><div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Referral credit</div></div>
        </div>
        <ReferralProgress userEmail={data?.user?.email} />
      </section>

      <section className="rounded-3xl border border-border bg-muted/60 p-6 sm:p-8">
        <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Edit profile</h2>
        {form && (
          <form onSubmit={save} className="mt-5 space-y-4">
            <Input value={form.full_name} onChange={(e) => updateForm('full_name', e.target.value)} placeholder="Full name" className="bg-background border-border h-12" />
            <Input value={form.business_name} onChange={(e) => updateForm('business_name', e.target.value)} placeholder="Business name" className="bg-background border-border h-12" />
            <Input value={form.region} onChange={(e) => updateForm('region', e.target.value)} placeholder="Coverage area" className="bg-background border-border h-12" />
            <PhoneNumberField id="profile-mobile" value={form.mobile} onChange={(value) => updateForm('mobile', value)} />
            <Input value={form.nominated_wholesaler} onChange={(e) => updateForm('nominated_wholesaler', e.target.value)} placeholder="Usual electrical wholesaler" className="bg-background border-border h-12" />
            <Input value={form.nominated_branch} onChange={(e) => updateForm('nominated_branch', e.target.value)} placeholder="Wholesaler branch or town" className="bg-background border-border h-12" />
            {formError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {formError}
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button disabled={saving || !form.full_name?.trim() || !isValidUkMobile(form.mobile)} className={`${saveStatus === 'saved' ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-primary hover:bg-primary/80'} min-w-36 text-white font-semibold`}>
                {saving ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save changes'}
              </Button>
              {saveStatus === 'saved' && (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-400" role="status">
                  <CheckCircle2 className="h-5 w-5" />
                  Your profile changes have been saved.
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-sm font-medium text-red-400" role="alert">
                  <AlertCircle className="h-5 w-5" />
                  Changes could not be saved. Please try again.
                </div>
              )}
            </div>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Proof documents</h2>
        <p className="text-sm text-muted-foreground">
          Add your proof-of-approval documents here if you did not upload them when you registered. Your reward wallet cannot be claimed until FastAmps has reviewed and approved them.
        </p>
        <InstallerDocumentsUpload
          documents={savedDocuments}
          onChange={updateDocuments}
          disabled={savingDocuments}
          optional={false}
        />
        {documentError && <p className="text-sm text-destructive" role="alert">{documentError}</p>}
      </section>

      <section className="rounded-3xl border border-destructive/30 bg-destructive/[0.04] p-6 sm:p-8">
        <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Account</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Deleting your account removes your installer profile, referral code, training progress and reward balance. Approved installation records are kept for warranty and audit purposes.
        </p>
        {deleteError && <p className="mt-3 text-sm text-destructive" role="alert">{deleteError}</p>}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              className="no-native-select mt-4 h-12 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Your FastAmps Connect account, installer profile, referral code, training progress and any unclaimed reward balance will be deleted, and you will be signed out immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Keep my account</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={(event) => {
                  event.preventDefault();
                  deleteAccount();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting…' : 'Delete my account'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}