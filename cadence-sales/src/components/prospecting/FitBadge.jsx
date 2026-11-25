import React from "react";
import { FIT_BAND_STYLE } from "@/lib/prospectReview";

export default function FitBadge({ band, score }) {
  if (!band) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${FIT_BAND_STYLE[band] || FIT_BAND_STYLE.low}`}>
      {band === "excluded" ? "Excluded" : `${band} · ${score ?? 0}`}
    </span>
  );
}