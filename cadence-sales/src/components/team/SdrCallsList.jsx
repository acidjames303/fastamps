import React from "react";
import { Link } from "react-router-dom";
import { Phone } from "lucide-react";

const at = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const length = (s) => {
  const secs = Math.round(Number(s) || 0);
  if (!secs) return "—";
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
};

// The calls this caller actually made, newest first — who they rang, what
// happened, and a way into the campaign the call belongs to.
export default function SdrCallsList({ calls = [] }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Phone className="w-4 h-4" /> Recent calls
        </h2>
        <span className="text-[11px] text-slate-400">{calls.length} shown</span>
      </div>
      {calls.length === 0 ? (
        <p className="text-sm text-slate-400 p-6">No calls logged yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
          {calls.map((call) => (
            <div key={call.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium text-slate-900">{call.company || "Unknown company"}</p>
                {call.contact_name && <span className="text-xs text-slate-500">· {call.contact_name}</span>}
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    call.connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {call.outcome}
                </span>
                <span className="text-[11px] text-slate-400 ml-auto">{at(call.at)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {call.phone ? `${call.phone} · ` : ""}
                {length(call.duration_seconds)}
                {call.campaign_id ? (
                  <>
                    {" · "}
                    <Link to={`/campaigns/${call.campaign_id}/accounts`} className="text-emerald-700 hover:underline">
                      {call.campaign_name || "Campaign"}
                    </Link>
                  </>
                ) : null}
              </p>
              {call.notes && <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 whitespace-pre-wrap">{call.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}