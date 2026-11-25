import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ChevronDown, Wand2, Trash2, ArrowRight, Pencil, Check, Save, Plus, Search } from "lucide-react";
import BriefInput from "@/components/prospecting/BriefInput";
import CompanyInput from "@/components/prospecting/CompanyInput";
import ProspectTable from "@/components/prospecting/ProspectTable";
import GeographySelector from "@/components/prospecting/GeographySelector";
import EnrichmentBatchSummary from "@/components/prospecting/EnrichmentBatchSummary";
import SelectiveEnrichDialog from "@/components/prospecting/SelectiveEnrichDialog";
import ProspectStart from "@/components/prospecting/ProspectStart";
import ProspectResearchWorkspace from "@/components/prospecting/ProspectResearchWorkspace";
import EnrichmentSessionBanner from "@/components/prospecting/EnrichmentSessionBanner";
import ProspectFilters, { matchesFilter } from "@/components/prospecting/ProspectFilters";
import { useAuth } from "@/lib/AuthContext";
import { pushProspectsToTargetList } from "@/lib/prospectPush";
import PushProgress from "@/components/PushProgress";
import CampaignExportButton from '@/components/campaigns/CampaignExportButton';
import CampaignBriefEditor from '@/components/campaigns/CampaignBriefEditor';
import DataReadinessPanel from '@/components/campaigns/DataReadinessPanel';
import ReviewQueuePanel from '@/components/campaigns/ReviewQueuePanel';
import { setActiveCampaign, getActiveCampaign } from "@/lib/campaignContext";

// Simple prospecting flow: paste a brief → extract ICP → add companies → enrich
// data → review results. Uses ProspectList + Prospect entities.
const TARGET_ROLE_PATTERNS = [
  "Managing Director", "Operations Director", "Operations Manager", "Engineering Director", "Engineering Manager",
  "Production Director", "Production Manager", "Technical Director", "Technical Manager", "Site Manager", "Factory Manager",
  "Facilities Manager", "Utilities Manager", "Sustainability Lead", "Environmental Lead", "Hygiene Manager", "CIP Manager",
  "Head Brewer", "Winemaker", "Production Lead", "Commercial Director", "Procurement Director", "Head of Procurement",
  "Buyer", "Quantity Surveyor", "Development Director",
];

function extractTargetMetadata(briefText, icpText) {
  const source = `${briefText || ""}\n${icpText || ""}`.toLowerCase();
  const target_titles = TARGET_ROLE_PATTERNS.filter((role) => source.includes(role.toLowerCase()));
  const pairedRoles = [
    ["operations director or manager", ["Operations Director", "Operations Manager"]],
    ["engineering director or manager", ["Engineering Director", "Engineering Manager"]],
    ["production director or manager", ["Production Director", "Production Manager"]],
    ["technical director or manager", ["Technical Director", "Technical Manager"]],
    ["site or factory manager", ["Site Manager", "Factory Manager"]],
    ["facilities or utilities manager", ["Facilities Manager", "Utilities Manager"]],
    ["sustainability or environmental lead", ["Sustainability Lead", "Environmental Lead"]],
    ["hygiene or cip manager", ["Hygiene Manager", "CIP Manager"]],
    ["head brewer, winemaker or production lead", ["Head Brewer", "Winemaker", "Production Lead"]],
  ];
  pairedRoles.forEach(([phrase, roles]) => {
    if (source.includes(phrase)) roles.forEach((role) => { if (!target_titles.includes(role)) target_titles.push(role); });
  });
  const departmentNames = ["Operations", "Engineering", "Production", "Technical", "Facilities", "Utilities", "Sustainability", "Environmental", "Hygiene", "CIP", "Commercial", "Procurement"];
  const target_departments = departmentNames.filter((name) => source.includes(name.toLowerCase()));
  const preferred_seniority = ["Director", "Head", "Manager", "Lead"].filter((name) => source.includes(name.toLowerCase()));
  return { target_titles, target_departments, preferred_seniority };
}

