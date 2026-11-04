import { useState } from 'react';
import { CheckSquare2, ChevronLeft, ChevronRight, Download, Eye, FileDown, Loader2, Pencil, Search, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SheetSelect from '@/components/ui/sheet-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PAGE_SIZES = [10, 50, 100];

function StatusBadge({ status }) {
  const value = status || 'available';
  const styles = value === 'claimed'
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : value === 'disabled'
      ? 'border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300'
      : 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${styles}`}>{value}</span>;
}

export default function QrViewer({
  chargers,
  images,
  activeIndex,
  onGoTo,
  pageSize,
  onPageSizeChange,
  page,
  onPageChange,
  totalPages,
  selectedIds,
  onToggleSelect,
  onDownloadSingle,
  onDownloadAll,
  downloading,
  downloadProgress,
  batchLabel,
  selectedBatch,
  batchOptions,
  totalLibraryCount,
  onBatchChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onRenameBatch,
  renamingBatch,
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const canRename = onRenameBatch && selectedBatch && selectedBatch !== 'all' && selectedBatch !== 'No batch reference';

  const openRename = () => {
    if (!canRename) return;
    setRenameValue(selectedBatch);
    setRenameOpen(true);
  };

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    onRenameBatch(selectedBatch, trimmed);
    setRenameOpen(false);
  };
  const total = chargers.length;
  const safePage = Math.min(page, Math.max(totalPages - 1, 0));
  const start = safePage * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageItems = chargers.slice(start, end);
  const active = chargers[Math.min(activeIndex, Math.max(total - 1, 0))];

  const openPreview = (index) => {
    onGoTo(index);
    setPreviewOpen(true);
  };

  return (
    <section id="qr-viewer" className="scroll-mt-24 overflow-hidden rounded-3xl border border-border bg-background">
      <div className="border-b border-border bg-muted/40 p-4 md:p-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.3fr)_minmax(190px,1fr)_160px_auto] xl:items-end">
          <div>
            <label htmlFor="saved-batch-selector" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Batch</label>
            <div className="mt-1.5 flex gap-1.5">
              <SheetSelect
                id="saved-batch-selector"
                value={selectedBatch}
                onChange={onBatchChange}
                triggerClassName="rounded-xl font-semibold"
                options={[
                  ...batchOptions.map((batch) => ({
                    value: batch.name,
                    label: `${batch.name === 'Single charger test' ? 'Single chargers' : batch.name} (${batch.count})`,
                  })),
                  { value: 'all', label: `All codes (${totalLibraryCount})` },
                ]}
              />
              <button
                type="button"
                onClick={openRename}
                disabled={!canRename || renamingBatch}
                title={canRename ? 'Rename this batch' : 'This batch cannot be renamed'}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:text-accent hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="qr-search" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Search serial or PIN</label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="qr-search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Find a charger" className="h-11 bg-background pl-9" />
            </div>
          </div>

          <div>
            <SheetSelect
              id="qr-status"
              label="Status"
              value={statusFilter}
              onChange={onStatusChange}
              triggerClassName="mt-1.5 rounded-xl"
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'available', label: 'Available' },
                { value: 'claimed', label: 'Claimed' },
                { value: 'disabled', label: 'Disabled' },
              ]}
            />
          </div>

          <Button onClick={onDownloadAll} disabled={downloading || !total} className="h-11 bg-primary text-white">
            {downloading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{downloadProgress?.total ? `Preparing ${downloadProgress.current} of ${downloadProgress.total}` : 'Preparing print file'}</>
              : <><FileDown className="mr-2 h-4 w-4" />Download batch</>}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Show</span>
            {PAGE_SIZES.map((value) => (
              <button key={value} type="button" onClick={() => onPageSizeChange(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageSize === value ? 'bg-primary text-white' : 'border border-border bg-background text-muted-foreground hover:text-foreground'}`}>
                {value}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={safePage === 0} onClick={() => onPageChange(safePage - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span>
            </Button>
            <span className="min-w-32 text-center text-xs text-muted-foreground">
              {total ? `Showing ${start + 1} to ${end} of ${total}` : 'No matching codes'}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={!total || safePage >= totalPages - 1} onClick={() => onPageChange(safePage + 1)} aria-label="Next page">
              <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {!total ? (
        <div className="p-10 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h3 className="mt-3 font-semibold">No QR codes found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try changing the search or status filter.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] border-collapse">
              <thead className="bg-muted/35 text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="w-16 px-4 py-3">Select</th>
                  <th className="px-4 py-3">Serial number</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Downloads</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageItems.map((charger, localIndex) => {
                  const index = start + localIndex;
                  const status = charger.claim_status || 'available';
                  const available = status === 'available';
                  const selected = selectedIds.includes(charger.id);
                  return (
                    <tr key={charger.id} className="transition hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <button type="button" disabled={!available} onClick={() => onToggleSelect(charger.id)} aria-label={selected ? `Deselect ${charger.serial_number}` : `Select ${charger.serial_number}`} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${selected ? 'border-accent bg-accent text-white' : 'border-border bg-background text-muted-foreground'} ${!available ? 'cursor-not-allowed opacity-35' : 'hover:border-accent hover:text-accent'}`}>
                          {selected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold">{charger.serial_number}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{charger.product_model || 'Alpha 7'}</td>
                      <td className="max-w-64 px-4 py-3 text-sm text-muted-foreground"><span className="block truncate" title={charger.batch_reference}>{charger.batch_reference || 'No batch reference'}</span></td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3 text-center text-sm text-muted-foreground">{Number(charger.qr_download_count || 0)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => openPreview(index)}><Eye className="mr-2 h-4 w-4" />View QR</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {pageItems.map((charger, localIndex) => {
              const index = start + localIndex;
              const status = charger.claim_status || 'available';
              const available = status === 'available';
              const selected = selectedIds.includes(charger.id);
              return (
                <article key={charger.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <button type="button" disabled={!available} onClick={() => onToggleSelect(charger.id)} aria-label={selected ? `Deselect ${charger.serial_number}` : `Select ${charger.serial_number}`} className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${selected ? 'border-accent bg-accent text-white' : 'border-border text-muted-foreground'} ${!available ? 'opacity-35' : ''}`}>
                      {selected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{charger.serial_number}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{charger.product_model || 'Alpha 7'} · {charger.batch_reference || 'No batch reference'}</div>
                      <div className="mt-2"><StatusBadge status={status} /></div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => openPreview(index)}><Eye className="mr-1.5 h-4 w-4" />View</Button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">QR code {active.serial_number}</DialogTitle>
                <DialogDescription>{active.product_model || 'Alpha 7'} · {active.batch_reference || batchLabel}</DialogDescription>
              </DialogHeader>
              <div className="mt-2 text-center">
                {images[active.id] ? (
                  <img src={images[active.id]} alt={`QR instruction label for ${active.serial_number}`} className="mx-auto w-full max-w-72 rounded-xl bg-white p-2" />
                ) : (
                  <div className="mx-auto flex h-72 max-w-72 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Generating label</div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3 text-left text-sm">
                  <div className="rounded-xl bg-muted/60 p-3"><span className="block text-xs text-muted-foreground">Serial number</span><strong>{active.serial_number}</strong></div>
                  <div className="rounded-xl bg-muted/60 p-3"><span className="block text-xs text-muted-foreground">PIN</span><strong>{active.pin_code}</strong></div>
                  <div className="rounded-xl bg-muted/60 p-3"><span className="block text-xs text-muted-foreground">Status</span><span className="mt-1 block"><StatusBadge status={active.claim_status} /></span></div>
                  <div className="rounded-xl bg-muted/60 p-3"><span className="block text-xs text-muted-foreground">Downloads</span><strong>{Number(active.qr_download_count || 0)}</strong></div>
                </div>
                {active.qr_last_downloaded_at && <p className="mt-3 text-xs text-muted-foreground">Last downloaded {new Date(active.qr_last_downloaded_at).toLocaleString('en-GB')}</p>}
                <div className="mt-5 flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" disabled={activeIndex === 0} onClick={() => onGoTo(activeIndex - 1)} aria-label="Previous QR code"><ChevronLeft className="h-5 w-5" /></Button>
                  <Button onClick={() => onDownloadSingle(active)} className="flex-1 bg-primary text-white"><Download className="mr-2 h-4 w-4" />Download label</Button>
                  <Button type="button" variant="outline" size="icon" disabled={activeIndex >= total - 1} onClick={() => onGoTo(activeIndex + 1)} aria-label="Next QR code"><ChevronRight className="h-5 w-5" /></Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={(open) => { if (!renamingBatch) setRenameOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename batch</DialogTitle>
            <DialogDescription>Give this batch a clearer reference name. Every QR code in the batch is updated at once.</DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <label htmlFor="batch-rename-input" className="text-xs font-medium text-muted-foreground">New batch name</label>
            <Input
              id="batch-rename-input"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') submitRename(); }}
              placeholder="e.g. JANUARY-ROLLOUT-02"
              className="mt-1.5 h-11"
              autoFocus
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={renamingBatch}>Cancel</Button>
            <Button type="button" onClick={submitRename} disabled={renamingBatch || !renameValue.trim() || renameValue.trim() === selectedBatch} className="bg-primary text-white">
              {renamingBatch ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Renaming…</> : <><Pencil className="mr-2 h-4 w-4" />Save name</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}