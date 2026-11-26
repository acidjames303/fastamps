import React from "react";
import { Link } from "react-router-dom";
import { Download, X, CheckCircle2, AlertTriangle, Globe, Phone, Mail, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PHONE_RESULT_LABELS } from "@/lib/enrichmentRun";
import { enrichmentNextAction } from "@/lib/enrichmentNextAction";

// Post-enrichment batch summary. Shows counts of companies processed, in/out
// of geography, companies found, landlines, contacts, emails, mobiles, partial
// results, and failed provider requests — then one clear next step.
export default function EnrichmentBatchSummary({
  summary,
  prospects = [],
  listId = "",
  onClose,
  onFilterAttention,
}) {
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
  const phonesFound = prospects.filter((p) => p.phone || p.landline || p.mobile_found || p.landline_found).length;
  const partialResults = prospects.filter((p) => p.enrichment_status === "partially_enriched").length;
  const failedProviders = prospects.filter((p) => p.enrichment_status === "failed" || p.enrichment_status === "provider_unavailable").length;

  const next = enrichmentNextAction({
    listId,
    completed: enriched || processed,
    partial: partialResults,
    failed: failed || failedProviders,
    phonesFound: Math.max(phonesFound, mobilesFound + landlinesFound),
    emailsFound,
    contactsFound,
    onProspectingPage: true,
  });

  const runAction = (action) => {
    if (action === "filter_attention") onFilterAttention?.();
  };

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
    const headers = ["Company", "Country", "Geography", "Company found", "Landline", "Landline found", "Decision-makers", "Email found", "Mobile found", "Mobile", "Phone lookup result", "LinkedIn found", "Provider", "Provider error", "Status", "Last attempted"];
    const rows = prospects.map((p) => [
      p.company_name, p.country_code || "", p.geography_status || "",
      p.company_found ? "Yes" : "No", p.landline || "", p.landline_found ? "Yes" : "No",
      p.decision_makers_found ? "Yes" : "No", p.work_email_found ? "Yes" : "No",
      p.mobile_found ? "Yes" : "No", p.phone || "",
      (p.field_provenance && p.field_provenance.phone && PHONE_RESULT_LABELS[p.field_provenance.phone.lookup_result]) || "",
      p.linkedin_found ? "Yes" : "No",
      p.provider_used || "", p.provider_error || "", p.enrichment_status || "",
      p.last_attempted_at ? new Date(p.last_attempted_at).toLocaleDateString("en-GB") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "enrichment-batch-summary.csv"; a.click();
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
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export summary
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

      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Enrichment · what next
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-slate-900">{next.title}</p>
            <p className="mt-0.5 text-sm text-slate-500">{next.detail}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {next.href && next.cta && (
              <Link
                to={next.href}
                className="inline-flex h-10 items-center rounded-full bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
              >
                {next.cta}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            )}
            {!next.href && next.cta && next.action && (
              <Button
                onClick={() => runAction(next.action)}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500 h-10 px-4"
              >
                {next.cta}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
            {next.secondary?.href && (
              <Link
                to={next.secondary.href}
                className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {next.secondary.cta}
              </Link>
            )}
            {next.secondary?.action && !next.secondary?.href && (
              <Button
                variant="outline"
                onClick={() => runAction(next.secondary.action)}
                className="rounded-full border-slate-300 h-10 px-4"
              >
                {next.secondary.cta}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}