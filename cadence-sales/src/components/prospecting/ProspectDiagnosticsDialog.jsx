import React from "react";
import { X, AlertCircle, CheckCircle2, Mail, Phone, Lightbulb } from "lucide-react";
import { PHONE_RESULT_LABELS } from "@/lib/enrichmentRun";

// Diagnostic dialog showing why a prospect has missing data, which providers
// were tried, and actionable suggestions for next steps.
export default function ProspectDiagnosticsDialog({ prospect, onClose }) {
  if (!prospect) return null;

  const providerError = prospect.provider_error || "";
  const providerUsed = prospect.provider_used || "";
  const enrichmentStatus = prospect.enrichment_status || "pending";

  const hasEmail = !!(prospect.email && prospect.email_type === "personal_work");
  const hasGenericEmail = !!(prospect.email && (prospect.email_type === "generic_company" || prospect.email_type === "role_based_work"));
  const hasPhone = !!prospect.phone;
  const hasLandline = !!prospect.landline;
  // Precise phone outcome recorded by the enrichment run.
  const phoneProvenance = prospect.field_provenance?.phone || {};
  const phoneLookup = phoneProvenance.lookup_result || "";
  const phoneLookupMessage = phoneProvenance.lookup_message || "";
  const hasContacts = !!(prospect.contacts && prospect.contacts.length > 0);

  // Parse the provider_error into individual diagnostic lines.
  const errorLines = providerError ? providerError.split(";").map((s) => s.trim()).filter(Boolean) : [];

  // Suggest next steps based on what's missing.
  const suggestions = [];
  if (!hasEmail && !hasGenericEmail) {
    suggestions.push("No email found at all — try the 'Find a personal work email' enrichment mode to run a targeted AI web search.");
  } else if (!hasEmail && hasGenericEmail) {
    suggestions.push("Only a generic company inbox was found (info@, sales@). Try the 'Find a personal work email' mode to search for the decision-maker's direct address.");
  }
  if (!hasPhone && !hasLandline) {
    suggestions.push("No phone number found — connect Lusha or FullEnrich for direct mobile numbers, or run 'Find a direct or mobile number' enrichment.");
  }
  if (!hasContacts) {
    suggestions.push("No decision-makers identified — run 'Find a better decision-maker' enrichment to search Apollo and LinkedIn.");
  }
  if (providerError.includes("Free plan")) {
    suggestions.push("Apollo Free plan doesn't include API access — upgrade at apollo.io/pricing to enable contact enrichment.");
  }
  if (providerError.includes("company not found")) {
    suggestions.push("This company wasn't found in Apollo's database — the AI web research may still find contacts. Try running enrichment with AI research enabled.");
  }
  if (enrichmentStatus === "failed") {
    suggestions.push("Enrichment failed — this is usually a timeout or provider error. Try re-enriching this single record.");
  }
  if (suggestions.length === 0 && hasEmail && hasPhone) {
    suggestions.push("This record looks complete. If the email bounces, try 'Check for newer information' to re-verify.");
  }

  const fields = [
    { label: "Personal work email", found: hasEmail, value: prospect.email },
    { label: "Generic inbox", found: hasGenericEmail, value: prospect.generic_email || prospect.email },
    { label: "Mobile / direct number", found: hasPhone && (!hasLandline || prospect.phone !== prospect.landline), value: prospect.phone },
    { label: "Company landline", found: hasLandline, value: prospect.landline },
    { label: "Decision-makers", found: hasContacts, value: hasContacts ? `${prospect.contacts.length} found` : "None" },
    { label: "Domain", found: !!prospect.domain, value: prospect.domain },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full my-4 max-h-[calc(100vh-2rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" /> Enrichment diagnostics
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Company info */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-900">{prospect.company_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {[prospect.domain, prospect.industry, prospect.location].filter(Boolean).join(" · ") || "No company data available"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Last provider: <span className="font-medium text-slate-600">{providerUsed || "none"}</span>
              {" · "}
              Status: <span className="font-medium text-slate-600">{enrichmentStatus.replace(/_/g, " ")}</span>
            </p>
          </div>

          {/* Fields found vs missing */}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Fields</p>
            <div className="space-y-1.5">
              {fields.map((f) => (
                <div key={f.label} className="flex items-center justify-between rounded-lg p-2 bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    {f.found ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300" />
                    )}
                    <span className={`text-sm ${f.found ? "text-slate-700" : "text-slate-400"}`}>{f.label}</span>
                  </div>
                  <span className={`text-xs ${f.found ? "text-slate-600" : "text-slate-300"} truncate max-w-[200px]`}>
                    {f.value || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Phone lookup outcome — never just "no information found" */}
          {phoneLookup && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Phone lookup</p>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-medium text-slate-700">
                  {PHONE_RESULT_LABELS[phoneLookup] || phoneLookup}
                </p>
                {phoneLookupMessage && (
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{phoneLookupMessage}</p>
                )}
              </div>
            </div>
          )}

          {/* Provider failure reasons */}
          {errorLines.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Why data is missing</p>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 space-y-1.5">
                {errorLines.map((line, i) => (
                  <p key={i} className="text-xs text-rose-700 leading-relaxed flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {line}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Contacts found */}
          {hasContacts && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Decision-makers found</p>
              <div className="space-y-1.5">
                {(prospect.contacts || []).slice(0, 5).map((c, i) => (
                  <div key={i} className="rounded-lg p-2 bg-slate-50 border border-slate-100">
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{c.name}</span>
                      {c.title && <span className="text-slate-400"> — {c.title}</span>}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {c.email && (
                        <span className="text-xs text-blue-600 flex items-center gap-0.5">
                          <Mail className="w-3 h-3" /> {c.email}
                          {c.email_status === "inferred" && <span className="text-amber-600 ml-0.5">· inferred</span>}
                        </span>
                      )}
                      {c.phone && (
                        <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                          <Phone className="w-3 h-3" /> {c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {prospect.contacts.length > 5 && (
                  <p className="text-xs text-slate-400">+{prospect.contacts.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" /> Suggested next steps
              </p>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
                {suggestions.map((s, i) => (
                  <p key={i} className="text-xs text-amber-800 leading-relaxed">{s}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="w-full rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-slate-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}