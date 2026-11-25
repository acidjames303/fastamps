import React from "react";
import { AlertTriangle, Database, PhoneOff } from "lucide-react";

function Row({ label, value, tone = "text-slate-900" }) {
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-semibold ${tone}`}>{value}</span>
    </>
  );
}

// Shows exactly what the configured run may consume, and states plainly whether
// Lusha will be called at all.
export default function RunEstimatePanel({ estimate, searchMethod }) {
  const {
    recordsToProcess = 0,
    cached = 0,
    phoneSelected = false,
    recordsNeedingPhone = 0,
    companiesWithNamedContact = 0,
    companiesNeedingDiscovery = 0,
    maxLushaLookups = 0,
    maxOtherProviderLookups = 0,
    maxSmartActions = 0,
    numbersReused = 0,
    recordsNotSearchable = 0,
  } = estimate || {};

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        Estimated run
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
        <Row label="Records to process" value={recordsToProcess} />
        <Row label="Existing records reused" value={cached} tone="text-emerald-700" />
        {phoneSelected && (
          <>
            <Row label="Records requiring phone data" value={recordsNeedingPhone} />
            <Row label="Companies with a known named contact" value={companiesWithNamedContact} />
            <Row label="Companies requiring discovery" value={companiesNeedingDiscovery} />
            <Row label="Maximum Lusha lookups" value={maxLushaLookups} />
            <Row label="Maximum other-provider lookups" value={maxOtherProviderLookups} />
          </>
        )}
        <Row label="Maximum Smart Actions" value={maxSmartActions} />
        {phoneSelected && (
          <>
            <Row label="Existing numbers reused" value={numbersReused} tone="text-emerald-700" />
            <Row
              label="Records not searchable in this mode"
              value={recordsNotSearchable}
              tone={recordsNotSearchable > 0 ? "text-amber-700" : "text-slate-900"}
            />
          </>
        )}
      </div>

      <div
        className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
          searchMethod === "providers"
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        {searchMethod === "providers" ? (
          <Database className="mt-0.5 h-4 w-4 flex-none" />
        ) : (
          <PhoneOff className="mt-0.5 h-4 w-4 flex-none" />
        )}
        <span>
          {searchMethod === "providers"
            ? phoneSelected
              ? `Up to ${maxLushaLookups} Lusha phone lookup${maxLushaLookups === 1 ? "" : "s"} may be made — including other known people on each company.`
              : "Providers will only be asked for the fields you selected."
            : "Lusha will not be called in this mode. No new phone numbers can be retrieved."}
        </span>
      </div>

      {phoneSelected && recordsNotSearchable > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {recordsNotSearchable} record{recordsNotSearchable === 1 ? "" : "s"} have no named
            contact to look up. Enable contact discovery to reach them.
          </span>
        </div>
      )}
    </section>
  );
}