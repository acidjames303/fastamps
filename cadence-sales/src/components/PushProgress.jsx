import React from "react";
import { Progress } from "@/components/ui/progress";

// Progress bar for a data push. With a total it fills as records land; without
// one it shows a moving bar for a single indivisible push.
export default function PushProgress({ label, done = 0, total = 0 }) {
  const determinate = total > 0;
  const pct = determinate ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        {determinate && <span className="tabular-nums">{done} / {total}</span>}
      </div>
      {determinate ? (
        <Progress value={pct} className="h-2" />
      ) : (
        <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      )}
    </div>
  );
}