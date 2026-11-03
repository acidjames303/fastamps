import { useState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function InstallerDocumentsList({ documents, names, title = 'Proof of approved installer status' }) {
  const [opening, setOpening] = useState(-1);
  const [error, setError] = useState('');
  const list = Array.isArray(documents) ? documents.filter(Boolean) : [];
  const labelFor = (index) => (Array.isArray(names) && names[index]) || `Document ${index + 1}`;

  const openDocument = async (uri, index) => {
    setError('');
    setOpening(index);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
      if (!signed_url) throw new Error('No link returned');
      window.open(signed_url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('That document could not be opened. Please try again.');
    } finally {
      setOpening(-1);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border p-4">
      <h3 className="font-semibold">{title}</h3>
      {!list.length ? (
        <p className="mt-2 text-sm text-muted-foreground">No documents were uploaded with this profile.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((uri, index) => (
            <li key={uri} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-2.5">
              <FileText className="h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate text-sm" title={labelFor(index)}>{labelFor(index)}</span>
              <button
                type="button"
                onClick={() => openDocument(uri, index)}
                disabled={opening === index}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {opening === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                View
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
    </section>
  );
}