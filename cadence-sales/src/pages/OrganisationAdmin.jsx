import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ShieldCheck, Loader2, ArrowRightLeft, KeyRound, UserPlus } from "lucide-react";

const ROLE_LABELS = {
  organisation_admin: "Org Admin",
  sales_manager: "Sales Manager",
  bdm: "BDM",
  reporting_user: "Reporting",
};

const CHANGEABLE_ROLES = ["organisation_admin", "sales_manager", "bdm", "reporting_user"];

// Organisation management surface.
// Platform owners see everything (create orgs, move users between orgs, change roles).
// Organisation admins can change user roles within their own org only.
export default function OrganisationAdmin() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [moveTarget, setMoveTarget] = useState({});
  const [roleTarget, setRoleTarget] = useState({});
  const [cleanOrgName, setCleanOrgName] = useState({});
  const [msg, setMsg] = useState("");
  const [inviteOrgId, setInviteOrgId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("organisation_admin");

  const isPlatformOwner = user?.app_role === "platform_owner";
  const isOrgAdmin = user?.app_role === "organisation_admin";
  const canAccess = isPlatformOwner || isOrgAdmin;

  const load = async () => {
    setLoading(true);
    const [o, u] = await Promise.all([
      isPlatformOwner
        ? base44.functions.invoke("manageOrganisation", { action: "list_orgs" })
        : Promise.resolve({ orgs: [] }),
      base44.functions.invoke("manageOrganisation", { action: "list_users" }),
    ]);
    setOrgs(o.data?.orgs || o.orgs || []);
    setUsers(u.data?.users || u.users || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (!user) return <p className="text-slate-400">Loading…</p>;
  if (!canAccess) {
    return (
      <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center">
        <ShieldCheck className="w-8 h-8 mx-auto text-slate-300" />
        <p className="mt-4 font-medium text-slate-900">Access restricted</p>
        <p className="text-sm text-slate-500 mt-1">Only organisation admins can manage users.</p>
      </div>
    );
  }

  const createOrg = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setMsg("");
    try {
      await base44.functions.invoke("manageOrganisation", { action: "create_org", name: name.trim() });
      setName(""); setMsg(`Created "${name.trim()}".`);
      await load();
    } catch (err) { setMsg(err.message || "Could not create organisation."); }
    finally { setBusy(false); }
  };

  const moveUser = async (userId) => {
    const target = moveTarget[userId];
    if (!target) return;
    setBusy(true); setMsg("");
    try {
      await base44.functions.invoke("manageOrganisation", { action: "move_user", user_id: userId, target_org_id: target, app_role: "bdm" });
      setMsg(`User moved. They must log out and back in for the change to take effect.`);
      await load();
    } catch (err) { setMsg(err.message || "Could not move user."); }
    finally { setBusy(false); }
  };

  const createCleanOrganisation = async (member) => {
    const orgName = (cleanOrgName[member.user_id] || `${member.full_name || member.email} Beta`).trim();
    if (!orgName || !window.confirm(`Create a clean organisation named "${orgName}" and move ${member.email || member.full_name} into it as Org Admin? They will no longer see the current organisation after signing in again.`)) return;
    setBusy(true); setMsg("");
    try {
      await base44.functions.invoke("manageOrganisation", {
        action: "create_org_and_move_user", user_id: member.user_id,
        name: orgName, app_role: "organisation_admin",
      });
      setMsg(`Created "${orgName}" and moved ${member.email || member.full_name}. Ask them to sign out and back in.`);
      setCleanOrgName((v) => ({ ...v, [member.user_id]: "" }));
      await load();
    } catch (err) { setMsg(err.message || "Could not create the clean organisation."); }
    finally { setBusy(false); }
  };

  const inviteToOrg = async (e) => {
    e.preventDefault();
    if (!inviteOrgId || !inviteEmail.trim()) return;
    setBusy(true); setMsg("");
    try {
      const res = await base44.functions.invoke("inviteTeamMember", {
        email: inviteEmail.trim(),
        app_role: inviteRole,
        full_name: inviteName.trim(),
        organisation_id: inviteOrgId,
      });
      const data = res.data || res;
      const orgName = orgs.find((o) => o.id === inviteOrgId)?.name || "that organisation";
      setMsg(`Invitation sent to ${inviteEmail.trim()} for ${orgName} as ${ROLE_LABELS[inviteRole] || inviteRole}.`);
      setInviteEmail(""); setInviteName("");
      await load();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Could not send invitation.";
      setMsg(msg);
    } finally { setBusy(false); }
  };

  const changeRole = async (userId) => {
    const newRole = roleTarget[userId];
    if (!newRole) return;
    setBusy(true); setMsg("");
    try {
      await base44.functions.invoke("manageOrganisation", { action: "change_role", user_id: userId, app_role: newRole });
      setMsg(`Role updated. They must log out and back in for the change to take effect.`);
      setRoleTarget((r) => ({ ...r, [userId]: "" }));
      await load();
    } catch (err) { setMsg(err.message || "Could not change role."); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Organisation admin</h1>
        <p className="text-slate-500 mt-2">
          {isPlatformOwner
            ? "Platform-owner only. Create organisations, move users between tenants, and manage roles."
            : "Change user roles within your organisation. Promote someone to Org Admin to let them connect API keys."}
        </p>
      </div>

      {msg && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">{msg}</div>}

      {isPlatformOwner && (
        <form onSubmit={createOrg} className="rounded-3xl bg-white border border-slate-200 p-6 flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="orgName">New organisation name</Label>
            <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cadence Isolation Test B" />
          </div>
          <Button type="submit" disabled={busy} className="rounded-full h-10">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />} Create
          </Button>
        </form>
      )}

      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-display text-lg font-semibold text-slate-900">Users</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Promote to Org Admin to let them connect API keys in Settings.
          </p>
        </div>
        {loading ? (
          <p className="px-6 py-8 text-slate-400 text-sm">Loading…</p>
        ) : (
          users.map((u) => (
            <div key={u.user_id} className="px-6 py-4 border-b border-slate-50 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium text-slate-900 text-sm">{u.full_name || u.email || u.user_id}</p>
                <p className="text-xs text-slate-400">
                  {u.email || "—"} ·{" "}
                  <span className="font-medium text-slate-600">{ROLE_LABELS[u.app_role] || u.app_role}</span>
                  {isPlatformOwner && ` · ${orgs.find((o) => o.id === u.organisation_id)?.name || "—"}`}
                </p>
              </div>

              {isPlatformOwner && u.app_role !== "platform_owner" && (
                <div className="flex items-center gap-2">
                  <Input
                    value={cleanOrgName[u.user_id] || ""}
                    onChange={(e) => setCleanOrgName((v) => ({ ...v, [u.user_id]: e.target.value }))}
                    placeholder={`${u.full_name || "Customer"} Beta`}
                    className="h-9 w-44"
                    aria-label="Clean organisation name"
                  />
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => createCleanOrganisation(u)} className="rounded-full border-amber-300 text-amber-800">
                    <Building2 className="w-4 h-4 mr-2" /> New clean org
                  </Button>
                </div>
              )}

              {/* Role change dropdown — available to both platform owner and org admin */}
              {u.app_role !== "platform_owner" && (
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-slate-300" />
                  <select
                    value={roleTarget[u.user_id] || ""}
                    onChange={(e) => setRoleTarget((r) => ({ ...r, [u.user_id]: e.target.value }))}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Change role…</option>
                    {CHANGEABLE_ROLES.map((r) => (
                      <option key={r} value={r} disabled={r === u.app_role}>
                        {r === u.app_role ? `${ROLE_LABELS[r]} (current)` : ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" disabled={busy || !roleTarget[u.user_id]} onClick={() => changeRole(u.user_id)} className="rounded-full">
                    Apply
                  </Button>
                </div>
              )}

              {/* Move between orgs — platform owner only */}
              {isPlatformOwner && u.app_role !== "platform_owner" && (
                <>
                  <select
                    value={moveTarget[u.user_id] || ""}
                    onChange={(e) => setMoveTarget((m) => ({ ...m, [u.user_id]: e.target.value }))}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Move to…</option>
                    {orgs.filter((o) => o.id !== u.organisation_id).map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" disabled={busy || !moveTarget[u.user_id]} onClick={() => moveUser(u.user_id)} className="rounded-full">
                    <ArrowRightLeft className="w-4 h-4 mr-2" /> Move
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {isPlatformOwner && (
        <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">Organisations</h2>
            <ul className="mt-3 text-sm text-slate-600 space-y-1">
              {orgs.map((o) => <li key={o.id}><span className="font-medium text-slate-900">{o.name}</span> · {o.slug} · {o.status}</li>)}
            </ul>
          </div>

          <form onSubmit={inviteToOrg} className="border-t border-slate-100 pt-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <UserPlus className="w-4 h-4 text-emerald-600" /> Invite a user into an organisation
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-org">Target organisation</Label>
                <select
                  id="invite-org"
                  value={inviteOrgId}
                  onChange={(e) => setInviteOrgId(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  required
                >
                  <option value="">Select organisation…</option>
                  {orgs.filter((o) => o.status === "active").map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="organisation_admin">Org Admin</option>
                  <option value="sales_manager">Sales Manager</option>
                  <option value="bdm">BDM</option>
                  <option value="reporting_user">Reporting</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Full name</Label>
                <Input id="invite-name" placeholder="Jordan Lee" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" placeholder="teammate@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="h-10" required />
              </div>
            </div>
            <Button type="submit" disabled={busy || !inviteOrgId} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Send invitation
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}