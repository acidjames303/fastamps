import React from "react";

/** Purple source tag so Lusha-sourced numbers are unmistakable in Cadence. */
export default function LushaBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-purple-300 bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800 ${className}`}
    >
      Lusha
    </span>
  );
}

export function isLushaSource(source) {
  return String(source || "").toLowerCase() === "lusha";
}
