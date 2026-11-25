import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, LockKeyhole, CreditCard, LifeBuoy, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

async function allRows(entity, sort = "-created_date") {
  const rows = [];
  const pageSize = 500;
  for (let skip = 0; skip < 100000; skip += pageSize) {
    const page = await entity.list(sort, pageSize, skip);
    rows.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }
  return rows;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TrialExpired() {
  const { workspaceAccess } = useAuth();
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");

  const exportData = async (type) => {
    setExporting(type);
    setError("");
    try {
      const date = new Date().toISOString().slice(0, 10);
      if (type === "contacts") {
        const rows = await allRows(base44.entities.Contact, "-updated_date");
        downloadCsv(`cadence-contacts-${date}.csv`,
          ["Name","Title","Company","Phone","Email","Industry","Location","Notes","Last called"],
          rows.map(c => [c.full_name,c.job_title,c.company,c.phone,c.email,c.industry,c.location,c.notes,c.last_called]));
      } else if (type === "calls") {
        const rows = await allRows(base44.entities.CallLog);
        downloadCsv(`cadence-calls-${date}.csv`,
          ["Date","Contact","Company","Outcome","Conversation","Notes","Follow-up"],
          rows.map(c => [c.created_date,c.contact_name,c.company,c.primary_outcome || c.outcome,c.conversation_held === true ? "Yes" : "No",c.notes,c.follow_up_date]));
      } else {
        const rows = await allRows(base44.entities.Company);
        downloadCsv(`cadence-companies-${date}.csv`,
          ["Company","Website","Industry","Location","Employees","Last contacted"],
          rows.map(c => [c.name,c.website,c.industry,c.location,c.employee_range,c.last_contacted]));
      }
    } catch (e) {
      setError(e.message || "Export failed. Contact support and your data will remain preserved.");
    } finally {
      setExporting("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-3xl border border-amber-200 bg-white p-8">
        <LockKeyhole className="w-9 h-9 text-amber-600" />
        <h1 className="font-display text-3xl font-semibold text-slate-900 mt-4">Your Cadence trial has ended</h1>
        <p className="text-slate-600 mt-2">Your workspace is safely preserved in read-only mode. No records have been deleted and you can export your data at any time.</p>
        {workspaceAccess?.trial_end && <p className="text-sm text-slate-400 mt-2">Trial ended {new Date(workspaceAccess.trial_end).toLocaleDateString("en-GB")}.</p>}
        <div className="flex flex-wrap gap-2 mt-6">
          {workspaceAccess?.can_manage_billing && <Link to="/usage-billing"><Button className="rounded-full"><CreditCard className="w-4 h-4 mr-2" /> View usage</Button></Link>}
          <Link to="/support"><Button variant="outline" className="rounded-full"><LifeBuoy className="w-4 h-4 mr-2" /> Contact support</Button></Link>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-xl font-semibold text-slate-900">Export your data</h2>
        <p className="text-sm text-slate-500 mt-1">Exports do not consume Smart Actions or provider credits.</p>
        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          {["contacts","companies","calls"].map(type => (
            <Button key={type} variant="outline" className="rounded-xl h-12 capitalize" disabled={Boolean(exporting)} onClick={() => exportData(type)}>
              {exporting === type ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {type}
            </Button>
          ))}
        </div>
        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}