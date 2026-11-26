import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CircleAlert, Loader2, Mail, Phone, ShieldCheck, Sparkles } from "lucide-react";
import SpreadsheetImportPreview from "@/components/campaign-builder/SpreadsheetImportPreview";
import ResearchImportPanel from "@/components/prospecting/ResearchImportPanel";
import ResearchPromptPanel from "@/components/prospecting/ResearchPromptPanel";

const numberCount = (prospects) => {
  let accounts = 0;
  let numbers = 0;
  prospects.forEach((prospect) => {
    const own = [prospect.mobile, prospect.direct_dial, prospect.company_phone, prospect.phone, prospect.landline].filter(Boolean);
    const fromContacts = (prospect.contacts || []).flatMap((contact) => [contact.mobile, contact.direct_dial, contact.phone].filter(Boolean));
    const all = new Set([...own, ...fromContacts]);
    if (all.size) accounts += 1;
    numbers += all.size;
  });
  return { accounts, numbers };
};

// The import door for both a brand-new campaign and one already running.
// Nothing paid happens without an explicit approval, and every follow-up reuses
// the enrichment, research and screening flows the rest of Cadence already has.
export default function ImportResearchSection({
  listId,
  prospects = [],
  onListCreated,
  onImported,
  onOpenEnrich,
}) {
  const [importedIds, setImportedIds] = useState([]);
  const [showResearch, setShowResearch] = useState(false);
  const [screenOpen, setScreenOpen] = useState(false);
  const [screening, setScreening] = useState(false);
  const [screenResult, setScreenResult] = useState("");
  const [screenError, setScreenError] = useState("");

  const imported = prospects.filter((prospect) => importedIds.includes(prospect.id));
  const missingPhone = imported.filter((prospect) => !prospect.mobile && !prospect.direct_dial);
  const missingEmail = imported.filter((prospect) => !prospect.email);
  const numbers = numberCount(imported);

  const screen = async () => {
    if (!listId || !importedIds.length || screening) return;
    setScreening(true);
    setScreenError("");
    setScreenResult("");
    try {
      const response = await base44.functions.invoke("screenProspectsTps", {
        list_id: listId,
        prospect_ids: importedIds,
      });
      const data = response.data || response;
      if (data?.error) throw new Error(data.error);
      setScreenResult(
        `${data.checked || 0} number${data.checked === 1 ? "" : "s"} checked — ${data.safe || 0} safe, ${data.listed || 0} on a register, ${data.unavailable || 0} unavailable.`,
      );
      setScreenOpen(false);
      await onImported?.(listId);
    } catch (error) {
      setScreenError(error?.response?.data?.error || error.message || "Screening could not run.");
    } finally {
      setScreening(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Campaigns · Find prospects
        </p>
        <h3 className="font-display text-2xl font-semibold text-slate-900">Import existing research</h3>
        <p className="max-w-2xl text-sm text-slate-500">
          Start with a company list — every Excel worksheet is merged. Research packs attach after the accounts
          are in. Nothing already on this campaign is overwritten.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <SpreadsheetImportPreview
          listId={listId}
          existingProspects={prospects}
          onListCreated={onListCreated}
          onImported={onImported}
          onImportedRows={setImportedIds}
        />

        {prospects.length ? (
          <ResearchImportPanel listId={listId} prospects={prospects} onImported={() => onImported?.(listId)} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-emerald-50/40 p-5">
            <p className="text-sm font-semibold text-slate-900">Research pack next</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Add companies on the left first. Then drop PDF, Word, Markdown or text research here — each pack
              stays filed against the accounts already in this list.
            </p>
          </div>
        )}
      </div>

      {importedIds.length > 0 && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              {imported.length} imported account{imported.length === 1 ? "" : "s"} ready — what next?
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              Import only is fine. Anything paid shows an estimate and waits for your approval before it runs.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">Import only</p>
              <p className="mt-1 text-xs text-slate-500">Keep the accounts as they are and call them from the list.</p>
              <Button
                variant="ghost"
                onClick={() => setImportedIds([])}
                className="mt-2 rounded-full text-emerald-800 hover:bg-emerald-50"
              >
                Done, keep as imported
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Phone className="h-3.5 w-3.5 text-emerald-600" /> Find missing phones
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {missingPhone.length} account{missingPhone.length === 1 ? "" : "s"} without a mobile or direct dial.
                Lusha and your other connected providers are only called after you approve the estimate.
              </p>
              <Button
                variant="outline"
                disabled={!missingPhone.length || !onOpenEnrich}
                onClick={() => onOpenEnrich?.(missingPhone.map((prospect) => prospect.id), "phone")}
                className="mt-2 rounded-full border-slate-300"
              >
                Review the estimate
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Mail className="h-3.5 w-3.5 text-emerald-600" /> Enrich emails
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {missingEmail.length} account{missingEmail.length === 1 ? "" : "s"} without a work email. Known company
                formats are tried first at no cost.
              </p>
              <Button
                variant="outline"
                disabled={!missingEmail.length || !onOpenEnrich}
                onClick={() => onOpenEnrich?.(missingEmail.map((prospect) => prospect.id), "email")}
                className="mt-2 rounded-full border-slate-300"
              >
                Review the estimate
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Research these accounts
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Fill the gaps with public research. One Smart Action per account, with the source link kept beside each
                finding.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowResearch((current) => !current)}
                className="mt-2 rounded-full border-slate-300"
              >
                {showResearch ? "Hide research" : "Write the instruction"}
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:col-span-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Screen for TPS / CTPS
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {numbers.numbers
                  ? `${numbers.numbers} number${numbers.numbers === 1 ? "" : "s"} across ${numbers.accounts} account${numbers.accounts === 1 ? "" : "s"} will be checked with 121 Prodata. Billing is per number on your Prodata account.`
                  : "No numbers on these accounts yet — screen after enriching."}
              </p>
              {!screenOpen ? (
                <Button
                  variant="outline"
                  disabled={!numbers.numbers || screening}
                  onClick={() => setScreenOpen(true)}
                  className="mt-2 rounded-full border-slate-300"
                >
                  {screening ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Review and approve
                </Button>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-2.5">
                  <p className="min-w-0 flex-1 text-xs text-emerald-900">
                    Approve {numbers.numbers} paid screening check{numbers.numbers === 1 ? "" : "s"}?
                  </p>
                  <Button onClick={screen} disabled={screening} className="rounded-full bg-emerald-600 hover:bg-emerald-500">
                    {screening ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Approve
                  </Button>
                  <Button variant="ghost" onClick={() => setScreenOpen(false)} disabled={screening} className="rounded-full">
                    Not now
                  </Button>
                </div>
              )}
              {screenResult && <p className="mt-2 text-xs text-emerald-800">{screenResult}</p>}
              {screenError && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" /> {screenError}
                </p>
              )}
            </div>
          </div>

          {showResearch && (
            <ResearchPromptPanel
              listId={listId}
              prospects={imported.length ? imported : prospects}
              onChanged={() => onImported?.(listId)}
            />
          )}
        </div>
      )}
    </div>
  );
}