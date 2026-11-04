import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckSquare2, Loader2, Square, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const REVEAL_WIDTH = 88;

export default function ChargerRecordRow({ charger, selected, onToggleSelect, onSelect, onDeleted }) {
  const [revealed, setRevealed] = useState(false);
  const [confirmCharger, setConfirmCharger] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const deletable = (charger.claim_status || 'available') === 'available';
  const downloadCount = Number(charger.qr_download_count || 0);

  const handleDelete = async () => {
    if (!confirmCharger) return;
    setDeleting(true);
    try {
      const response = await base44.functions.invoke('retire-chargers', {
        charger_ids: [confirmCharger.id],
      });
      const result = response?.data || response;
      if (!result.success || result.deleted !== 1) throw new Error(result.error || 'Charger retirement could not be confirmed.');
      onDeleted?.(confirmCharger.id);
      setConfirmCharger(null);
      setRevealed(false);
    } catch (error) {
      setConfirmCharger(null);
    } finally {
      setDeleting(false);
    }
  };

  if (!deletable) {
    return (
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50" aria-hidden="true">
          <Square className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{charger.serial_number}</div>
          <div className="mt-1 text-xs text-muted-foreground/70 truncate">{charger.product_model} · {charger.batch_reference || 'No batch reference'} · Downloaded {downloadCount} time{downloadCount === 1 ? '' : 's'}</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-accent shrink-0">{charger.claim_status || 'available'}</div>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setConfirmCharger(charger)}
          className={`absolute inset-y-0 right-0 flex w-[var(--reveal)] items-center justify-center bg-destructive text-white transition-opacity ${revealed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ '--reveal': `${REVEAL_WIDTH}px` }}
          aria-label={`Delete available QR code ${charger.serial_number}`}
        >
          <Trash2 className="h-5 w-5" />
        </button>

        <motion.div
          drag="x"
          dragConstraints={{ left: -REVEAL_WIDTH, right: 0 }}
          dragElastic={0.08}
          onDragEnd={(_, info) => {
            if (info.offset.x < -REVEAL_WIDTH / 2) setRevealed(true);
            else setRevealed(false);
          }}
          animate={{ x: revealed ? -REVEAL_WIDTH : 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          onClick={() => {
            if (!revealed) onSelect?.(charger);
          }}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && !revealed) {
              event.preventDefault();
              onSelect?.(charger);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open QR label for charger ${charger.serial_number}`}
          className="flex items-center gap-3 px-5 py-4 bg-muted/60 cursor-pointer active:cursor-grabbing touch-pan-y select-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect?.(charger.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            aria-pressed={selected}
            aria-label={selected
              ? `Remove charger ${charger.serial_number} from selection`
              : `Select charger ${charger.serial_number}`}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-accent ${selected ? 'border-accent bg-accent text-white' : 'border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-accent'}`}
          >
            {selected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{charger.serial_number}</div>
            <div className="mt-1 text-xs text-muted-foreground/70 truncate">{charger.product_model} · Downloaded {downloadCount} time{downloadCount === 1 ? '' : 's'}</div>
          </div>
          <div className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-accent">available</div>
        </motion.div>
      </div>

      <AlertDialog open={!!confirmCharger} onOpenChange={(open) => { if (!open && !deleting) setConfirmCharger(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <AlertDialogTitle className="text-center">Delete this QR code?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-foreground/70">
              If already printed, you may delete the record of the code, and the incentive will no longer work for that code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel disabled={deleting}>Keep code</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</> : <>Delete code</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}