import { useRef, useState } from 'react';
import { FileCheck2, FileText, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const MAX_DOCUMENTS = 10;
const MAX_FILE_MB = 10;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export default function InstallerDocumentsUpload({ documents = [], onChange, disabled = false, optional = true }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const chooseFiles = () => inputRef.current?.click();

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');

    const room = MAX_DOCUMENTS - documents.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_DOCUMENTS} documents.`);
      return;
    }

    const accepted = [];
    for (const file of files.slice(0, room)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`“${file.name}” is larger than ${MAX_FILE_MB} MB.`);
        continue;
      }
      if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
        setError(`“${file.name}” must be a PDF or an image.`);
        continue;
      }
      accepted.push(file);
    }
    if (files.length > room) setError(`Only the first ${room} of those files were added. You can upload up to ${MAX_DOCUMENTS} documents.`);
    if (!accepted.length) return;

    setUploading(true);
    try {
      const uploaded = [];
      for (const file of accepted) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        if (file_uri) uploaded.push({ name: file.name, uri: file_uri });
      }
      if (!uploaded.length) throw new Error('Those documents could not be uploaded.');
      onChange([...documents, ...uploaded]);
    } catch (err) {
      setError(err?.message || 'Those documents could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (index) => {
    setError('');
    onChange(documents.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex gap-3">
        <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div>
          <div className="text-sm font-medium">Proof you are an approved installer{optional && <> <span className="font-normal text-muted-foreground">(optional)</span></>}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Add one or more documents showing you are a registered or approved installer, for example your NICEIC or NAPIT registration, your ECS card or your public liability insurance. Add as many as you need.
          </p>
        </div>
      </div>

      {documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc, index) => (
            <li key={doc.uri} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-2.5">
              <FileText className="h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate text-sm" title={doc.name}>{doc.name}</span>
              <button
                type="button"
                onClick={() => removeDocument(index)}
                disabled={disabled || uploading}
                aria-label={`Remove ${doc.name}`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
        onChange={handleFiles}
        className="sr-only"
      />

      <Button
        type="button"
        variant="outline"
        onClick={chooseFiles}
        disabled={disabled || uploading || documents.length >= MAX_DOCUMENTS}
        className="h-11 w-full border-dashed"
      >
        {uploading
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
          : <><Paperclip className="mr-2 h-4 w-4" />{documents.length ? 'Add another document' : 'Choose documents'}</>}
      </Button>

      <p className="text-xs text-muted-foreground">PDF or image, up to {MAX_FILE_MB} MB each.</p>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}