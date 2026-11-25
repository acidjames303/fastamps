import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldCheck, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// Platform-owner tenant isolation audit report.
// Shows every active user's assignment status and flags mismatches between
// User and UserProfile (organisation ID, role, duplicate profiles).
// Does NOT auto-repair ambiguous assignments.
export default function TenantIsolationReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const res = await base44.functions.invoke("tenantConsistencyAudit", {});
      setData(res.data || res);
    } catch (e) { setErr(e.message || "Could not load audit report."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const exportCSV = () => {
    if (!data?.users) return;
    const headers = ["User ID", "Email", "Name", "User role", "Organisation ID", "Assignment status", "Profile count", "Active profiles", "Profile role", "Last verified", "Issues"];
    const rows = data.users.map((u) => [
      u.user_id, u.email, u.full_name, u.user_role, u.organisation_id,
      u.assignment_status, u.profile_count, u.active_profile_count, u.profile_role,
      u.last_verified, u.issues,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tenant-isolation-audit.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;

  const statusStyle = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    no_profile: "bg-rose-50 text-rose-700 border-rose-200",
    multiple_profiles: "bg-amber-50 text-amber-700 border-amber-200",
    role_mismatch: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">Tenant Isolation Audit</h1>
          <p className="text-slate-500 mt-1.5">User/profile consistency and organisation assignment verification.</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="rounded-full border-slate-300">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total users</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{data?.total_users ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total profiles</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{data?.total_profiles ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Mismatches</p>
          <p className={`text-2xl font-semibold mt-1 ${(data?.users_with_mismatches ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>{data?.users_with_mismatches ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Overall health</p>
          <div className="flex items-center gap-1.5 mt-1">
            {data?.summary?.healthy ? (
              <><ShieldCheck className="w-5 h-5 text-emerald-600" /><span className="text-lg font-semibold text-emerald-600">Healthy</span></>
            ) : (
              <><AlertTriangle className="w-5 h-5 text-amber-600" /><span className="text-lg font-semibold text-amber-600">Needs attention</span></>
            )}
          </div>
        </div>
      </div>

      {/* Missing organisation_id report */}
      {data?.missing_organisation_id && Object.keys(data.missing_organisation_id).length > 0 && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4">
          <h3 className="font-medium text-rose-900">Records missing organisation_id</h3>
          <p className="text-sm text-rose-700 mt-1">These records may be accessible across tenant boundaries.</p>
          <div className="mt-2 space-y-1">
            {Object.entries(data.missing_organisation_id).map(([entity, info]) => (
              <p key={entity} className="text-sm text-rose-700">
                <span className="font-medium">{entity}</span>: {info.count} record(s) missing organisation_id
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Cross-tenant note */}
      {data?.cross_tenant_note && (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-800">{data.cross_tenant_note}</p>
        </div>
      )}

      {/* User table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 text-xs uppercase tracking-widest text-slate-400">
          <span className="col-span-3">User</span>
          <span className="col-span-2">Organisation</span>
          <span className="col-span-2">Role</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-3">Issues</span>
        </div>
        {data?.users?.map((u) => (
          <div key={u.user_id} className="grid grid-cols-12 gap-3 px-5 py-3 border-t border-slate-100 text-sm items-start">
            <div className="col-span-3">
              <p className="font-medium text-slate-900">{u.full_name || u.email}</p>
              <p className="text-xs text-slate-400">{u.email}</p>
            </div>
            <span className="col-span-2 text-xs text-slate-600 font-mono">{u.organisation_id?.slice(0, 12) || "—"}</span>
            <span className="col-span-2 text-xs text-slate-600">{u.user_role || "—"}</span>
            <span className="col-span-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusStyle[u.assignment_status] || statusStyle.ok}`}>
                {u.assignment_status.replace(/_/g, " ")}
              </span>
            </span>
            <span className="col-span-3 text-xs text-slate-500">{u.issues || "—"}</span>
          </div>
        ))}
      </div>

      <Button onClick={load} variant="outline" className="rounded-full border-slate-300">
        <Loader2 className="w-4 h-4 mr-2" /> Re-run audit
      </Button>
    </div>
  );
}