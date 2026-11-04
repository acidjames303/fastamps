import { useMemo } from 'react';
import { Download, FolderOpen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Stat({ label, value, tone = 'default' }) {
  const toneClass = tone === 'accent'
    ? 'text-accent'
    : tone === 'muted'
      ? 'text-muted-foreground/80'
      : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-background px-2 py-2">
      <div className={`text-base font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">{label}</div>
    </div>
  );
}

function BatchCard({ label, count, available, claimed, downloaded, created, onOpen, onDownload, downloading, highlighted }) {
  return (
    <article className={`rounded-2xl border p-4 text-left ${highlighted ? 'border-accent/40 bg-accent/[0.06]' : 'border-border bg-muted/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/80">Created {formatDate(created)}</div>
        </div>
        <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-foreground">{count} codes</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Available" value={available} tone="accent" />
        <Stat label="Claimed" value={claimed} tone="muted" />
        <Stat label="Downloaded" value={downloaded} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onOpen} className="flex-1 border-accent/30 bg-background">
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />Open
        </Button>
        <Button type="button" size="sm" onClick={onDownload} disabled={downloading || !available} className="flex-1 bg-primary text-white">
          <Download className="mr-1.5 h-3.5 w-3.5" />Download
        </Button>
      </div>
    </article>
  );
}

export default function SavedBatchesSection({ chargers, onOpen, onDownload, downloading }) {
  const batches = useMemo(() => {
    const groups = {};
    for (const charger of chargers) {
      const key = charger.batch_reference || 'No batch reference';
      (groups[key] ??= []).push(charger);
    }
    return Object.entries(groups)
      .map(([name, items]) => {
        const available = items.filter((c) => (c.claim_status || 'available') === 'available').length;
        const claimed = items.length - available;
        const downloaded = items.filter((c) => Number(c.qr_download_count || 0) > 0).length;
        const createdDates = items
          .map((c) => (c.created_date ? new Date(c.created_date) : null))
          .filter((d) => d && !Number.isNaN(d.getTime()))
          .sort((a, b) => a - b);
        return {
          name,
          count: items.length,
          available,
          claimed,
          downloaded,
          created: createdDates[0] || null,
        };
      })
      .sort((a, b) => {
        if (a.name === 'Single charger test') return 1;
        if (b.name === 'Single charger test') return -1;
        return b.count - a.count;
      });
  }, [chargers]);

  const total = chargers.length;
  const totalAvailable = chargers.filter((c) => (c.claim_status || 'available') === 'available').length;
  const totalClaimed = total - totalAvailable;
  const totalDownloaded = chargers.filter((c) => Number(c.qr_download_count || 0) > 0).length;
  const earliest = chargers
    .map((c) => (c.created_date ? new Date(c.created_date) : null))
    .filter((d) => d && !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b)[0];

  if (!total) {
    return (
      <section className="rounded-2xl border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground/80">
        No saved QR batches yet. Upload a charger CSV or create a single QR code to start.
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-4 w-4 text-accent" />
        <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Saved QR batches</h2>
        <span className="text-xs text-muted-foreground/70">· click a batch to open only its codes</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <BatchCard
          label="All batches"
          count={total}
          available={totalAvailable}
          claimed={totalClaimed}
          downloaded={totalDownloaded}
          created={earliest}
          onOpen={() => onOpen('all')}
          onDownload={() => onDownload('all')}
          downloading={downloading}
          highlighted
        />
        {batches.map((batch) => (
          <BatchCard
            key={batch.name}
            label={batch.name === 'Single charger test' ? 'Single chargers' : batch.name}
            count={batch.count}
            available={batch.available}
            claimed={batch.claimed}
            downloaded={batch.downloaded}
            created={batch.created}
            onOpen={() => onOpen(batch.name)}
            onDownload={() => onDownload(batch.name)}
            downloading={downloading}
          />
        ))}
      </div>
    </section>
  );
}