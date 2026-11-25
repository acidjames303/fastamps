import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BadgeCheck, Check, Loader2, Phone, Smartphone, Star, X } from "lucide-react";

const TYPE_LABEL = {
  mobile: "Mobile",
  direct: "Direct",
  switchboard: "Switchboard",
  geographic: "Landline",
  non_geographic: "Non-geographic",
  premium: "Premium",
  unknown: "Number",
  invalid: "Unusable",
};

const SCREENING_TONE = {
  safe: "bg-emerald-50 text-emerald-700 border-emerald-200",
  listed: "bg-rose-50 text-rose-700 border-rose-200",
  unavailable: "bg-amber-50 text-amber-700 border-amber-200",
  not_applicable: "bg-slate-100 text-slate-500 border-slate-200",
  not_checked: "bg-slate-100 text-slate-500 border-slate-200",
};

const SCREENING_LABEL = {
  safe: "TPS clear",
  listed: "On TPS/CTPS",
  unavailable: "No verdict",
  not_applicable: "Not UK — not screened",
  not_checked: "Not screened",
};

const PROSPECT_PHONE_TYPE = {
  mobile: "mobile",
  direct: "geographic",
  geographic: "geographic",
  non_geographic: "non_geographic",
  switchboard: "switchboard",
  premium: "premium",
  unknown: "unknown",
};

// Every number Cadence holds for one person, kept side by side. The caller
// decides which one is right — nothing here is guessed or overwritten, and a
// number marked wrong stays visible for audit.
export default function PhoneCandidates({ prospect, onPreferred }) {
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!prospect?.id) return;
    try {
      const found = await base44.entities.ContactPhone.filter({ prospect_id: prospect.id }, "-created_date", 100);
      setRows(Array.isArray(found) ? found : found?.items || []);
    } catch (e) {
      setError(e?.message || "Could not load the numbers.");
    }
  }, [prospect?.id]);

  useEffect(() => { load(); }, [load]);

  const decide = async (row, action) => {
    setBusyId(row.id);
    setError("");
    try {
      const at = new Date().toISOString();
      const entry = { at, by_user_id: prospect.created_by_id || "", action };
      const status = action === "prefer" ? "preferred" : action === "confirm" ? "confirmed" : "wrong";
      await base44.entities.ContactPhone.update(row.id, {
        status,
        decided_at: at,
        audit: [...(Array.isArray(row.audit) ? row.audit : []), entry],
      });
      // Prefer always promotes the number onto the prospect. Confirm also
      // marks call-ready when this row is already the preferred / primary
      // number — previously Confirm only updated ContactPhone and left
      // phone_status stuck on provider_returned_unverified.
      const isPrimary =
        row.status === "preferred"
        || String(prospect.phone || "").replace(/\s+/g, "") === String(row.value || row.normalised || "").replace(/\s+/g, "")
        || String(prospect.mobile || "").replace(/\s+/g, "") === String(row.value || row.normalised || "").replace(/\s+/g, "");

      if (action === "prefer" || (action === "confirm" && isPrimary)) {
        await base44.entities.Prospect.update(prospect.id, {
          phone: row.value,
          phone_type: PROSPECT_PHONE_TYPE[row.phone_type] || "unknown",
          phone_status: "manually_confirmed",
          phone_source: row.source,
          phone_verified_at: at,
          ...(PROSPECT_PHONE_TYPE[row.phone_type] === "mobile" || row.phone_type === "mobile"
            ? { mobile: row.value }
            : {}),
        });
        await onPreferred?.(prospect.id);
      }
      await load();
    } catch (e) {
      setError(e?.message || "Could not save that choice.");
    } finally {
      setBusyId("");
    }
  };

  if (!rows) {
    return (
      <p className="flex items-center gap-1.5 px-1 py-1 text-[11px] text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading numbers…
      </p>
    );
  }

  if (!rows.length) {
    return <p className="px-1 py-1 text-[11px] text-slate-400">No numbers held for this person yet.</p>;
  }

  return (
    <div className="space-y-1.5 rounded-xl bg-slate-50 p-2">
      {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2 py-1.5">
          <a
            href={`tel:${String(row.normalised || row.value).replace(/\s+/g, "")}`}
            className={`inline-flex items-center gap-1 font-mono text-xs ${
              row.status === "wrong" ? "text-slate-400 line-through" : "text-slate-800 hover:text-emerald-600"
            }`}
          >
            {row.phone_type === "mobile" ? <Smartphone className="h-3 w-3 text-emerald-600" /> : <Phone className="h-3 w-3" />}
            {row.value}
          </a>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
            {TYPE_LABEL[row.phone_type] || "Number"}
          </span>
          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${SCREENING_TONE[row.screening_status] || SCREENING_TONE.not_checked}`}>
            {SCREENING_LABEL[row.screening_status] || "Not screened"}
          </span>
          {row.source && <span className="text-[10px] text-slate-400">{row.source}</span>}
          {row.status === "preferred" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700">
              <Star className="h-3 w-3" /> Preferred
            </span>
          )}
          {row.status === "confirmed" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700">
              <BadgeCheck className="h-3 w-3" /> Confirmed
            </span>
          )}
          {row.status === "wrong" && <span className="text-[10px] text-rose-600">Marked wrong</span>}
          <span className="ml-auto flex items-center gap-1">
            {busyId === row.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            ) : (
              <>
                {row.status !== "preferred" && (
                  <button
                    type="button"
                    onClick={() => decide(row, "prefer")}
                    className="rounded-full px-2 py-0.5 text-[10px] text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    Use this number
                  </button>
                )}
                {row.status !== "confirmed" && (
                  <button
                    type="button"
                    onClick={() => decide(row, "confirm")}
                    aria-label="Mark this number confirmed"
                    className="rounded-full p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}
                {row.status !== "wrong" && (
                  <button
                    type="button"
                    onClick={() => decide(row, "wrong")}
                    aria-label="Mark this number wrong"
                    className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </span>
        </div>
      ))}
      <p className="px-1 text-[10px] text-slate-400">
        Screened numbers are checked one at a time. A UK verdict is never applied to an Irish number.
      </p>
    </div>
  );
}