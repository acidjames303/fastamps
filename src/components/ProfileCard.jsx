import { Image } from '@/components/ui/image';
import { Award, Camera } from 'lucide-react';

export default function ProfileCard({ name = 'Installer', score = null, status = 'New', statusLabel = 'New – building score', reviewedCount = 0, nextReviewCount = 5, region, stats = [], avatarUrl, onPhotoSelect, uploadingPhoto = false }) {
  return (
    <section className="rounded-3xl border border-border bg-muted/60 p-8">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <label className="group relative w-28 h-28 rounded-full overflow-hidden ring-2 ring-primary/60 bg-background shrink-0 flex items-center justify-center cursor-pointer focus-within:ring-4 focus-within:ring-primary/40" aria-label={avatarUrl ? 'Change profile photo' : 'Upload profile photo'}>
          {avatarUrl ? (
            <>
              <Image src={avatarUrl} alt={`${name} profile`} fittingType="fill" className="w-full h-full object-cover" />
              <span className={`absolute inset-0 flex items-center justify-center bg-black/60 px-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition-opacity duration-200 ${uploadingPhoto ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
                {uploadingPhoto ? 'Uploading…' : 'Change image'}
              </span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-2 px-3 text-center text-primary">
              <Camera className="w-8 h-8" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{uploadingPhoto ? 'Uploading…' : 'Upload photo'}</span>
            </span>
          )}
          <input type="file" accept="image/*" className="sr-only" onChange={onPhotoSelect} disabled={uploadingPhoto} />
        </label>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-accent">{statusLabel}</div>
          {region && <div className="text-sm text-muted-foreground mt-1">{region}</div>}
          <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
            <Award className="h-5 w-5 text-accent" />
            {score === null ? (
              <span className="text-sm text-muted-foreground">
                {nextReviewCount} more reviewed install{nextReviewCount === 1 ? '' : 's'} to unlock your private score
              </span>
            ) : (
              <>
                <span className="text-xl font-semibold">{score}</span>
                <span className="text-sm text-muted-foreground/80">FastAmps score · private</span>
              </>
            )}
          </div>
          {score !== null && <div className="mt-1 text-xs text-muted-foreground">{reviewedCount} reviewed installs · Status: {status}</div>}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map(([label, value]) => (
            <div key={label}>
              <div className="text-2xl font-semibold">{value}</div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/80 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}