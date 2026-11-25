import React from "react";
import { Download, X, CheckCircle2, AlertTriangle, Globe, Phone, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PHONE_RESULT_LABELS } from "@/lib/enrichmentRun";

// Post-enrichment batch summary. Shows counts of companies processed, in/out
// of geography, companies found, landlines, contacts, emails, mobiles, partial
// results, and failed provider requests. Allows export of summary and results.
export default function EnrichmentBatchSummary({ summary, prospects, onClose }) {
  if (!summary) return null;

  const {
    processed = 0, enriched = 0, failed = 0, out_of_scope = 0,
    truncated = false, skipped_cooldown = 0,
  } = summary;

  // Compute transparency metrics from the prospect data.
  const inGeography = prospects.filter((p) => p.geography_status !== "out_of_scope").length;
  const excludedByGeo = prospects.filter((p) => p.geography_status === "out_of_scope").length;
  const companiesFound = prospects.filter((p) => p.company_found).length;
  const landlinesFound = prospects.filter((p) => p.landline_found).length;
  const contactsFound = prospects.filter((p) => p.decision_makers_found).length;
  const emailsFound = prospects.filter((p) => p.work_email_found).length;
  const mobilesFound = prospects.filter((p) => p.mobile_found).length;
  const partialResults = prospects.filter((p) => p.enrichment_status === "partially_enriched").length;
  const failedProviders = prospects.filter((p) => p.enrichment_status === "failed" || p.enrichment_status === "provider_unavailable").length;

  // Precise phone outcomes, so a run never just says "no information found".
  const phoneResultCounts = Object.entries(
    prospects.reduce((acc, p) => {
      const key = p.field_provenance && p.field_provenance.phone && p.field_provenance.phone.lookup_result;
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const metrics = [
    { label: "Companies processed", value: processed, icon: CheckCircle2, color: "text-slate-700" },
    { label: "In geography", value: inGeography, icon: Globe, color: "text-emerald-600" },
    { label: "Excluded by geography", value: excludedByGeo, icon: Globe, color: "text-amber-600" },
    { label: "Companies found", value: companiesFound, icon: CheckCircle2, color: "text-slate-700" },
    { label: "Landlines found", value: landlinesFound, icon: Phone, color: "text-slate-700" },
    { label: "Decision-makers found", value: contactsFound, icon: User, color: "text-slate-700" },
    { label: "Work emails found", value: emailsFound, icon: Mail, color: "text-slate-700" },
    { label: "Mobiles found", value: mobilesFound, icon: Phone, color: "text-emerald-600" },
    { label: "Partial results", value: partialResults, icon: AlertTriangle, color: "text-amber-600" },
    { label: "Failed provider requests", value: failedProviders, icon: AlertTriangle, color: "text-rose-600" },
  ];

  const exportSummary = () => {
    // One row per person so the download matches prospecting contact exports.
    const headers = [
      "First name", "Last name", "Company", "Phone", "Personal email", "Job title",
      "Mobile", "Direct dial", "Switchboard", "Date", "Country", "Geography",
      "Status", "Provider", "Provider error",
    ];
    const rows = [];
    for (const p of prospects || []) {
      const contacts = Array.isArray(p.contacts) && p.contacts.length
        ? p.contacts
        : [{ name: p.full_name || "", title: p.job_title || "", email: p.email || "", mobile: p.mobile || "", phone: p.phone || "", direct_dial: p.direct_dial || "" }];
      const date = p.last_attempted_at ? new Date(p.last_attempted_at).toLocaleDateString("en-GB") : "";
      const switchboard = p.landline || p.company_phone || "";
      for (const c of contacts) {
        const parts = String(c.name || c.full_name || "").trim().split(/\s+/).filter(Boolean);
        const mobile = c.mobile || "";
        const direct = c.direct_dial || "";
        const phone = mobile || direct || c.phone || switchboard || "";
        rows.push([
          parts[0] || "",
          parts.slice(1).join(" "),
          p.company_name || "",
          phone,
          c.email || "",
          c.title || c.job_title || "",
          mobile,
          direct,
          switchboard,
          date,
          p.country_code || "",
          p.geography_status || "",
          p.enrichment_status || "",
          p.provider_used || "",
          p.provider_error || "",
        ]);
      }
    }
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "enrichment-contacts.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl bg-white border border-emerald-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <h3 className="font-display text-lg font-semibold text-slate-900">Enrichment batch summary</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportSummary} variant="outline" size="sm" className="rounded-full border-slate-300">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export contacts
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <m.icon className={`w-4 h-4 ${m.color} mb-1.5`} />
            <p className="text-2xl font-semibold text-slate-900">{m.value}</p>
            <p className="text-xs text-slate-500">{m.label}</p>
          </div>
        ))}
      </div>

      {phoneResultCounts.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Phone lookups
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {phoneResultCounts.map(([key, count]) => (
              <div key={key} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600">{PHONE_RESULT_LABELS[key] || key}</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(truncated || skipped_cooldown > 0) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
          {truncated && <p>Processing was truncated — run enrichment again to continue.</p>}
          {skipped_cooldown > 0 && <p>{skipped_cooldown} prospect(s) skipped due to 7-day not-found cooldown.</p>}
        </div>
      )}
    </div>
  );
}