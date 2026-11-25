import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";

const REASONS = [
  { key: "no_number", label: "No number" },
  { key: "bad_data", label: "Bad data" },
  { key: "removal_requested", label: "Removal requested" },
];

export default function RemoveControl({ onRemove, disabled }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
        <p className="text-xs text-slate-300 mb-2">Reason for removal — this deletes the record and logs it.</p>
        <div className="grid grid-cols-3 gap-2">
          {REASONS.map((r) => (
            <Button
              key={r.key}
              size="sm"
              onClick={() => { onRemove(r.key); setOpen(false); }}
              className="rounded-full bg-rose-500/90 hover:bg-rose-500 text-white text-xs h-9"
            >
              {r.label}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          className="rounded-full mt-2 w-full text-slate-300 hover:text-white hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5 mr-1" /> Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={() => setOpen(true)}
      disabled={disabled}
      className="rounded-full w-full h-10 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-300"
    >
      <Trash2 className="w-4 h-4 mr-2" /> Remove record
    </Button>
  );
}