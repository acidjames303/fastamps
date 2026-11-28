import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, MailPlus, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import OutreachCampaignPicker from "@/components/email/OutreachCampaignPicker";
import OutreachContactsStep from "@/components/email/OutreachContactsStep";
import OutreachGroundedGenerate from "@/components/email/OutreachGroundedGenerate";
import CampaignResearchWorkspace from "@/components/campaigns/research/CampaignResearchWorkspace";

const box = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
const primary =
  "inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-slate-700";
const secondary =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50";

const STEPS = [
  { id: "campaign", label: "1. Campaign" },
  { id: "contacts", label: "2. Contacts" },
  { id: "research", label: "3. Research" },
  { id: "generate", label: "4. Generate" },
  { id: "review", label: "5. Review & drafts" },
];

// One campaign, one contact queue, the campaign's own research reused, then
// evidence-led drafts held for human review. Sending is never enabled here.
export default function OutreachCampaignStudio({
  brand,
  user,
  onDraftsCreated,
  onOpenDrafts,
  initialCampaignId = "",
}) {
  const [stage, setStage] = useState("campaign");
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState(initialCampaignId || "");
  const [contacts, setContacts] = useState({ leads: [], selected: [] });
  const [generated, setGenerated] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("combined");

  const saveMode = async (value) => {
    if (!campaignId) return;
    setMode(value);
    setCampaigns((items) => items.map((item) => (item.id === campaignId ? { ...item, outreach_mode: value } : item)));
    await base44.entities.Campaign.update(campaignId, { outreach_mode: value }).catch(() => {});
  };

  useEffect(() => {
    if (!user?.id) return;
    base44.entities.Campaign
      .list("-created_date", 100)
      .then((items) => {
        const rows = items || [];
        setCampaigns(rows);
        // Deep-link from Prospecting push / enrichment “Open Outreach”.
        if (initialCampaignId && rows.some((row) => row.id === initialCampaignId)) {
          const campaign = rows.find((row) => row.id === initialCampaignId);
          setCampaignId(initialCampaignId);
          setMode(campaign?.outreach_mode || "combined");
          setStage("contacts");
        }
      })
      .catch(() => setCampaigns([]));
  }, [user?.id, initialCampaignId]);

  const handleContactsChange = useCallback((next) => setContacts(next), []);

  const generateDrafts = async (options) => {
    const approved = contacts.leads.filter(
      (lead) => contacts.selected.includes(lead.id) && lead.review_status === "approved"
    );
    if (!approved.length) return setError("Select approved contacts to draft.");
    setWorking(true);
    setError("");
    try {
      let drafted = 0;
      let skipped = 0;
      let flagged = 0;
      const reasons = [];
      for (let offset = 0; offset < approved.length; offset += 10) {
        const response = await base44.functions.invoke("manageOutreachLeads", {
          action: "generate_grounded",
          lead_ids: approved.slice(offset, offset + 10).map((lead) => lead.id),
          brand_key: brand,
          campaign_id: campaignId,
          tone: options.tone,
          intent: options.intent,
          instructions: options.instructions,
          signature_text: options.signature,
          allow_generic_salutation: options.allowGeneric,
        });
        const data = response.data || response;
        if (!data.ok) throw new Error(data.error || "Draft generation failed.");
        drafted += data.drafted || 0;
        skipped += data.skipped || 0;
        flagged += data.flagged || 0;
        reasons.push(...(data.errors || []));
      }
      setGenerated({ drafted, skipped, flagged, reasons: reasons.slice(0, 5) });
      setStage("review");
      await onDraftsCreated?.();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Draft generation failed.");
    } finally {
      setWorking(false);
    }
  };

  const changeCampaign = (id) => {
    const campaign = campaigns.find((item) => item.id === id);
    setCampaignId(id);
    setMode(campaign?.outreach_mode || "combined");
    setContacts({ leads: [], selected: [] });
    setGenerated(null);
    setError("");
    setStage(id ? "contacts" : "campaign");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Campaign outreach studio</h2>
          <p className="text-sm text-slate-500 mt-1">
            Contacts, research, then evidence-led drafts — all inside one campaign. Human review required; sending stays
            disabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              aria-current={stage === step.id ? "step" : undefined}
              disabled={working || (!campaignId && index > 0)}
              onClick={() => setStage(step.id)}
              className={stage === step.id ? primary : secondary}
            >
              {step.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {stage === "campaign" && (
        <section className={`${box} space-y-4 max-w-xl`}>
          <OutreachCampaignPicker campaigns={campaigns} value={campaignId} onChange={changeCampaign} />

          {!!campaignId && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">How this campaign works</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "email_first", label: "Email first" },
                  { id: "calling_first", label: "Calling first" },
                  { id: "combined", label: "Combined" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={mode === option.id}
                    onClick={() => saveMode(option.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      mode === option.id
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {mode === "email_first"
                  ? "Contacts are drafted for email first; calling stays available from the same research."
                  : mode === "calling_first"
                    ? "Contacts are worked by phone first; drafts default to follow-up wording."
                    : "Contacts can be called or emailed — the same research grounds both."}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Contacts stay inside the campaign you choose. Research runs once per campaign and is reused on calls, lead
            sheets and every draft.
          </div>
          <button type="button" className={primary} disabled={!campaignId} onClick={() => setStage("contacts")}>
            Continue to contacts <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      )}

      {stage === "contacts" && campaignId && (
        <OutreachContactsStep brand={brand} campaignId={campaignId} onChange={handleContactsChange} />
      )}

      {stage === "research" && campaignId && <CampaignResearchWorkspace campaignId={campaignId} />}

      {stage === "generate" && campaignId && (
        <section className={`${box} max-w-2xl`}>
          <OutreachGroundedGenerate
            approvedCount={contacts.leads.filter((lead) => lead.review_status === "approved").length}
            selectedCount={contacts.selected.length}
            busy={working}
            defaultIntent={mode === "calling_first" ? "follow_up" : "first_touch"}
            onGenerate={generateDrafts}
          />
        </section>
      )}

      {stage === "review" && campaignId && (
        <section className={`${box} space-y-3 max-w-2xl`}>
          <h3 className="font-semibold">5. Review and drafts</h3>
          {generated ? (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <strong>{generated.drafted}</strong> draft{generated.drafted === 1 ? "" : "s"} created with cited research;{" "}
                {generated.skipped} skipped as duplicates or suppressed; {generated.flagged} held for a human check.
              </p>
              {!!generated.reasons?.length && (
                <ul className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900 space-y-1">
                  {generated.reasons.map((row, index) => (
                    <li key={index}>
                      {row.email}: {row.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No drafts generated in this session yet. Approved contacts are drafted in step 4.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={() => onOpenDrafts?.()}>
              <MailPlus className="w-4 h-4" /> Open my drafts
            </button>
            <button type="button" className={secondary} onClick={() => setStage("generate")}>
              Generate more
            </button>
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-none" />
            Every draft stays held until a person approves its exact wording. Sending is not enabled.
          </p>
        </section>
      )}
    </div>
  );
}