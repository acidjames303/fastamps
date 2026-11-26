import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  UserPlus, Loader2, Users, Building2, Phone, Inbox, RefreshCw,
} from "lucide-react";
import { ROLE_LABELS, LIVE_STATUS_LABEL, LIVE_STATUS_TONE, LIVE_STATUS_HINT } from "@/lib/roleLabels";
import ManagerInboxPanel from "@/components/team/ManagerInboxPanel";
import QualifiedOpportunitiesPanel from "@/components/team/QualifiedOpportunitiesPanel";

function formatTalkMinutes(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s}s on calls`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min on calls`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m on calls` : `${h}h on calls`;
}

export default function Team() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("bdm");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [members, setMembers] = useState([]);
  const [org, setOrg] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [workload, setWorkload] = useState(null);
  const [workloadLoading, setWorkloadLoading] = useState(true);
  const [managerIdByCaller, setManagerIdByCaller] = useState({});
  const [pushTarget, setPushTarget] = useState({});
  const [busyUser, setBusyUser] = useState("");

  const canInvite = user?.app_role === "platform_owner" || user?.app_role === "organisation_admin";
  const isPlatformOwner = user?.app_role === "platform_owner";
  const isAdmin = user?.app_role === "platform_owner" || user?.app_role === "organisation_admin";
  const canManage = ["platform_owner", "organisation_admin", "sales_manager"].includes(user?.app_role);

  const load = useCallback(async () => {
    setListLoading(true);
    setError("");
    try {
      const orgId = user?.organisation_id;
      const [profiles, orgs] = await Promise.all([
        orgId
          ? base44.entities.UserProfile.filter({ organisation_id: orgId })
          : base44.entities.UserProfile.list("-created_date", 200),
        base44.entities.Organisation.list(),
      ]);
      setMembers(profiles || []);
      setOrg((orgs || []).find((o) => o.id === orgId) || null);
      const map = {};
      (profiles || []).forEach((p) => { if (p.user_id) map[p.user_id] = p.managed_by_user_id || ""; });
      setManagerIdByCaller(map);
    } catch (e) {
      setError(e.message || "Could not load team.");
    } finally {
      setListLoading(false);
    }
  }, [user?.organisation_id]);

  const loadWorkload = useCallback(async () => {
    if (!canManage) { setWorkloadLoading(false); return; }
    try {
      const res = await base44.functions.invoke("getTeamWorkload", {});
      setWorkload(res.data || res);
    } catch (e) {
      /* keep last snapshot */
    } finally {
      setWorkloadLoading(false);
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    loadWorkload();
    if (!canManage) return undefined;
    const id = setInterval(loadWorkload, 15000);
    return () => clearInterval(id);
  }, [loadWorkload, canManage]);

  const invite = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await base44.functions.invoke("inviteTeamMember", {
        email: email.trim(),
        app_role: role,
        full_name: fullName.trim(),
      });
      setMessage(`Invitation sent to ${email.trim()} as ${ROLE_LABELS[role] || role}.`);
      setEmail("");
      setFullName("");
      await load();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Could not send invitation.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const setManager = async (callerUserId, managerUserId) => {
    setBusyUser(callerUserId);
    try {
      const profiles = members.filter((m) => m.user_id === callerUserId);
      if (!profiles[0]) return;
      await base44.entities.UserProfile.update(profiles[0].id, {
        managed_by_user_id: managerUserId || "",
      });
      setManagerIdByCaller((prev) => ({ ...prev, [callerUserId]: managerUserId || "" }));
      await load();
    } catch (e) {
      setError(e.message || "Could not update manager.");
    } finally {
      setBusyUser("");
    }
  };

  const pushCampaign = async (callerUserId, campaignId) => {
    if (!campaignId) return;
    setBusyUser(callerUserId);
    setError("");
    try {
      const res = await base44.functions.invoke("pushCampaignToCaller", {
        campaign_id: campaignId,
        caller_user_id: callerUserId,
        mode: "assign_available",
      });
      const data = res.data || res;
      setMessage(
        `Campaign pushed — ${data.created || 0} new assignments, ${data.reassigned || 0} moved to caller.`,
      );
      setPushTarget((p) => ({ ...p, [callerUserId]: "" }));
      await loadWorkload();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not push campaign.");
    } finally {
      setBusyUser("");
    }
  };

  const managers = members.filter((m) => ["sales_manager", "organisation_admin", "platform_owner"].includes(m.app_role));
  const callers = (workload?.callers || members.filter((m) => m.app_role === "bdm"));
  const live = workload?.live || { in_call: 0, logging: 0, idle: 0, offline: 0, pending_irs: 0 };
  const campaigns = workload?.campaigns || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-900">Team</h1>
          <p className="text-slate-500 mt-1">
            People, live dialler status, and genuine call activity — not login time.
          </p>
        </div>
        {canManage && (
          <Button type="button" variant="outline" className="rounded-full" onClick={loadWorkload} disabled={workloadLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${workloadLoading ? "animate-spin" : ""}`} /> Refresh live
          </Button>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900">{org?.name || "Organisation"}</p>
          <p className="text-xs text-slate-400">Signed in as {ROLE_LABELS[user?.app_role] || user?.app_role || "user"}</p>
        </div>
        {org?.status && (
          <Badge variant={org.status === "active" ? "default" : "secondary"} className="capitalize">
            {org.status}
          </Badge>
        )}
      </div>

      {canManage && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <LiveStat label="On a call" value={live.in_call} tone="text-emerald-700" hint={LIVE_STATUS_HINT.in_call} />
            <LiveStat label="Logging notes" value={live.logging} tone="text-amber-700" hint={LIVE_STATUS_HINT.logging} />
            <LiveStat label="In Cadence" value={live.idle} tone="text-sky-700" hint={LIVE_STATUS_HINT.idle} />
            <LiveStat label="No recent activity" value={live.offline} tone="text-slate-500" hint={LIVE_STATUS_HINT.offline} />
            <LiveStat label="IR drafts waiting" value={live.pending_irs} tone="text-violet-700" hint="Info requests callers raised that still need a draft" />
          </div>
          <p className="text-[11px] text-slate-400 px-1">
            Live tiles use the dialler heartbeat (last 2 minutes). They are not hours logged in.
          </p>
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4" /> Live callers</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Attempts ≠ conversations. Per-hour uses time on logged calls, not login duration. Refreshes every 15s.
              </p>
            </div>
            {isAdmin && (
              <Link to="/manager-inbox" className="text-sm text-emerald-700 hover:underline inline-flex items-center gap-1">
                <Inbox className="w-4 h-4" /> Open admin inbox
              </Link>
            )}
          </div>
          {workloadLoading && !workload ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : callers.length === 0 ? (
            <p className="text-sm text-slate-400 p-6">No callers yet. Invite someone as Caller / SDR below.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {callers.map((c) => {
                const liveStatus = c.live_status || "offline";
                const profile = members.find((m) => m.user_id === c.user_id);
                return (
                  <div key={c.user_id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{c.name || profile?.full_name || "Caller"}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${LIVE_STATUS_TONE[liveStatus]}`}>
                          {LIVE_STATUS_LABEL[liveStatus]}
                        </span>
                        {(c.pending_irs || 0) > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700">
                            {c.pending_irs} IR waiting
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate" title={LIVE_STATUS_HINT[liveStatus] || ""}>
                        {c.activity_detail || c.email || "—"}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        <span className="font-medium text-slate-800">{c.callsToday || 0}</span> attempts
                        {" · "}
                        <span className="font-medium text-slate-800">{c.conversationsToday || 0}</span> conversations
                        {" · "}
                        {formatTalkMinutes(c.talk_seconds_today)}
                        {typeof c.attempts_per_talk_hour === "number" ? (
                          <>
                            {" · "}
                            <span className="font-medium text-slate-800">{c.attempts_per_talk_hour}</span>
                            {" /hr while dialling"}
                          </>
                        ) : null}
                      </p>
                      {c.assigned_campaign_names?.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1 truncate">
                          Campaigns: {c.assigned_campaign_names.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-full border border-slate-200 text-xs px-3 py-1.5 bg-white"
                        value={managerIdByCaller[c.user_id] || ""}
                        onChange={(e) => setManager(c.user_id, e.target.value)}
                        disabled={busyUser === c.user_id}
                      >
                        <option value="">No managing BDM</option>
                        {managers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>{m.full_name || m.email} ({ROLE_LABELS[m.app_role]})</option>
                        ))}
                      </select>
                      <select
                        className="rounded-full border border-slate-200 text-xs px-3 py-1.5 bg-white max-w-[160px]"
                        value={pushTarget[c.user_id] || ""}
                        onChange={(e) => setPushTarget((p) => ({ ...p, [c.user_id]: e.target.value }))}
                      >
                        <option value="">Push campaign…</option>
                        {campaigns.filter((camp) => camp.status === "active" || camp.status === "ready" || camp.status === "paused").map((camp) => (
                          <option key={camp.id} value={camp.id}>{camp.name}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full"
                        disabled={!pushTarget[c.user_id] || busyUser === c.user_id}
                        onClick={() => pushCampaign(c.user_id, pushTarget[c.user_id])}
                      >
                        {busyUser === c.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5 mr-1" />}
                        Push
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="space-y-4">
          <ManagerInboxPanel limit={5} />
          <QualifiedOpportunitiesPanel limit={5} />
        </div>
      )}

      {canInvite ? (
        <form onSubmit={invite} className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <UserPlus className="w-4 h-4" /> Invite teammate
          </div>
          {isPlatformOwner && (
            <p className="text-xs text-slate-500">
              As platform owner you can invite callers and BDMs even when the org plan seat limit would normally block it.
            </p>
          )}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Name" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="bdm">{ROLE_LABELS.bdm}</option>
                <option value="sales_manager">{ROLE_LABELS.sales_manager}</option>
                <option value="reporting_user">{ROLE_LABELS.reporting_user}</option>
                <option value="organisation_admin">{ROLE_LABELS.organisation_admin}</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Send invite
          </Button>
        </form>
      ) : null}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Everyone</h2>
        </div>
        {listLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.full_name || m.email || "Member"}</p>
                  <p className="text-xs text-slate-400">{m.email}</p>
                </div>
                <span className="text-xs text-slate-500">{ROLE_LABELS[m.app_role] || m.app_role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveStat({ label, value, tone, hint }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4" title={hint || ""}>
      <p className={`text-2xl font-display font-semibold ${tone}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
