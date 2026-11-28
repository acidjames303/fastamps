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
// Lusha will be called at all. Cadence stores one prospect per company — contact
// counts are shown separately so a 1,600-person sheet is not mistaken for 162.
export default function RunEstimatePanel({ estimate, searchMethod }) {
  const {
    total = 0,
    recordsToProcess = 0,
    cached = 0,
    phoneSelected = false,
    recordsNeedingPhone = 0,
    companiesWithNamedContact = 0,
    companiesNeedingDiscovery = 0,
    namedContacts = 0,
    contactsMissingMobile = 0,
    contactsSeekingExtraMobile = 0,
    seekAdditive = false,
    providerLookups = [],
    maxSmartActions = 0,
    numbersReused = 0,
    recordsNotSearchable = 0,
  } = estimate || {};

  // Name the providers that are ticked, and only those.
  const lookupSentence = () => {
    if (!providerLookups.length) return "Providers will only be asked for the fields you selected.";
    const parts = providerLookups.map(
      (row) => `${row.max} ${row.label} phone lookup${row.max === 1 ? "" : "s"}`,
    );
    if (parts.length === 1) return `Up to ${parts[0]} may be made.`;
    return `Up to ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]} may be made.`;
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        Estimated run
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
        <Row label="Companies (prospect records)" value={total || recordsToProcess} />
        <Row label="Named contacts on those companies" value={namedContacts} />
        <Row label="Companies still missing any usable number" value={recordsNeedingPhone} />
        <Row label="Companies already holding a number" value={numbersReused} tone="text-emerald-700" />
        {phoneSelected && seekAdditive && (
          <>
            <Row label="Contacts with no mobile yet" value={contactsMissingMobile} />
            <Row
              label="Contacts to check for an extra Lusha mobile"
              value={contactsSeekingExtraMobile}
            />
          </>
        )}
        {phoneSelected && !seekAdditive && (
          <>
            <Row label="Companies requiring phone data" value={recordsNeedingPhone} />
            <Row label="Companies with a known named contact" value={companiesWithNamedContact} />
            <Row label="Companies requiring discovery" value={companiesNeedingDiscovery} />
            <Row label="Existing records reused" value={cached} tone="text-emerald-700" />
          </>
        )}
        {phoneSelected && providerLookups.map((row) => (
          <Row key={row.provider} label={`Maximum ${row.label} lookups`} value={row.max} />
        ))}
        <Row label="Maximum Smart Actions" value={maxSmartActions} />
        {phoneSelected && (
          <Row
            label="Companies not searchable in this mode"
            value={recordsNotSearchable}
            tone={recordsNotSearchable > 0 ? "text-amber-700" : "text-slate-900"}
          />
        )}
      </div>

      {phoneSelected && seekAdditive && namedContacts > total && (
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          Cadence holds <span className="font-semibold text-slate-800">{total}</span> company
          records, with <span className="font-semibold text-slate-800">{namedContacts}</span> named
          people across them. Maximum Lusha search checks people — not just one number per company.
        </p>
      )}

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
              ? lookupSentence()
              : "Providers will only be asked for the fields you selected."
            : "No provider will be called in this mode. No new phone numbers can be retrieved."}
        </span>
      </div>

      {phoneSelected && recordsNotSearchable > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {recordsNotSearchable} compan{recordsNotSearchable === 1 ? "y has" : "ies have"} no named
            contact to look up. Enable contact discovery to reach them.
          </span>
        </div>
      )}
    </section>
  );
}
