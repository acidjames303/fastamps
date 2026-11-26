import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  CircleAlert, FileText, Loader2, Mail, Phone, ShieldCheck, Sparkles, Split,
} from "lucide-react";
import SpreadsheetImportPreview from "@/components/campaign-builder/SpreadsheetImportPreview";
import ResearchImportPanel from "@/components/prospecting/ResearchImportPanel";
import ResearchPromptPanel from "@/components/prospecting/ResearchPromptPanel";
import SplitCampaignData from "@/components/campaigns/SplitCampaignData";

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

// One import path: companies first, research documents second, then optional next steps.
// Nothing paid runs without approval; existing accounts are never overwritten.
export default function ImportResearchSection({
  listId,
  prospects = [],
  campaign = null,
  onListCreated,
  onImported,
  onOpenEnrich,
}) {
  const [importedIds, setImportedIds] = useState([]);
  const [showResearch, setShowResearch] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [screenOpen, setScreenOpen] = useState(false);
  const [screening, setScreening] = useState(false);
  const [screenResult, setScreenResult] = useState("");
  const [screenError, setScreenError] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);
  const [callers, setCallers] = useState([]);
  const [resolvedCampaign, setResolvedCampaign] = useState(campaign);

  const imported = prospects.filter((prospect) => importedIds.includes(prospect.id));
  const missingPhone = imported.filter((prospect) => !prospect.mobile && !prospect.direct_dial);
  const missingEmail = imported.filter((prospect) => !prospect.email);
  const numbers = numberCount(imported);
  const hasAccounts = prospects.length > 0;

  useEffect(() => {
    setResolvedCampaign(campaign);
  }, [campaign]);

  // After import, resolve the campaign + active callers so Split data can open here.
  useEffect(() => {
    if (!importedIds.length) return;
    let cancelled = false;
    (async () => {
      try {
        let camp = campaign;
        if (!camp?.id && listId) {
          const list = await base44.entities.ProspectList.get(listId).catch(() => null);
          if (list?.campaign_id) {
            camp = await base44.entities.Campaign.get(list.campaign_id).catch(() => ({
              id: list.campaign_id,
              name: list.name || "Campaign",
            }));
          }
        }
        if (!cancelled && camp?.id) setResolvedCampaign(camp);

        const profiles = await base44.entities.UserProfile.filter({}, "-created_date", 80).catch(() => []);
        if (cancelled) return;
        setCallers(
          (profiles || []).filter((p) =>
            p.status === "active"
            && ["bdm", "internal_bd", "sales_manager", "organisation_admin"].includes(p.app_role),
          ),
        );
      } catch {
        /* non-fatal — Split button stays hidden if we cannot resolve */
      }
    })();
    return () => { cancelled = true; };
  }, [importedIds.length, listId, campaign]);

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

  const canSplit = !!(resolvedCampaign?.id && callers.length);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Import
        </p>
        <h3 className="font-display text-2xl font-semibold text-slate-900">Bring in what you already have</h3>
        <p className="max-w-2xl text-sm text-slate-500">
          Add companies first. Attach research documents when you are ready. Nothing already on this campaign is overwritten.
        </p>
      </div>

      <SpreadsheetImportPreview
        listId={listId}
        existingProspects={prospects}
        onListCreated={onListCreated}
        onImported={onImported}
        onImportedRows={setImportedIds}
      />

      {hasAccounts ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowDocs((open) => !open)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
            aria-expanded={showDocs}
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-100 text-slate-700">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">Attach research documents</span>
              <span className="block text-xs text-slate-500">
                PDF, Word, Markdown or spreadsheet — filed against accounts already in this list
              </span>
            </span>
            <span className="text-xs font-medium text-emerald-700">{showDocs ? "Hide" : "Open"}</span>
          </button>
          {showDocs && (
            <div className="border-t border-slate-100 p-4 sm:p-5">
              <ResearchImportPanel listId={listId} prospects={prospects} onImported={() => onImported?.(listId)} />
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Research documents unlock after the first companies are in the list.
        </p>
      )}

      {importedIds.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              {imported.length} account{imported.length === 1 ? "" : "s"} added — what next?
            </p>
            <p className="mt-0.5 text-xs text-emerald-800">
              Call yourself, or split across the team. Paid enrich steps show an estimate first.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/dialer"
              className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              <Phone className="mr-1.5 h-3.5 w-3.5" /> Start calling
            </Link>
            {canSplit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSplitOpen(true)}
                className="rounded-full border-emerald-400 bg-white text-emerald-900 hover:bg-emerald-50"
              >
                <Split className="mr-1.5 h-3.5 w-3.5" /> Split data
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!missingPhone.length || !onOpenEnrich}
              onClick={() => onOpenEnrich?.(missingPhone.map((prospect) => prospect.id), "phone")}
              className="rounded-full border-slate-300 bg-white"
            >
              <Phone className="mr-1.5 h-3.5 w-3.5" /> Phones ({missingPhone.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!missingEmail.length || !onOpenEnrich}
              onClick={() => onOpenEnrich?.(missingEmail.map((prospect) => prospect.id), "email")}
              className="rounded-full border-slate-300 bg-white"
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" /> Emails ({missingEmail.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMore((open) => !open)}
              className="rounded-full text-emerald-800"
            >
              {showMore ? "Less" : "More"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setImportedIds([])}
              className="rounded-full text-emerald-800"
            >
              Done
            </Button>
          </div>

          {showMore && (
            <div className="flex flex-wrap gap-2 border-t border-emerald-200/70 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResearch((open) => !open)}
                className="rounded-full border-slate-300 bg-white"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {showResearch ? "Hide prompt" : "Prompt research"}
              </Button>
              {!screenOpen ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!numbers.numbers || screening}
                  onClick={() => setScreenOpen(true)}
                  className="rounded-full border-slate-300 bg-white"
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> TPS screen
                </Button>
              ) : (
                <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs text-emerald-900">
                  Approve {numbers.numbers} check{numbers.numbers === 1 ? "" : "s"}?
                  <Button size="sm" onClick={screen} disabled={screening} className="h-7 rounded-full bg-emerald-600 px-3 hover:bg-emerald-500">
                    {screening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve"}
                  </Button>
                  <button type="button" onClick={() => setScreenOpen(false)} className="text-slate-500 hover:text-slate-800">
                    Not now
                  </button>
                </span>
              )}
            </div>
          )}

          {screenResult && <p className="text-xs text-emerald-800">{screenResult}</p>}
          {screenError && (
            <p className="flex items-start gap-1.5 text-xs text-rose-700">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" /> {screenError}
            </p>
          )}

          {showResearch && (
            <ResearchPromptPanel
              listId={listId}
              prospects={imported.length ? imported : prospects}
              onChanged={() => onImported?.(listId)}
            />
          )}
        </div>
      )}

      <SplitCampaignData
        campaign={resolvedCampaign}
        callers={callers}
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        onDone={() => {
          setSplitOpen(false);
          onImported?.(listId);
        }}
      />
    </div>
  );
}
