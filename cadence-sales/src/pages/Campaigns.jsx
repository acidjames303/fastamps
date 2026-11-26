import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import DictateButton from "@/components/dialer/DictateButton";
import {
  Plus, Users, Loader2, Play, Pause, Target, Upload,
  ArrowRight, Search, CheckCircle2, Pencil, ClipboardList, Split,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import DeleteCampaignDialog from "@/components/campaigns/DeleteCampaignDialog";
import RenameCampaignDialog from "@/components/campaigns/RenameCampaignDialog";
import SplitCampaignData from "@/components/campaigns/SplitCampaignData";
import CampaignAttentionRollup from "@/components/campaigns/CampaignAttentionRollup";
import PushProgress from "@/components/PushProgress";
import Prospecting from "@/pages/Prospecting";
import CampaignNextStep from "@/components/campaigns/CampaignNextStep";
import { buildCampaignAttentionRollup, countIrsByCampaign } from "@/lib/campaignAttention";

const TABS = [
  { id: "campaigns", label: "Campaigns" },
  { id: "prospect", label: "Find prospects" },
];

const STATUS_TONE = {
  draft: "bg-slate-100 text-slate-600",
  ready: "bg-sky-50 text-sky-700",
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-slate-100 text-slate-500",
  archived: "bg-slate-100 text-slate-400",
};

const emptyForm = {
  name: "",
  client_name: "",
  offer: "",
  call_opener: "",
  callers_may_save_email_drafts: false,
};

export default function Campaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "campaigns";
  const wantNew = params.get("new") === "1";
  // Arriving from a caller's account narrows the list to the campaigns pushed
  // to that person. No campaign record is changed by this view.
  const callerFilter = params.get("caller") || "";

  const [lists, setLists] = useState(null);
  const [calls, setCalls] = useState([]);
  const [contactCounts, setContactCounts] = useState({});
  const [companyCounts, setCompanyCounts] = useState({});
  const [prospectRowCounts, setProspectRowCounts] = useState({});
  const [callers, setCallers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(wantNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [renameFor, setRenameFor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pushFor, setPushFor] = useState(null);
  const [pushCaller, setPushCaller] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [splitFor, setSplitFor] = useState(null);
  const [statusBusy, setStatusBusy] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [irByCampaign, setIrByCampaign] = useState({});
  const [attentionOnly, setAttentionOnly] = useState(false);

  const isAdmin = ["platform_owner", "organisation_admin"].includes(user?.app_role);
  const isManager = ["platform_owner", "organisation_admin", "sales_manager"].includes(user?.app_role);
  const canProspect = isAdmin || user?.app_role === "sales_manager" || user?.app_role === "platform_owner";

  const setTab = (id) => {
    const next = new URLSearchParams(params);
    if (id === "campaigns") next.delete("tab");
    else next.set("tab", id);
    next.delete("new");
    setParams(next, { replace: true });
  };

  // Legacy Import CSV tab → Find prospects Import (one door, not two).
  useEffect(() => {
    if (params.get("tab") === "import") {
      const next = new URLSearchParams(params);
      next.set("tab", "prospect");
      next.set("import", "1");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const load = async () => {
    try {
      const [camps, callRes, profiles, countRes] = await Promise.all([
        base44.entities.Campaign.list("-created_date", 100),
        base44.entities.CallLog.list("-created_date", 500).catch(() => []),
        base44.entities.UserProfile.filter({ organisation_id: user?.organisation_id }).catch(() => []),
        base44.functions.invoke("getCampaignContactCounts", {}).catch(() => null),
      ]);
      setLists(camps || []);
      setCalls(callRes || []);
      setContactCounts(countRes?.data?.counts || {});
      setCompanyCounts(countRes?.data?.companies || {});
      setProspectRowCounts(countRes?.data?.prospect_rows || {});
      setProfiles(profiles || []);
      setCallers((profiles || []).filter((p) => p.app_role === "bdm" && p.status === "active"));
    } catch (e) {
      setError(e.message || "Could not load campaigns.");
    }
  };

  useEffect(() => { load(); }, [user?.organisation_id]);
  useEffect(() => { if (wantNew) setOpen(true); }, [wantNew]);

  useEffect(() => {
    if (!callerFilter) { setAssignments([]); return; }
    base44.entities.CampaignAssignment
      .filter({ assigned_user_id: callerFilter }, "-created_date", 1000)
      .then(setAssignments)
      .catch(() => setAssignments([]));
  }, [callerFilter]);

  // Admin inbox pending IRs — light signal for the Campaigns attention rollup.
  useEffect(() => {
    if (!isAdmin) { setIrByCampaign({}); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke("getManagerInbox", {});
        const data = res.data || res;
        if (!cancelled) setIrByCampaign(countIrsByCampaign(data.items || []));
      } catch {
        if (!cancelled) setIrByCampaign({});
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, lists?.length]);

  const clearCaller = () => {
    const next = new URLSearchParams(params);
    next.delete("caller");
    setParams(next, { replace: true });
  };

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await base44.entities.Campaign.create({
        name: form.name.trim(),
        client_name: form.client_name.trim(),
        offer: form.offer,
        call_opener: form.call_opener,
        callers_may_save_email_drafts: !!form.callers_may_save_email_drafts,
        status: "active",
        contact_count: 0,
        organisation_id: user.organisation_id,
        owner_user_id: user.id,
        timezone: "Europe/London",
        calling_days: ["mon", "tue", "wed", "thu", "fri"],
        calling_hours: { start: "09:00", end: "17:00" },
      });
      setForm(emptyForm);
      setOpen(false);
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
      await load();
      setMessage(`“${created.name}” is ready. Add prospects, import a CSV, start calling, or push it to a teammate.`);
    } catch (e) {
      setError(e.message || "Could not create campaign.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setError("");
    try {
      await base44.entities.Campaign.delete(toDelete.id);
      setToDelete(null);
      await load();
    } catch (e) {
      setError(e.message || "Could not delete this campaign.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleStatus = async (c) => {
    setStatusBusy(c.id);
    try {
      const next = c.status === "active" ? "paused" : "active";
      await base44.entities.Campaign.update(c.id, { status: next });
      setLists((prev) => (prev || []).map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    } catch (e) {
      setError(e.message || "Could not update status.");
    } finally {
      setStatusBusy("");
    }
  };

  const pushCampaign = async () => {
    if (!pushFor || !pushCaller) return;
    setPushBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("pushCampaignToCaller", {
        campaign_id: pushFor.id,
        caller_user_id: pushCaller,
        mode: "assign_available",
      });
      const data = res.data || res;
      setMessage(`Pushed “${pushFor.name}” — ${data.created || 0} new, ${data.reassigned || 0} moved.`);
      setPushFor(null);
      setPushCaller("");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not push campaign.");
    } finally {
      setPushBusy(false);
    }
  };

  const callerCampaignIds = useMemo(
    () => new Set(assignments.map((a) => a.campaign_id).filter(Boolean)),
    [assignments]
  );
  const callerName = profiles.find((p) => p.user_id === callerFilter)?.full_name || "";

  const attentionRollup = useMemo(() => {
    if (!isManager || !lists) return null;
    return buildCampaignAttentionRollup({
      campaigns: lists,
      companyCounts,
      contactCounts,
      irByCampaign,
      canProspect,
      isManager,
    });
  }, [isManager, lists, companyCounts, contactCounts, irByCampaign, canProspect]);

  const attentionIds = useMemo(
    () => new Set(attentionRollup?.campaignIds || []),
    [attentionRollup],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (lists || []).filter((l) => {
      if (callerFilter && !callerCampaignIds.has(l.id)) return false;
      if (attentionOnly && !attentionIds.has(l.id)) return false;
      if (!q) return true;
      return (l.name || "").toLowerCase().includes(q) || (l.client_name || "").toLowerCase().includes(q);
    });
  }, [lists, searchQuery, callerFilter, callerCampaignIds, attentionOnly, attentionIds]);

  // Live count of contacts working inside a campaign, straight from the Contact
  // records assigned to it (never the stored tally, which can be out of date).
  const contactsIn = (c) => contactCounts[c.id] ?? 0;
  const companiesIn = (c) => companyCounts[c.id] ?? 0;
  const prospectRowsIn = (c) => prospectRowCounts[c.id];

  const callsToday = (cid) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return calls.filter((cl) => {
      if (cl.campaign_id !== cid) return false;
      const d = cl.started_at || cl.created_date;
      return d && new Date(d) >= start;
    }).length;
  };

  if (!lists) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Campaigns</h1>
          <p className="text-slate-500 mt-2 max-w-2xl">
            {tab === "prospect"
              ? "Find prospects — import research, describe a campaign, continue existing work, or start from a template."
              : "One place to create a campaign, find or import prospects, then start calling — or push the work to your team."}
          </p>
        </div>
        {tab === "campaigns" && isManager && (
          <Button onClick={() => setOpen((v) => !v)} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" /> New campaign
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          if (t.id !== "campaigns" && !canProspect) return null;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {message && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">{message}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {tab === "prospect" && canProspect && (
        <div className="space-y-6">
          <Prospecting embedded />
        </div>
      )}

      {tab === "campaigns" && (
        <>
          {isManager && attentionRollup && (
            <CampaignAttentionRollup
              rollup={attentionRollup}
              filterOn={attentionOnly}
              onToggleFilter={() => setAttentionOnly((v) => !v)}
              activatingId={statusBusy}
              onActivate={(campaignId) => {
                const camp = (lists || []).find((c) => c.id === campaignId);
                if (camp) toggleStatus(camp);
              }}
              onSplit={(campaignId) => {
                const camp = (lists || []).find((c) => c.id === campaignId);
                if (camp) setSplitFor(camp);
              }}
            />
          )}

          {open && (
            <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-slate-900">Create a campaign</h2>
                <p className="text-xs text-slate-400 mt-1">Name it, add the offer, then build the list or start dialling.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Campaign name *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded-xl"
                />
                <Input
                  placeholder="Client name (optional)"
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Textarea
                  placeholder="What are you offering?"
                  value={form.offer}
                  onChange={(e) => setForm({ ...form, offer: e.target.value })}
                  className="rounded-xl min-h-20"
                />
                <div className="mt-1.5">
                  <DictateButton value={form.offer} onChange={(v) => setForm({ ...form, offer: v })} label="Dictate offer" />
                </div>
              </div>
              <div>
                <Textarea
                  placeholder="Call opener — first line when they answer (optional)"
                  value={form.call_opener}
                  onChange={(e) => setForm({ ...form, call_opener: e.target.value })}
                  className="rounded-xl min-h-16"
                />
                <div className="mt-1.5">
                  <DictateButton value={form.call_opener} onChange={(v) => setForm({ ...form, call_opener: v })} label="Dictate call opener" />
                </div>
              </div>
              {isAdmin && (
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!!form.callers_may_save_email_drafts}
                    onChange={(e) => setForm({ ...form, callers_may_save_email_drafts: e.target.checked })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">Allow callers to save email drafts</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Otherwise info requests land in Admin inbox only.</span>
                  </span>
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={create} disabled={busy || !form.name.trim()} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Create & continue
                </Button>
                <Button type="button" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {lists.length === 0 && !open ? (
            <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center space-y-4">
              <Target className="w-8 h-8 text-emerald-600 mx-auto" />
              <h2 className="font-display text-2xl font-semibold text-slate-900">Start your first campaign</h2>
              <p className="text-slate-500 max-w-md mx-auto">
                Create a campaign, add prospects (find or import), then call yourself or push it to an SDR.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button onClick={() => setOpen(true)} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" /> New campaign
                </Button>
                {canProspect && (
                  <>
                    <Button variant="outline" className="rounded-full" onClick={() => setTab("prospect")}>
                      <Target className="w-4 h-4 mr-2" /> Find prospects
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => navigate("/campaigns?tab=prospect&import=1")}
                    >
                      <Upload className="w-4 h-4 mr-2" /> Import research
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {callerFilter && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm text-emerald-900">
                    Showing campaigns pushed to <span className="font-medium">{callerName || "this caller"}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Link to={`/team/${callerFilter}`} className="text-xs text-emerald-800 hover:underline">
                      Open their account
                    </Link>
                    <Button size="sm" variant="ghost" className="rounded-full text-xs text-emerald-900" onClick={clearCaller}>
                      Show all campaigns
                    </Button>
                  </div>
                </div>
              )}

              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search campaigns…"
                  className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-3">
                {filtered.map((c) => {
                  const today = callsToday(c.id);
                  const total = calls.filter((cl) => cl.campaign_id === c.id).length;
                  const isActive = c.status === "active";
                  return (
                    <div key={c.id} className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-900">
                              <Link to={`/contacts?campaign=${c.id}`} className="hover:text-emerald-600" title="See the contacts in this campaign">
                                {c.name}
                              </Link>
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_TONE[c.status] || STATUS_TONE.draft}`}>
                              {c.status}
                            </span>
                            {isManager && (
                              <button
                                type="button"
                                onClick={() => setRenameFor(c)}
                                title="Rename this campaign"
                                className="text-slate-400 hover:text-emerald-600 rounded-full p-1 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {c.client_name ? `${c.client_name} · ` : ""}
                            {today} calls today · {total} total · {companiesIn(c)} unique compan{companiesIn(c) === 1 ? "y" : "ies"} · {contactsIn(c)} contact{contactsIn(c) === 1 ? "" : "s"}
                            {prospectRowsIn(c) != null && prospectRowsIn(c) !== companiesIn(c)
                              ? ` · ${prospectRowsIn(c)} prospect rows`
                              : ""}
                            {c.offer ? ` · ${c.offer.slice(0, 80)}${c.offer.length > 80 ? "…" : ""}` : ""}
                          </p>
                          {callerFilter && (
                            <p className="text-xs text-emerald-700 mt-1">
                              {assignments.filter((a) => a.campaign_id === c.id).length} accounts assigned to them ·{" "}
                              {assignments.filter((a) => a.campaign_id === c.id && a.status === "completed").length} done
                            </p>
                          )}
                          {prospectRowsIn(c) != null && prospectRowsIn(c) !== companiesIn(c) && (
                            <p className="text-xs text-slate-400 mt-1">
                              Prospect rows are preserved separately from unique linked companies, so imported aliases and unlinked records stay visible.
                            </p>
                          )}
                        </div>
                      </div>

                      <CampaignNextStep
                        campaign={c}
                        companies={companiesIn(c)}
                        contacts={contactsIn(c)}
                        canProspect={canProspect}
                        isManager={isManager}
                        activating={statusBusy === c.id}
                        onActivate={toggleStatus}
                      />

                      <div className="flex flex-wrap gap-2">
                        {isManager && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full h-9"
                            disabled={statusBusy === c.id || ["completed", "archived"].includes(c.status)}
                            onClick={() => toggleStatus(c)}
                          >
                            {statusBusy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isActive ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                            {isActive ? "Pause" : "Activate"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-9"
                          onClick={() => navigate(`/contacts?campaign=${c.id}`)}
                          title="See the contacts in this campaign"
                        >
                          <Users className="w-4 h-4 mr-1" /> Contacts
                        </Button>
                        {isManager && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full h-9"
                            onClick={() => { setPushFor(c); setPushCaller(callers[0]?.user_id || ""); }}
                            disabled={!callers.length}
                            title={callers.length ? "Push into an SDR account" : "Invite a caller on Team first"}
                          >
                            <Users className="w-4 h-4 mr-1" /> Push to team
                          </Button>
                        )}
                        {isManager && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full h-9"
                            onClick={() => setSplitFor(c)}
                            disabled={!callers.length}
                            title={callers.length ? "Split accounts by territory, industry, evenly, or dictate" : "Invite callers on Team first"}
                          >
                            <Split className="w-4 h-4 mr-1" /> Split data
                          </Button>
                        )}
                        <Link to={`/target-lists/${c.id}`}>
                          <Button size="sm" variant="ghost" className="rounded-full h-9">
                            Open <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                        <Link to={`/campaign-delivery/${c.id}`}><Button size="sm" variant="outline" className="rounded-full">Data quality</Button></Link>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => navigate(`/campaigns/${c.id}/accounts`)}>
                          <ClipboardList className="w-3.5 h-3.5 mr-1" /> Accounts &amp; notes
                        </Button>
                        {canProspect && (
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => navigate(`/campaigns?tab=prospect&campaign=${c.id}`)}>
                            <Target className="w-3.5 h-3.5 mr-1" /> Find prospects
                          </Button>
                        )}
                        {isAdmin && (
                          <label className="inline-flex items-center gap-2 text-xs text-slate-600 rounded-full border border-slate-200 px-3 py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!c.callers_may_save_email_drafts}
                              onChange={async (e) => {
                                const checked = e.target.checked;
                                try {
                                  await base44.entities.Campaign.update(c.id, { callers_may_save_email_drafts: checked });
                                  setLists((prev) => (prev || []).map((x) => (x.id === c.id ? { ...x, callers_may_save_email_drafts: checked } : x)));
                                } catch (err) {
                                  setError(err.message || "Could not update email permission.");
                                }
                              }}
                            />
                            Callers may save email drafts
                          </label>
                        )}
                        {isManager && (
                          <button
                            type="button"
                            className="text-xs text-slate-400 hover:text-rose-600 ml-auto"
                            onClick={() => setToDelete(c)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {pushFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Push “{pushFor.name}” to a caller</h3>
            <p className="text-sm text-slate-500">Adds the campaign to their queue so they can dial it from Today / Dialer.</p>
            {pushBusy && <PushProgress label="Pushing campaign and its companies…" />}
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={pushCaller}
              onChange={(e) => setPushCaller(e.target.value)}
            >
              <option value="">Select caller…</option>
              {callers.map((c) => (
                <option key={c.user_id} value={c.user_id}>{c.full_name || c.email}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" className="rounded-full" onClick={() => setPushFor(null)}>Cancel</Button>
              <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" disabled={!pushCaller || pushBusy} onClick={pushCampaign}>
                {pushBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
                Push
              </Button>
            </div>
          </div>
        </div>
      )}

      <SplitCampaignData
        campaign={splitFor}
        callers={callers}
        open={!!splitFor}
        onClose={() => setSplitFor(null)}
        onDone={(data) => {
          const parts = Object.entries(data.per_user || {}).map(([id, count]) => {
            const name = callers.find((c) => c.user_id === id)?.full_name || "Caller";
            return `${name} ${count}`;
          });
          setMessage(
            `Split “${splitFor?.name}” — ${data.created || 0} new, ${data.updated || 0} moved${parts.length ? ` · ${parts.join(", ")}` : ""}.`,
          );
          load();
        }}
      />

      <RenameCampaignDialog
        campaign={renameFor}
        onClose={() => setRenameFor(null)}
        onSaved={(updated) => {
          setLists((prev) => (prev || []).map((x) => (x.id === updated.id ? { ...x, name: updated.name } : x)));
          setMessage(`Renamed to “${updated.name}”.`);
        }}
      />

      <DeleteCampaignDialog
        campaign={toDelete}
        open={!!toDelete}
        onOpenChange={(v) => { if (!v) setToDelete(null); }}
        onConfirm={confirmDelete}
        deleting={deleting}
      />
    </div>
  );
}