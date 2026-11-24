import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { getOutcomeLabel } from "@/lib/outcomeRules";

const REVEAL = 88; // px width of the delete action revealed on swipe

export default function RecentCallRow({ log, onDeleted }) {
  const [dragX, setDragX] = useState(0);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const dragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(0);

  const onPointerDown = (e) => {
    dragging.current = true;
    moved.current = 0;
    startX.current = e.clientX;
    startY.current = e.clientY;
  };

  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.abs(dy) > Math.abs(dx)) return; // let vertical scroll win
    const base = open ? -REVEAL : 0;
    const next = Math.max(-REVEAL, Math.min(0, base + dx));
    moved.current = next - base;
    setDragX(next);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const shouldOpen = moved.current < -REVEAL / 2 || dragX < -REVEAL / 2;
    setOpen(shouldOpen);
    setDragX(shouldOpen ? -REVEAL : 0);
  };

  const doDelete = async () => {
    setRemoving(true);
    try {
      if (log.contact_id) {
        await base44.entities.Contact.delete(log.contact_id).catch(() => {});
      }
      await base44.entities.CallLog.delete(log.id).catch(() => {});
      onDeleted?.(log.id, log.contact_id);
    } finally {
      setRemoving(false);
      setConfirmOpen(false);
      setOpen(false);
      setDragX(0);
    }
  };

  return (
    <div className="relative border-b border-slate-100 last:border-0 select-none">
      {/* red delete action behind the row */}
      <div className="absolute inset-0 flex items-center justify-end bg-rose-600">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="h-full w-[88px] flex items-center justify-center gap-1.5 text-white text-sm font-medium hover:bg-rose-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>

      {/* swipeable foreground */}
      <div
        className="px-6 py-4 flex items-center justify-between text-sm bg-white relative cursor-grab active:cursor-grabbing"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging.current ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div>
          <p className="font-medium text-slate-900">{log.contact_name || "Unknown"}</p>
          <p className="text-slate-500 text-xs">{log.company} · {log.phone}</p>
        </div>
        <span className={`text-xs uppercase tracking-widest ${(log.primary_outcome || log.outcome) === "invalid_number" ? "text-rose-600" : "text-slate-400"}`}>
          {getOutcomeLabel(log.primary_outcome || log.outcome || "other")}
        </span>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !removing && setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900">Delete this contact altogether?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  This permanently removes {log.contact_name || "this contact"} and all their call history from Cadence. This can't be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={removing} className="rounded-full">
                Cancel
              </Button>
              <Button onClick={doDelete} disabled={removing} className="rounded-full bg-rose-600 hover:bg-rose-500 text-white">
                {removing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {removing ? "Removing…" : "Delete from Cadence"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}