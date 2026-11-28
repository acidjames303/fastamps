import React from "react";
import { History } from "lucide-react";

const formatWhen = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Reviewer audit and revision history for one lead sheet.
export default function LeadSheetAuditTrail({ sheet }) {
  const revisions = [...(sheet.revisions || [])].reverse();
  const reviews = [...(sheet.review_history || [])].reverse();

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" /> Review and revisions
      </p>

      {reviews.length === 0 && revisions.length === 0 && (
        <p className="text-xs text-slate-400">Nothing recorded yet.</p>
      )}

      {reviews.map((review, index) => (
        <div key={`review-${index}`} className="text-xs text-slate-600">
          <span className="font-medium text-slate-800">
            {review.decision === "approved" ? "Approved" : "Returned"}
          </span>
          {" by "}{review.reviewer_name || "reviewer"} · {formatWhen(review.at)}
          {review.reason ? <span className="block text-slate-500">“{review.reason}”</span> : null}
        </div>
      ))}

      <div className="space-y-1">
        {revisions.slice(0, 12).map((revision, index) => (
          <p key={`rev-${index}`} className="text-[11px] text-slate-500">
            {formatWhen(revision.at)} · {revision.action}
            {revision.from_status && revision.to_status ? ` (${revision.from_status} → ${revision.to_status})` : ""}
            {revision.by_name ? ` · ${revision.by_name}` : ""}
            {revision.note ? ` · ${revision.note}` : ""}
          </p>
        ))}
      </div>
    </div>
  );
}