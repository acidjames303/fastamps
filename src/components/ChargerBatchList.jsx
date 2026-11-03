import { useMemo, useState } from 'react';
import { CheckSquare2, ChevronDown, ChevronRight, FolderOpen, Square } from 'lucide-react';
import ChargerRecordRow from '@/components/ChargerRecordRow';
import { Button } from '@/components/ui/button';

export default function ChargerBatchList({ chargers, onSelect, onToggleSelect, onToggleBatchSelect, selectedIds = [], onDeleted, onOpenBatch }) {
  const [openBatches, setOpenBatches] = useState({});

  const batches = useMemo(() => {
    const groups = {};
    for (const charger of chargers) {
      const key = charger.batch_reference || 'No batch reference';
      (groups[key] ??= []).push(charger);
    }
    return Object.entries(groups)
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => {
        if (a.name === 'Single charger test') return 1;
        if (b.name === 'Single charger test') return -1;
        return b.items.length - a.items.length;
      });
  }, [chargers]);

  if (chargers.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-muted-foreground/80">No charger QR records yet.</div>
    );
  }

  const toggleBatch = (name) => setOpenBatches((state) => ({ ...state, [name]: !state[name] }));
  const batchAllSelected = (batch) => batch.items.length > 0 && batch.items.every((c) => selectedIds.includes(c.id));
  const batchSelectedCount = (batch) => batch.items.filter((c) => selectedIds.includes(c.id)).length;

  return (
    <div className="rounded-2xl border border-border bg-muted/60 overflow-hidden">
      {batches.map((batch, batchIndex) => {
        const open = !!openBatches[batch.name];
        const allSel = batchAllSelected(batch);
        const selCount = batchSelectedCount(batch);
        const isSingle = batch.name === 'Single charger test';

        return (
          <div key={batch.name} className={batchIndex > 0 ? 'border-t border-border' : ''}>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-4 py-3">
              <button
                type="button"
                onClick={() => toggleBatch(batch.name)}
                className="flex min-w-0 items-center gap-2 text-left"
                aria-expanded={open}
              >
                {open
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="truncate text-sm font-semibold">{isSingle ? 'Single chargers' : batch.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground/70">{batch.items.length} code{batch.items.length === 1 ? '' : 's'}</span>
                {selCount > 0 && <span className="shrink-0 text-xs text-accent">{selCount} selected</span>}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleBatchSelect?.(batch.items.map((c) => c.id))}
                  aria-pressed={allSel}
                  aria-label={allSel ? `Remove all ${batch.name} codes from selection` : `Select all ${batch.name} codes`}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-accent ${allSel ? 'border-accent bg-accent text-white' : 'border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-accent'}`}
                >
                  {allSel ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenBatch?.(batch.name)}
                  className="border-accent/30 bg-background"
                >
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" />Open
                </Button>
              </div>
            </div>
            {open && (
              <div className="divide-y divide-border border-t border-border">
                {batch.items.map((charger) => (
                  <ChargerRecordRow
                    key={charger.id}
                    charger={charger}
                    selected={selectedIds.includes(charger.id)}
                    onToggleSelect={onToggleSelect}
                    onSelect={onSelect}
                    onDeleted={onDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}