import React from "react";
import { ShieldCheck, PhoneOff, AlertTriangle } from "lucide-react";
import { screeningDetail, screeningState } from "@/lib/screeningStatus";

// Shows the 121 Prodata TPS/CTPS verdict for one account. Every number on the
// account is screened against both registers in one check, so the badge reports
// a single verdict and lists the numbers behind it on hover. An expired check is
// never shown as safe to call.
export default function ScreeningBadge({ prospect, className = "" }) {
  const state = screeningState(prospect);
  const detail = screeningDetail(prospect);
  const until = prospect?.tps_ctps_valid_until
    ? new Date(prospect.tps_ctps_valid_until).toLocaleDateString("en-GB")
    : "";

  if (state === "safe") {
    return (
      <span
        title={[detail, until ? `Valid until ${until}` : ""].filter(Boolean).join("\n")}
        className={`inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ${className}`}
      >
        <ShieldCheck className="w-3 h-3" /> TPS/CTPS safe
      </span>
    );
  }

  if (state === "listed") {
    return (
      <span
        title={detail || "One or more numbers are on a preference register"}
        className={`inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 ${className}`}
      >
        <PhoneOff className="w-3 h-3" /> Listed — do not call
      </span>
    );
  }

  if (state === "expired") {
    return (
      <span
        title={[detail, until ? `Last valid until ${until}` : ""].filter(Boolean).join("\n")}
        className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ${className}`}
      >
        <AlertTriangle className="w-3 h-3" /> Check expired — re-screen
      </span>
    );
  }

  if (state === "changed") {
    return (
      <span
        title={[detail, "A number on this account changed after the last check"].filter(Boolean).join("\n")}
        className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ${className}`}
      >
        <AlertTriangle className="w-3 h-3" /> Numbers changed — re-screen
      </span>
    );
  }

  if (state === "unavailable") {
    return (
      <span
        title={detail || "121 Prodata did not return a usable result for these numbers"}
        className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ${className}`}
      >
        <AlertTriangle className="w-3 h-3" /> Check unavailable
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] text-slate-400 ${className}`}>
      TPS/CTPS not checked
    </span>
  );
}