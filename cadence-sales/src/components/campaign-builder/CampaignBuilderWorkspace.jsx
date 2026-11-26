import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, CircleAlert, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import GetStartedCards from "@/components/campaign-builder/GetStartedCards";
import GuidedBuilder from "@/components/campaign-builder/GuidedBuilder";
import WritePanel from "@/components/campaign-builder/WritePanel";
import BuilderReview from "@/components/campaign-builder/BuilderReview";
import ImportResearchSection from "@/components/campaign-builder/ImportResearchSection";
import {
  BUILT_IN_TEMPLATES,
  clearDraft,
  composeFromAnswers,
  draftFromTemplate,
  emptyDraft,
  loadDraft,
  saveDraft,
} from "@/lib/campaignBuilder";
import { MAX_ACCOUNTS, MIN_ACCOUNTS, runProspectingAgent } from "@/lib/prospectingRun";

// The Get Started workspace: four ways to build a campaign, one draft shared
// between them, and a single review before anything runs.
export default function CampaignBuilderWorkspace({
  listId,
  prospects = [],
  campaign = null,
  onListCreated,
  onImported,
  onRunFinished,
  onOpenEnrich,
  onBriefSaved,
}) {
  const { user } = useAuth();
  const scope = listId || "new";
  const [draft, setDraft] = useState(() => loadDraft(scope) || emptyDraft());
  const [method, setMethod] = useState(() => {
    if (new URLSearchParams(window.location.search).get("import") === "1") return "import";
    return loadDraft(scope)?.method || "";
  });
  const [templates, setTemplates] = useState([]);
  const [count, setCount] = useState(25);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [found, setFound] = useState(0);
  const [researchProgress, setResearchProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingBrief, setSavingBrief] = useState(false);

  useEffect(() => {
    base44.entities.CampaignTemplate.list("-created_date", 50).then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    setDraft(loadDraft(scope) || emptyDraft());
    setSaved(null);
    setError("");
    setMessage("");
  }, [scope]);

  useEffect(() => {
    saveDraft(scope, { ...draft, method });
  }, [draft, method, scope]);

  const templateChoices = useMemo(
    () => [
      ...BUILT_IN_TEMPLATES.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        answers: template.answers,
      })),
      ...templates.map((template) => ({ ...template, id: template.id })),
    ],
    [templates],
  );

  const loadTemplate = (id) => {
    const template = templateChoices.find((item) => item.id === id);
    if (!template) return;
    setDraft(draftFromTemplate(template));
    setMethod("review");
    setMessage(`Loaded “${template.name}”.`);
    if (!String(id).startsWith("builtin-")) {
      base44.entities.CampaignTemplate.update(id, {
        use_count: (template.use_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      }).catch(() => {});
    }
  };

  const saveTemplate = async (name) => {
    if (!name || !user?.organisation_id) return;
    setSavingTemplate(true);
    setError("");
    try {
      const created = await base44.entities.CampaignTemplate.create({
        organisation_id: user.organisation_id,
        name,
        description: String(draft.brief || "").split("\n")[0].slice(0, 140),
        method: method === "dictate" ? "dictated" : method === "write" ? "written" : "guided",
        answers: draft.answers,
        brief: draft.brief,
        icp: draft.icp,
        research_instruction: draft.instruction,
        enrichment_fields: draft.answers?.enrichment || [],
        provider_order: draft.answers?.provider_order || [],
        created_by_user_id: user.id,
      });
      setTemplates((current) => [created, ...current]);
      setDraft((current) => ({ ...current, template_id: created.id, template_name: created.name }));
      setMessage(`Saved “${name}” as a template.`);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not save that template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const finishGuided = () => {
    const composed = composeFromAnswers(draft.answers);
    setDraft({
      ...draft,
      brief: composed.brief,
      icp: composed.icp,
      instruction: composed.instruction,
    });
    setMethod("review");
  };

  const run = async () => {
    if (running) return;
    if (!draft.brief.trim() && !draft.icp.trim()) {
      setError("Add a brief or an ideal customer profile before finding accounts.");
      return;
    }
    setRunning(true);
    setError("");
    setMessage("");
    setSaved(null);
    setFound(0);
    setResearchProgress({ done: 0, total: 0 });
    try {
      const result = await runProspectingAgent({
        brief: draft.brief,
        icp: draft.icp,
        count,
        listId,
        instruction: draft.instruction,
        onPhase: setPhase,
        onFound: setFound,
        onResearch: setResearchProgress,
        onRunFinished,
      });
      setSaved({ found: result.found, researched: result.researched });
      if (result.researchError) {
        setError(`${result.found} account${result.found === 1 ? "" : "s"} saved, but research stopped: ${result.researchError}`);
      }
      // The run is done: hand the page back so the accounts below take over.
      setMethod("");
      clearDraft(scope);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "The agent could not finish this run.");
    } finally {
      setRunning(false);
      setPhase("");
    }
  };

  const saveToCampaign = async () => {
    if (!campaign?.id) return;
    setSavingBrief(true);
    setError("");
    setMessage("");
    try {
      const answers = draft.answers || {};
      await base44.entities.Campaign.update(campaign.id, {
        offer: answers.offer || campaign.offer || "",
        objective: answers.objective || campaign.objective || "",
        icp: draft.icp || "",
        target_profile: draft.icp || "",
        target_industries: answers.industries || [],
        target_company_sizes: answers.sizes || [],
        target_locations: answers.geography || [],
        ...(answers.roles?.length ? { target_roles: answers.roles } : {}),
      });
      if (listId) {
        await base44.entities.ProspectList.update(listId, {
          brief: draft.brief,
          icp: draft.icp,
          ...(answers.roles?.length ? { target_titles: answers.roles } : {}),
        });
      }
      setMessage("Brief, profile and target roles saved to the campaign.");
      await onBriefSaved?.();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not save the brief to the campaign.");
    } finally {
      setSavingBrief(false);
    }
  };

  const backToStart = () => setMethod("");

  return (
    <div className="space-y-4">
      {method === "import" ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={backToStart}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> All the ways in
          </button>
          <ImportResearchSection
            listId={listId}
            prospects={prospects}
            onListCreated={onListCreated}
            onImported={onImported}
            onOpenEnrich={onOpenEnrich}
          />
        </div>
      ) : (
        <>
          {method ? (
            <button
              type="button"
              onClick={backToStart}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" /> All the ways in
              {(draft.brief || draft.icp) && <span className="text-slate-400">· your draft is kept</span>}
            </button>
          ) : (
            <GetStartedCards onSelect={setMethod} activeMethod={method} />
          )}

          {method === "guided" && (
            <GuidedBuilder
              answers={draft.answers}
              setAnswers={(answers) => setDraft({ ...draft, answers })}
              onFinish={finishGuided}
              onSwitchToWrite={() => setMethod("write")}
            />
          )}

          {(method === "write" || method === "dictate") && (
            <>
              <WritePanel draft={draft} onChange={setDraft} dictateFirst={method === "dictate"} />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setMethod("guided")} className="rounded-full text-slate-500">
                  Use the guided builder instead
                </Button>
                <Button onClick={() => setMethod("review")} className="rounded-full bg-slate-900 hover:bg-slate-800">
                  Continue to review
                </Button>
              </div>
            </>
          )}

          {method === "review" && (
            <BuilderReview
              draft={draft}
              onChange={setDraft}
              templates={templateChoices}
              onLoadTemplate={loadTemplate}
              onSaveTemplate={saveTemplate}
              savingTemplate={savingTemplate}
            >
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs text-slate-500">
                    Accounts to find
                    <input
                      type="number"
                      min={MIN_ACCOUNTS}
                      max={MAX_ACCOUNTS}
                      step={5}
                      value={count}
                      onChange={(event) => setCount(Number(event.target.value))}
                      disabled={running}
                      className="mt-1 block w-28 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    />
                  </label>
                  <Button
                    onClick={run}
                    disabled={running || (!draft.brief.trim() && !draft.icp.trim())}
                    className="rounded-full bg-emerald-600 hover:bg-emerald-500"
                  >
                    {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                    {running ? "Working…" : "Find accounts"}
                  </Button>
                  {campaign?.id && (
                    <Button
                      variant="outline"
                      onClick={saveToCampaign}
                      disabled={savingBrief}
                      className="rounded-full border-slate-300"
                    >
                      {savingBrief ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                      Save to campaign
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setMethod("guided")} className="rounded-full text-slate-500">
                    Back to the questions
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400">
                  {MIN_ACCOUNTS}–{MAX_ACCOUNTS} accounts. Cadence qualifies each one against this brief and keeps the
                  ones that fit.
                  {draft.instruction.trim() ? " The research instruction runs on each account it saves." : " No research instruction, so accounts are found without research."}
                </p>

                {running && phase && (
                  <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" /> {phase}
                    {found > 0 && <span className="text-slate-400">· {found} found so far</span>}
                    {researchProgress.total > 0 && (
                      <span className="text-slate-400">· {researchProgress.done} researched</span>
                    )}
                  </p>
                )}
              </div>
            </BuilderReview>
          )}
        </>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}
      {saved && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            {saved.found
              ? `${saved.found} account${saved.found === 1 ? "" : "s"} saved${saved.researched ? ` and ${saved.researched} researched` : ""}. Enrich them next.`
              : "The agent finished but nothing fitted this brief. Try naming the market, size or buying signals."}
          </span>
        </div>
      )}
    </div>
  );
}