import { CheckSquare2, Download, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QrSelectionBar({
  selectedCount,
  hasOpenViewer,
  pageAvailableCount,
  batchAvailableCount,
  allAvailableCount,
  allAvailableSelected,
  onSelectPage,
  onSelectBatch,
  onSelectAll,
  onClear,
  onDownloadSelected,
  onDeleteSelected,
  downloading,
  deleting,
}) {
  const acrossAll = allAvailableSelected && selectedCount >= allAvailableCount && allAvailableCount > 0;

  return (
    <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {selectedCount > 0 ? (
            <><CheckSquare2 className="h-4 w-4 text-accent" />{selectedCount} QR code{selectedCount === 1 ? '' : 's'} selected{acrossAll ? ' across all batches' : ''}</>
          ) : (
            <><Square className="h-4 w-4 text-muted-foreground" />No QR codes selected</>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onSelectPage} disabled={!hasOpenViewer || !pageAvailableCount} className="border-border bg-background">
            Select page{pageAvailableCount ? ` (${pageAvailableCount})` : ''}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onSelectBatch} disabled={!hasOpenViewer || !batchAvailableCount} className="border-border bg-background">
            Select batch{batchAvailableCount ? ` (${batchAvailableCount})` : ''}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onSelectAll} disabled={!allAvailableCount} className="border-border bg-background">
            Select all available{allAvailableCount ? ` (${allAvailableCount})` : ''}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClear} disabled={!selectedCount || downloading || deleting}>
            Clear
          </Button>
          <Button type="button" size="sm" onClick={onDownloadSelected} disabled={!selectedCount || downloading || deleting} className="bg-primary text-white">
            <Download className="mr-1.5 h-3.5 w-3.5" />Download selected
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={onDeleteSelected} disabled={!selectedCount || downloading || deleting}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete selected
          </Button>
        </div>
      </div>
    </div>
  );
}