export default function Prospecting({ embedded = false }) {
  const { user } = useAuth();
  const [lists, setLists] = useState([]);
  const [listId, setListId] = useState("");
  const [brief, setBrief] = useState("");
  const [icp, setIcp] = useState("");
  const [companies, setCompanies] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [targetLists, setTargetLists] = useState([]);
  const [pushListId, setPushListId] = useState("");
  const [creatingTargetBusy, setCreatingTargetBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [pushing, setPushing] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [permittedCountries, setPermittedCountries] = useState(["GB"]);
  const [batchSummary, setBatchSummary] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverErr, setDiscoverErr] = useState("");
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [enrichmentSession, setEnrichmentSession] = useState(null);
  const [showSelectiveEnrich, setShowSelectiveEnrich] = useState(false);
  const [enrichIntent, setEnrichIntent] = useState("general");
  const [researchByProspect, setResearchByProspect] = useState({});
  const [providerOrder, setProviderOrder] = useState(["apollo", "lusha", "fullenrich"]);
  const [connectedProviders, setConnectedProviders] = useState({});
  const [pollTimer, setPollTimer] = useState(null);
  const [prospectFilter, setProspectFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pushProgress, setPushProgress] = useState(null);

  const location = useLocation();
  const campaignContext = lists.find(l=>l.id===listId)?.campaign_id || '';
  const LAST_LIST_KEY = `cadence_prospecting_last_list_${user.id}`;
  useEffect(()=>{const params=new URLSearchParams(location.search);const campaignId=params.get('campaign');if(campaignId)openListSelection(`campaign:${campaignId}`);},[location.search]);

  useEffect(() => {
    base44.entities.ProspectList.list("-created_date", 100).then(setLists).catch(() => {});
    base44.entities.Campaign.list("-created_date", 100).then(setTargetLists).catch(() => {});
    // Check for an active enrichment session to resume.
    base44.entities.EnrichmentSession.filter({ status: "processing" }, "-created_date", 1)
      .then((sessions) => { if (sessions[0]) setEnrichmentSession(sessions[0]); })
      .catch(() => {});
    // Load provider order and connection status.
    base44.functions.invoke("getOrgConnectionStatus", {})
      .then((res) => {
        const d = res.data || res;
        if (d.provider_order) setProviderOrder(d.provider_order);
        if (d.connected) setConnectedProviders(d.connected);
      })
      .catch(() => {});
    // Restore the last-selected list so work survives navigation/refresh.
    // Fall back to sticky campaign context when no list was remembered.
    const params = new URLSearchParams(window.location.search);
    if (params.get("campaign")) return;
    const lastListId = localStorage.getItem(LAST_LIST_KEY);
    if (lastListId) {
      pickList(lastListId);
      return;
    }
    const sticky = getActiveCampaign();
    if (sticky?.id) openListSelection(`campaign:${sticky.id}`);
  }, []);

  // Poll an active enrichment session until it completes.
  useEffect(() => {
    if (!enrichmentSession || !["processing"].includes(enrichmentSession.status)) return;
    const poll = async () => {
      try {
        const res = await base44.functions.invoke("pollEnrichmentJob", { session_id: enrichmentSession.id });
        const data = res.data || res;
        if (data.error) return;
        setEnrichmentSession(data);
        // Reload prospects to show updated enrichment results.
        if (listId) await loadProspects(listId);
      } catch {}
    };
    const timer = setTimeout(poll, 3000);
    setPollTimer(timer);
    return () => clearTimeout(timer);
  }, [enrichmentSession, listId]);

  // Persist draft brief/companies to localStorage so work survives refresh
  // when no list is open yet.
  const DRAFT_KEY = "cadence_prospecting_draft";

  useEffect(() => {
    if (listId) return; // only persist drafts when no list is selected
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.brief) setBrief(parsed.brief);
        if (parsed.icp) setIcp(parsed.icp);
        if (parsed.companies) setCompanies(parsed.companies);
      } catch {}
    }
  }, [listId]);

  useEffect(() => {
    if (listId) return;
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ brief, icp, companies }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [listId, brief, icp, companies]);

  // Clear the draft once a list is created (work is now in the database)
  useEffect(() => {
    if (listId) localStorage.removeItem(DRAFT_KEY);
  }, [listId]);

  // Saved campaign details use explicit, independent saves. Opening or switching a list never writes empty draft state.

  const loadProspects = async (id) => {
    if (!id) { setProspects([]); return; }
    setLoading(true);
    try {
      const p = await base44.entities.Prospect.filter({ list_id: id }, "-created_date", 500);
      setProspects(p);
      setLists((items) => items.map((l) => l.id === id ? { ...l, company_count: p.length } : l));
      // Keep the persisted count aligned with the actual list records. This does not alter prospect data.
      // Viewing a list is read-only; readiness and export totals come from its records.
    } catch { setProspects([]); }
    finally { setLoading(false); }
  };

  // Refresh the research shown against rows (used after importing a document).
  const reloadResearch = async () => {
    if (!listId) return;
    const records = await base44.entities.AccountResearch
      .filter({ prospect_list_id: listId }, "-researched_at", 200)
      .catch(() => []);
    setResearchByProspect(Object.fromEntries([...records].reverse().map((r) => [r.prospect_id, r])));
  };

  const openListSelection = async (value) => {
    if (!value?.startsWith("campaign:")) return pickList(value);
    const campaignId = value.slice("campaign:".length);
    setLoading(true); setErr(""); setMsg("");
    try {
      const campaign = targetLists.find((item) => item.id === campaignId)
        || await base44.entities.Campaign.get(campaignId);
      let linked = lists.find((item) => item.campaign_id === campaignId);
      if (!linked) {
        const existing = await base44.entities.ProspectList.filter({ campaign_id: campaignId }, "-created_date", 1);
        linked = existing[0];
      }
      if (!linked) {
        const campaignBrief = [
          campaign.objective && `Objective\n${campaign.objective}`,
          campaign.offer && `Offer\n${campaign.offer}`,
          campaign.target_profile && `Target profile\n${campaign.target_profile}`,
          campaign.industry_focus && `Industry focus\n${campaign.industry_focus}`,
          campaign.internal_notes && `Campaign notes\n${campaign.internal_notes}`,
        ].filter(Boolean).join("\n\n") || campaign.name;
        const campaignIcp = campaign.icp || campaign.target_profile || "";
        const targetMetadata = extractTargetMetadata(campaignBrief, campaignIcp);
        const campaignRoles = Array.isArray(campaign.target_roles) ? campaign.target_roles.filter(Boolean) : [];
        const targetTitles = [...new Set([...campaignRoles, ...targetMetadata.target_titles])];
        const countries = (campaign.permitted_countries || []).map((country) =>
          String(country).toLowerCase() === "united kingdom" ? "GB" : String(country).toUpperCase()
        ).filter((country) => country.length === 2);
        linked = await base44.entities.ProspectList.create({
          name: campaign.name,
          campaign_id: campaign.id,
          brief: campaignBrief,
          icp: campaignIcp,
          target_titles: targetTitles,
          target_departments: targetMetadata.target_departments,
          preferred_seniority: targetMetadata.preferred_seniority,
          permitted_countries: countries.length ? countries : ["GB"],
          status: "draft",
          company_count: 0,
          organisation_id: user.organisation_id,
          owner_user_id: user.id,
        });
      }
      setLists((items) => items.some((item) => item.id === linked.id) ? items : [linked, ...items]);
      setActiveCampaign(campaign);
      await pickList(linked.id);
      setMsg(`Campaign “${campaign.name}” is ready for prospecting. Its brief, ICP and target roles are linked to this workspace.`);
    } catch (e) {
      setErr(e.message || "Could not open this campaign in Prospecting.");
    } finally { setLoading(false); }
  };

  const pickList = async (id) => {
    setListId('');
    setSelected([]);
    setProspectFilter("all");
    setSearchQuery("");
    setProspects([]);
    setCompanies([]);
    setBrief("");
    setIcp("");
    setMsg("");
    setErr("");
    setEditingName(false);
    if (!id) { localStorage.removeItem(LAST_LIST_KEY); setProspects([]); return; }
    localStorage.setItem(LAST_LIST_KEY, id);
    const l = await base44.entities.ProspectList.get(id).catch(() => null);
    if (!l) { localStorage.removeItem(LAST_LIST_KEY); setProspects([]); return; }
    setLists(items=>items.some(item=>item.id===l.id)?items.map(item=>item.id===l.id?l:item):[l,...items]);
    setListId(l.id);
    setBrief(l?.brief || "");
    setIcp(l?.icp || "");
    setNameDraft(l?.name || "");
    setPermittedCountries(l?.permitted_countries || ["GB"]);
    if (l.campaign_id) {
      const linkedCampaign = targetLists.find((item) => item.id === l.campaign_id);
      setActiveCampaign(linkedCampaign || { id: l.campaign_id, name: l.name || "Campaign" });
    } else if (l.id) {
      // Prospect lists without a campaign_id still count as working context.
      setActiveCampaign({ id: l.id, name: l.name || "Prospect list" });
    }
    await loadProspects(id);
  };

  // A spreadsheet import can create its own list — adopt it straight away.
  const handleListCreated = async (id) => {
    const created = await base44.entities.ProspectList.get(id).catch(() => null);
    if (created) setLists((items) => [created, ...items.filter((l) => l.id !== id)]);
    await pickList(id);
  };

  // Hand imported accounts to the existing provider enrichment dialog.
  // `intent` lets a phone-specific action preselect mobile + providers + standard.
  const openProviderEnrich = (ids, intent = "general") => {
    setSelected(ids);
    setEnrichIntent(intent);
    setShowSelectiveEnrich(true);
  };

  // The prompting agent saves accounts straight into a list — open it.
  const handleRunFinished = async (run) => {
    const id = run?.prospect_list_id;
    if (!id) return;
    const created = await base44.entities.ProspectList.get(id).catch(() => null);
    if (created) setLists((items) => [created, ...items.filter((l) => l.id !== id)]);
    await pickList(id);
    const found = run?.prospect_ids?.length || 0;
    if (found) setMsg(`The agent saved ${found} account${found === 1 ? "" : "s"} — research or enrich them below.`);
  };

  const startRename = () => {
    const current = lists.find((l) => l.id === listId);
    setNameDraft(current?.name || "");
    setEditingName(true);
  };

  const saveName = async () => {
    if (!listId) return;
    setSavingName(true); setErr("");
    try {
      const trimmed = nameDraft.trim();
      await base44.entities.ProspectList.update(listId, { name: trimmed });
      setLists(lists.map((l) => (l.id === listId ? { ...l, name: trimmed } : l)));
      setEditingName(false);
      setMsg(trimmed ? "List renamed." : "List name cleared — showing as Untitled.");
    } catch (e) { setErr(e.message || "Could not rename list."); }
    finally { setSavingName(false); }
  };

  const saveListDetails = async () => {
    if (!listId) return;
    setSavingDetails(true); setErr(""); setMsg("");
    try {
      const detected = extractTargetMetadata(brief, icp);
      const existing = lists.find(l=>l.id===listId);
      const targetMetadata = {...detected,target_titles:[...new Set([...(existing?.target_titles || []),...detected.target_titles])]};
      await base44.entities.ProspectList.update(listId, { brief, icp, permitted_countries: permittedCountries, ...targetMetadata });
      setLists((items) => items.map((l) => l.id === listId ? { ...l, brief: brief.trim(), icp: icp.trim(), permitted_countries: permittedCountries, ...targetMetadata } : l));
      setMsg("Brief, ICP and geography saved.");
    } catch (e) { setErr(e.message || "Could not save the brief and ICP."); }
    finally { setSavingDetails(false); }
  };



  const startList = async () => {
    if (!brief.trim()) return;
    setStarting(true); setErr("");
    try {
      const targetMetadata = extractTargetMetadata(brief, icp);
      const l = await base44.entities.ProspectList.create({
        brief: brief.trim(),
        name: brief.trim().slice(0, 60),
        icp: icp || "",
        status: "draft",
        company_count: companies.length,
        permitted_countries: permittedCountries,
        ...targetMetadata,
        organisation_id: user.organisation_id,
        owner_user_id: user.id,
      });
      if (companies.length) {
        await base44.entities.Prospect.bulkCreate(
          companies.map((c) => ({
            list_id: l.id,
            company_name: c.name,
            domain: c.domain || "",
            website: c.website || "",
            industry: c.industry || "",
            employee_range: c.employee_range || "",
            location: c.location || "",
            enrichment_status: "pending",
            fit_score: 0,
            pushed: false,
            organisation_id: user.organisation_id,
          }))
        );
      }
      setCompanies([]);
      setLists([l, ...lists]);
      await pickList(l.id);
    } catch (e) { setErr(e.message || "Could not create list."); }
    finally { setStarting(false); }
  };

  const discoverCompanies = async () => {
    if (!brief.trim() && !icp.trim()) return;
    setDiscovering(true); setDiscoverErr("");
    try {
      const countries = (permittedCountries && permittedCountries.length)
        ? permittedCountries.join(", ")
        : "United Kingdom";
      const response = await base44.functions.invoke("runSmartAction", {
        action_type: "company_discovery",
        prompt: `You are a B2B prospecting researcher. Given this campaign brief / ideal customer profile, find up to 10 REAL companies that fit it.

Campaign brief:
${brief || "(not provided)"}

Ideal customer profile:
${icp || "(not provided yet — infer from the brief)"}

Geographic scope: ${countries}

Return JSON: an array "companies" of objects {name, domain, website, industry, employee_range, location, why_fits, source_url}.
Only include REAL companies you can verify exist (use Google, Companies House, the company website). Never invent companies, domains or people. source_url should be the company website or a public listing. If you cannot reliably find 10, return fewer. Do not include any company already in this list: ${(companies || []).map((c) => c.name).join(", ")}.`,
        response_json_schema: {
          type: "object",
          properties: {
            companies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" }, domain: { type: "string" }, website: { type: "string" },
                  industry: { type: "string" }, employee_range: { type: "string" }, location: { type: "string" },
                  why_fits: { type: "string" }, source_url: { type: "string" },
                },
              },
            },
          },
        },
      });
      const res = response.data?.result ?? response.result;
      const parsed = typeof res === "string" ? JSON.parse(res) : res;
      const found = (parsed?.companies || []).filter((c) => c.name);
      if (!found.length) { setDiscoverErr("No companies found. Try refining your brief or ICP."); }
      else {
        const existingNames = new Set(companies.map((c) => c.name.toLowerCase()));
        const fresh = found
          .filter((c) => !existingNames.has(c.name.toLowerCase()))
          .map((c) => ({
            name: c.name,
            domain: c.domain || "",
            website: c.website || "",
            industry: c.industry || "",
            employee_range: c.employee_range || "",
            location: c.location || "",
          }));
        setCompanies([...companies, ...fresh]);
        setDiscoveredCount(fresh.length);
        if (listId && fresh.length) {
          try {
            await base44.entities.Prospect.bulkCreate(
              fresh.map((c) => ({
                list_id: listId,
                company_name: c.name,
                domain: c.domain || "",
                website: c.website || "",
                industry: c.industry || "",
                employee_range: c.employee_range || "",
                location: c.location || "",
                enrichment_status: "pending",
                fit_score: 0,
                pushed: false,
                organisation_id: user.organisation_id,
              }))
            );
            await loadProspects(listId);
            setMsg(`Saved ${fresh.length} discovered compan${fresh.length === 1 ? "y" : "ies"} to your list.`);
          } catch { setErr("Could not auto-save discovered companies."); }
        }
      }
    } catch (e) { setDiscoverErr(e.message || "Could not discover companies."); }
    finally { setDiscovering(false); }
  };

  const extractIcp = async () => {
    if (!brief.trim()) return;
    setExtracting(true); setErr("");
    try {
      const response = await base44.functions.invoke("runSmartAction", {
        action_type: "icp_extraction",
        prompt:
          "From the following campaign brief, extract a concise Ideal Customer Profile (ICP) as plain text bullets covering: target industries, company sizes, geographic regions, target decision-maker roles/seniority, and any qualifying signals or criteria. Be specific and actionable.\n\nBrief:\n" + brief,
      });
      const res = response.data?.result ?? response.result;
      const text = typeof res === "string" ? res : JSON.stringify(res);
      setIcp(text);
      if (listId) await base44.entities.ProspectList.update(listId, { icp: text });
    } catch { setErr("Could not extract ICP."); }
    finally { setExtracting(false); }
  };

  // Enrich a single prospect — shared by bulk enrich and per-row re-enrich.
  const enrichSingle = async (prospect) => {
    await base44.entities.Prospect.update(prospect.id, { enrichment_status: "enriching" }).catch(() => {});
    const res = await base44.functions.invoke("enrichProspect", {
      company_name: prospect.company_name,
      brief,
      icp,
      permitted_countries: permittedCountries,
      list_id: listId,
      prospect_id: prospect.id,
      force_refresh: true,
      existing: {
        company_name: prospect.company_name, domain: prospect.domain, website: prospect.website,
        industry: prospect.industry, employee_range: prospect.employee_range, location: prospect.location,
        country_code: prospect.country_code, geography_status: prospect.geography_status,
        geography_reason: prospect.geography_reason, landline: prospect.landline, contacts: prospect.contacts,
        full_name: prospect.full_name, job_title: prospect.job_title, email: prospect.email,
        phone: prospect.phone, linkedin: prospect.linkedin, source: prospect.source,
        retry_cooldown_expires_at: prospect.retry_cooldown_expires_at,
        fit_score: prospect.fit_score, fit_reason: prospect.fit_reason, target_role: prospect.target_role,
      },
    });
    const out = res.data || res;
    if (out && !out.error) {
      const patch = { ...out, enrichment_status: out.enrichment_status || "enriched" };
      delete patch.error;
      await base44.entities.Prospect.update(prospect.id, patch);
      return { ok: true, outOfScope: out.enrichment_status === "out_of_scope" };
    }
    await base44.entities.Prospect.update(prospect.id, { enrichment_status: "not_found" }).catch(() => {});
    return { ok: false };
  };

  const enrich = async () => {
    if (!listId) return;
    setEnriching(true); setErr(""); setMsg(""); setBatchSummary(null);
    try {
      // Create Prospect records for any newly added companies first.
      const existing = new Set(prospects.map((p) => (p.company_name || "").toLowerCase()));
      const newOnes = companies.filter((c) => !existing.has(c.name.toLowerCase()));
      if (newOnes.length) {
        await base44.entities.Prospect.bulkCreate(
          newOnes.map((c) => ({
            list_id: listId,
            company_name: c.name,
            domain: c.domain || "",
            website: c.website || "",
            industry: c.industry || "",
            employee_range: c.employee_range || "",
            location: c.location || "",
            enrichment_status: "pending",
            fit_score: 0,
            pushed: false,
            organisation_id: user.organisation_id,
          }))
        );
      }
      setCompanies([]);
      await loadProspects(listId);

      // Enrich one at a time so each call finishes within the HTTP timeout
      // and the table updates incrementally with live progress.
      const toEnrich = (await base44.entities.Prospect.filter(
        { list_id: listId, enrichment_status: "pending" }, "-created_date", 50
      )).filter((p) => !p.retry_cooldown_expires_at || new Date(p.retry_cooldown_expires_at) < new Date());

      if (!toEnrich.length) {
        setMsg("No companies need enriching right now.");
        return;
      }

      let enriched = 0, failed = 0, outOfScope = 0;
      for (const prospect of toEnrich) {
        try {
          const result = await enrichSingle(prospect);
          if (result.ok) { enriched++; if (result.outOfScope) outOfScope++; }
          else failed++;
        } catch {
          failed++;
          await base44.entities.Prospect.update(prospect.id, {
            enrichment_status: "failed",
            provider_error: "provider_error",
            last_attempted_at: new Date().toISOString(),
          }).catch(() => {});
        }
        await loadProspects(listId);
      }

      setBatchSummary({
        processed: toEnrich.length, enriched, failed, out_of_scope: outOfScope, truncated: false,
      });
      setMsg(`Enriched ${enriched} of ${toEnrich.length} companies${outOfScope ? `, ${outOfScope} out of scope` : ""}${failed ? `, ${failed} failed` : ""}.`);
    } catch (e) {
      setErr(e.message || "Enrichment failed.");
      await loadProspects(listId);
    } finally {
      setEnriching(false);
    }
  };

  // Re-enrich a single company.
  const enrichOne = async (prospect) => {
    setBusyId(prospect.id); setErr(""); setMsg("");
    try {
      const result = await enrichSingle(prospect);
      if (result.ok) setMsg(result.outOfScope ? `${prospect.company_name} is out of scope.` : `Re-enriched ${prospect.company_name}.`);
      else setMsg(`No data found for ${prospect.company_name}.`);
      await loadProspects(listId);
    } catch (e) { setErr(e.message || "Re-enrichment failed."); }
    finally { setBusyId(null); }
  };

  // Save new companies as prospect records, auto-select them, then open the
  // enrichment dialog so the count reflects the new batch being enriched.
  const openEnrichDialog = async () => {
    if (companies.length) {
      const existing = new Set(prospects.map((p) => (p.company_name || "").toLowerCase()));
      const newOnes = companies.filter((c) => !existing.has(c.name.toLowerCase()));
      if (newOnes.length) {
        const created = await base44.entities.Prospect.bulkCreate(
          newOnes.map((c) => ({
            list_id: listId,
            company_name: c.name,
            domain: c.domain || "",
            website: c.website || "",
            industry: c.industry || "",
            employee_range: c.employee_range || "",
            location: c.location || "",
            enrichment_status: "pending",
            fit_score: 0,
            pushed: false,
            organisation_id: user.organisation_id,
          }))
        );
        const createdArray = Array.isArray(created) ? created : [created];
        setSelected(createdArray.map((p) => p.id));
        await loadProspects(listId);
      }
      setCompanies([]);
    }
    setShowSelectiveEnrich(true);
  };

  // Core push logic — shared by single-row and bulk push.
  const pushOneProspect = async (prospect) => {
    await pushProspectsToTargetList({ prospectIds: [prospect.id], targetListId: pushListId });
  };

  // Push a single prospect (per-row button).
  const pushToList = async (prospect) => {
    if (!pushListId) { setErr("Select a target list to push to first."); return; }
    setBusyId(prospect.id); setErr(""); setMsg("");
    try {
      await pushOneProspect(prospect);
      await loadProspects(listId);
      setMsg(`${prospect.company_name} pushed to target list.`);
    } catch (e) { setErr(e.message || "Push failed."); }
    finally { setBusyId(null); }
  };

  // One-click: create (or reuse) a target list named after the current sheet,
  // then select it so it shows immediately in the PUSH TO dropdown.
  const quickCreateTarget = async () => {
    const sheetName = (lists.find((l) => l.id === listId)?.name || "").trim();
    if (!sheetName) { setErr("Rename your sheet first."); return; }
    setCreatingTargetBusy(true); setErr(""); setMsg("");
    try {
      const existing = targetLists.find((t) => (t.name || "").trim() === sheetName);
      if (existing) {
        setPushListId(existing.id);
        setMsg(`Selected target list "${sheetName}".`);
        return;
      }
      const c = await base44.entities.Campaign.create({
        name: sheetName,
        status: "active",
        contact_count: 0,
        organisation_id: user.organisation_id,
        owner_user_id: user.id,
      });
      setTargetLists([c, ...targetLists]);
      setPushListId(c.id);
      setMsg(`Created target list "${sheetName}" — push your prospects to it now.`);
    } catch (e) { setErr(e.message || "Could not create target list."); }
    finally { setCreatingTargetBusy(false); }
  };

  // Push all selected prospects in bulk.
  const pushSelected = async () => {
    if (!pushListId) { setErr("Select a target list to push to first."); return; }
    if (!selected.length) { setErr("Select at least one prospect to push."); return; }
    setPushing(true); setErr(""); setMsg(""); setPushProgress({ done: 0, total: selected.length });
    try {
      const result = await pushProspectsToTargetList({
        prospectIds: selected,
        targetListId: pushListId,
        onProgress: setPushProgress,
      });
      await loadProspects(listId);
      setMsg(`Pushed ${result.pushed} of ${selected.length} prospects to target list${result.failed ? ` (${result.failed} failed)` : ""}.`);
      setSelected([]);
    } catch (e) {
      setErr(e.message || "Push failed.");
    } finally {
      setPushing(false);
      setPushProgress(null);
    }
  };

  // Cycle call status for a prospect (new → attempted → connected → callback → new).
  const toggleCallStatus = async (prospect) => {
    const order = ["new", "attempted", "connected", "callback"];
    const current = order.indexOf(prospect.call_status || "new");
    const next = order[(current + 1) % order.length];
    setBusyId(prospect.id); setErr("");
    try {
      await base44.entities.Prospect.update(prospect.id, {
        call_status: next,
        last_called_at: next !== "new" ? new Date().toISOString() : null,
      });
      await loadProspects(listId);
    } catch (e) { setErr(e.message || "Could not update call status."); }
    finally { setBusyId(null); }
  };

  // Delete a single prospect (data is wrong / not suitable).
  const deleteProspect = async (prospect) => {
    if (!confirm(`Delete ${prospect.company_name}? This removes it from this list.`)) return;
    setBusyId(prospect.id); setErr("");
    try {
      await base44.entities.Prospect.delete(prospect.id);
      setSelected(selected.filter((id) => id !== prospect.id));
      await loadProspects(listId);
    } catch (e) { setErr(e.message || "Could not delete prospect."); }
    finally { setBusyId(null); }
  };

  const deleteList = async () => {
    if (!listId) return;
    if (!confirm("Delete this prospect list and all its prospects?")) return;
    try {
      await base44.entities.Prospect.deleteMany({ list_id: listId });
      await base44.entities.ProspectList.delete(listId);
      setLists(lists.filter((l) => l.id !== listId));
      await pickList("");
    } catch (e) { setErr(e.message || "Could not delete list."); }
  };

  const visibleProspects = prospects.filter((p) => matchesFilter(p, prospectFilter) && (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const inCompany = (p.company_name || "").toLowerCase().includes(q);
    const inName = (p.full_name || "").toLowerCase().includes(q);
    const inContacts = (p.contacts || []).some((c) =>
      (c.name || "").toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q)
    );
    return inCompany || inName || inContacts;
  })());
  const prospectViewFiltered = prospectFilter !== "all" || !!searchQuery.trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {!embedded && (
            <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Prospecting</h1>
          )}
          <p className={`${embedded ? "text-sm" : ""} text-slate-500 ${embedded ? "" : "mt-2"}`}>
            {embedded
              ? "Paste a brief, extract your ICP, add companies, enrich, then push into a campaign."
              : "Paste a brief, extract your ICP, add companies, and enrich data — all in one place."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={listId}
              onChange={(e) => openListSelection(e.target.value)}
              className="appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-9 py-2 text-sm text-slate-700 min-w-56"
            >
              <option value="">Select a prospect list or campaign…</option>
              <optgroup label="Prospect lists">
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name?.trim() || "Untitled list"}</option>)}
              </optgroup>
              {targetLists.length > 0 && (
                <optgroup label="Campaigns">
                  {targetLists.map((campaign) => (
                    <option key={`campaign-${campaign.id}`} value={`campaign:${campaign.id}`}>
                      {campaign.name?.trim() || "Untitled campaign"}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {listId && (
            editingName ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  placeholder="List name"
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 min-w-48 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <Button onClick={saveName} disabled={savingName} size="icon" variant="ghost" className="rounded-full h-9 w-9 text-emerald-600 hover:bg-emerald-50">
                  {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
              </div>
            ) : (
              <Button onClick={startRename} size="sm" variant="ghost" className="rounded-full text-slate-400 hover:text-slate-600">
                <Pencil className="w-3.5 h-3.5 mr-1" /> Rename
              </Button>
            )
          )}
        </div>
      </div>

      <ProspectStart
        listId={listId}
        prospects={prospects}
        onListCreated={handleListCreated}
        onImported={(id) => loadProspects(id)}
        onRunFinished={handleRunFinished}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {campaignContext ? <CampaignBriefEditor campaignId={campaignContext} onSaved={data=>{setBrief(data.brief);setIcp(data.icp);}} /> : <BriefInput brief={brief} setBrief={setBrief} onStart={!listId ? startList : undefined} starting={starting} />}

          {!campaignContext && (icp || listId) && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <label htmlFor="editable-icp" className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">Ideal Customer Profile — editable</label>
                <textarea
                  id="editable-icp"
                  value={icp}
                  onChange={(e) => setIcp(e.target.value)}
                  placeholder="Add target industries, size, UK-only geography, roles and qualifying signals…"
                  rows={7}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <GeographySelector permittedCountries={permittedCountries} onChange={setPermittedCountries} />
            </div>
          )}

          {!campaignContext && <div className="flex gap-2">
            <Button onClick={extractIcp} disabled={!brief.trim() || extracting} variant="outline" className="rounded-full border-emerald-300 text-emerald-700">
              {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              {extracting ? "Extracting…" : "Auto-generate ICP"}
            </Button>
            {listId && (
              <>
                <Button onClick={saveListDetails} disabled={savingDetails} variant="outline" className="rounded-full border-emerald-300 text-emerald-700">
                  {savingDetails ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save brief & ICP
                </Button>
                <Button onClick={deleteList} variant="ghost" className="rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete list
                </Button>
              </>
            )}
          </div>}
        </div>

        <div className="space-y-4">
          <CompanyInput
            companies={companies}
            setCompanies={setCompanies}
            onDiscover={discoverCompanies}
            discovering={discovering}
            discoverErr={discoverErr}
            discoveredCount={discoveredCount}
            listId={listId}
          />
          {listId && !prospects.length && (
            <Button
              onClick={openEnrichDialog}
              disabled={enriching || !companies.length}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500 w-full"
            >
              {enriching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {enriching ? "Enriching…" : `Enrich ${companies.length} companies`}
            </Button>
          )}
        </div>
      </div>

      {listId && (
        <ProspectResearchWorkspace
          listId={listId}
          prospects={prospects}
          onResearched={async () => {
            await loadProspects(listId);
            await reloadResearch();
          }}
          onFindContacts={openProviderEnrich}
          onPromptChanged={async () => {
            await loadProspects(listId);
            await reloadResearch();
          }}
          onResearchLoaded={(records) =>
            setResearchByProspect(Object.fromEntries([...records].reverse().map((r) => [r.prospect_id, r])))
          }
          onImported={reloadResearch}
        />
      )}

      {campaignContext && <><DataReadinessPanel campaignId={campaignContext}/><ReviewQueuePanel campaignId={campaignContext} onChanged={()=>loadProspects(listId)}/></>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      {err && <p className="text-sm text-rose-600">{err}</p>}

      {enrichmentSession && (
        <EnrichmentSessionBanner
          session={enrichmentSession}
          onDismiss={() => setEnrichmentSession(null)}
          onCancelled={() => {
            setEnrichmentSession(null);
            setMsg("Enrichment session cancelled.");
          }}
        />
      )}

      {listId && (
        loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
        ) : (
          <>
            {prospects.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search company, name or role…"
                    className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <ProspectFilters
                  activeFilter={prospectFilter}
                  onChange={setProspectFilter}
                  totalCount={prospects.length}
                  counts={{
                    all: prospects.length,
                    needs_attention: prospects.filter((p) => !p.email || (p.email && p.email_type !== "personal_work" && (p.email_type === "generic_company" || p.email_type === "role_based_work" || (p.generic_email && p.email === p.generic_email))) || !p.phone || p.enrichment_status === "failed").length,
                    generic_only: prospects.filter((p) => p.email && p.email_type !== "personal_work" && (p.email_type === "generic_company" || p.email_type === "role_based_work" || (p.generic_email && p.email === p.generic_email))).length,
                    no_email: prospects.filter((p) => !p.email).length,
                    missing_phone: prospects.filter((p) => !p.phone).length,
                    complete: prospects.filter((p) => p.enrichment_status === "complete").length,
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                  <span>Showing <strong className="text-slate-800">{visibleProspects.length}</strong> of <strong className="text-slate-800">{prospects.length}</strong> companies</span>
                  {prospectViewFiltered && (
                    <button onClick={() => { setProspectFilter("all"); setSearchQuery(""); }} className="text-emerald-700 hover:text-emerald-800 font-medium">
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CampaignExportButton listId={listId} />
                  {listId && (
                    <Button
                      onClick={openEnrichDialog}
                      disabled={enriching}
                      className="rounded-full bg-emerald-600 hover:bg-emerald-500"
                    >
                      <Sparkles className="w-4 h-4 mr-2" /> Enrich {selected.length ? selected.length + " selected" : "all"}
                    </Button>
                  )}
                  {selected.length > 0 && (
                    <button onClick={() => setSelected([])} className="text-xs text-slate-400 hover:text-slate-600">
                      Clear {selected.length} selected
                    </button>
                  )}
                </div>
                {targetLists.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No target lists yet.{" "}
                    <Link to="/campaigns" className="text-slate-900 font-medium underline underline-offset-2 hover:text-slate-700">
                      Create one first
                    </Link>{" "}
                    — you'll push prospects into it from here.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                    <span className="text-xs uppercase tracking-widest text-slate-400 hidden sm:inline">Push to:</span>
                    <div className="relative flex-1 sm:flex-none">
                      <select
                        value={pushListId}
                        onChange={(e) => setPushListId(e.target.value)}
                        className="appearance-none w-full sm:w-auto rounded-full border border-slate-200 bg-white pl-4 pr-9 py-1.5 text-sm text-slate-700"
                      >
                        <option value="">Select target list…</option>
                        {targetLists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <Button onClick={quickCreateTarget} disabled={creatingTargetBusy} variant="outline" className="rounded-full border-slate-300 w-full sm:w-auto">
                      {creatingTargetBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} New target list
                    </Button>
                    <Button
                      onClick={pushSelected}
                      disabled={!pushListId || !selected.length || pushing}
                      className="rounded-full bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                    >
                      {pushing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      {pushing ? "Pushing…" : `Push ${selected.length || ""} selected`}
                    </Button>
                  </div>
                )}
                {pushing && (
                  <PushProgress
                    label={`Pushing to ${targetLists.find((t) => t.id === pushListId)?.name || "target list"}…`}
                    done={pushProgress?.done || 0}
                    total={pushProgress?.total || selected.length || 0}
                  />
                )}
              </div>
            )}
            <ProspectTable
              prospects={visibleProspects}
              selected={selected}
              setSelected={setSelected}
              onEnrich={enrichOne}
              onPush={pushToList}
              onDelete={deleteProspect}
              onToggleCall={toggleCallStatus}
              onFindPhone={(p) => openProviderEnrich([p.id], "phone")}
              busyId={busyId}
              researchByProspect={researchByProspect}
              listId={listId}
              onResearchUpdated={(next) => {
                if (!next?.prospect_id) return;
                setResearchByProspect((prev) => ({ ...prev, [next.prospect_id]: next }));
              }}
            />
            {batchSummary && (
              <EnrichmentBatchSummary
                summary={batchSummary}
                prospects={prospects}
                onClose={() => setBatchSummary(null)}
              />
            )}
          </>
        )
      )}
      <SelectiveEnrichDialog
        key={enrichIntent}
        open={showSelectiveEnrich}
        intent={enrichIntent}
        onClose={() => setShowSelectiveEnrich(false)}
        selectedProspects={prospects.filter((p) => selected.includes(p.id))}
        allProspects={prospects}
        listId={listId}
        providerOrder={providerOrder}
        connectedProviders={connectedProviders}
        onStarted={(sessionData) => {
          setEnrichmentSession({...sessionData,id:sessionData.session_id});
          setEnriching(false);
          setMsg(`Enrichment started — ${sessionData.queued_count || sessionData.total_records || 0} records processing in the background. This takes a while (perfect for a coffee break or pairing with calls). We'll let you know when your fresh data is ready.`);
        }}
      />
    </div>
  );
}