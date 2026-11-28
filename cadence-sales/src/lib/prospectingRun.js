import { base44 } from "@/api/base44Client";

// One prospecting run: the agent discovers and qualifies accounts, then the
// research instruction is applied to each account it saved. Shared by every
// entry point so a run behaves the same wherever it was started.

const IN_FLIGHT = ["queued", "researching", "discovering", "saving"];
const MAX_STEPS = 60;
const RESEARCH_BATCH = 4;

const PHASE_LABEL = {
  queued: "Starting the agent…",
  researching: "Researching your market…",
  discovering: "Finding matching accounts…",
  saving: "Saving qualified accounts…",
};

export const MIN_ACCOUNTS = 5;
export const MAX_ACCOUNTS = 500;

export async function runProspectingAgent({
  brief = "",
  icp = "",
  count = 25,
  listId,
  instruction = "",
  onPhase,
  onFound,
  onResearch,
  onRunFinished,
}) {
  const useBrief = String(brief || "").trim();
  const useIcp = String(icp || "").trim();
  if (!useBrief && !useIcp) throw new Error("Describe who you want to call first.");

  const target = Math.min(MAX_ACCOUNTS, Math.max(MIN_ACCOUNTS, Math.round(Number(count)) || MIN_ACCOUNTS));
  onPhase?.(PHASE_LABEL.queued);

  const started = await base44.functions.invoke("startProspectingRun", {
    source_type: useBrief ? "brief" : "icp",
    brief: useBrief,
    icp: useIcp,
    max_accounts: target,
    permitted_countries: ["GB"],
    auto_enrich: false,
    prospect_list_id: listId || undefined,
  });
  const data = started.data || started;
  if (data?.error) throw new Error(data.error);

  let current = data.run;
  let guard = 0;
  while (current && IN_FLIGHT.includes(current.status) && guard < MAX_STEPS) {
    onPhase?.(PHASE_LABEL[current.status] || "Working…");
    onFound?.(current.accounts_found || current.prospect_ids?.length || 0);
    const step = await base44.functions.invoke("runProspectingStep", { run_id: current.id });
    const stepData = step.data || step;
    if (stepData?.error) throw new Error(stepData.error);
    current = stepData.run;
    guard += 1;
  }
  if (current?.status === "failed") {
    throw new Error(current.error_summary || "The agent could not finish this run.");
  }

  const found = current?.prospect_ids?.length || 0;
  const ids = current?.prospect_ids || [];
  const targetListId = current?.prospect_list_id;
  const text = String(instruction || "").trim();
  let researched = 0;
  let researchError = "";

  if (text && ids.length && targetListId) {
    try {
      onResearch?.({ done: 0, total: ids.length });
      for (let i = 0; i < ids.length; i += RESEARCH_BATCH) {
        onPhase?.(`Researching accounts — ${Math.min(i + RESEARCH_BATCH, ids.length)} of ${ids.length}…`);
        const res = await base44.functions.invoke("researchAccountsPrompted", {
          prospect_list_id: targetListId,
          prompt: text,
          prospect_ids: ids.slice(i, i + RESEARCH_BATCH),
        });
        const payload = res.data || res;
        if (payload?.error) throw new Error(payload.error);
        researched += payload?.researched || 0;
        onResearch?.({ done: Math.min(i + RESEARCH_BATCH, ids.length), total: ids.length });
      }
    } catch (error) {
      researchError = error?.response?.data?.error || error.message || "Research stopped.";
    }
  }

  await onRunFinished?.(current);
  return { run: current, found, researched, researchError };
}