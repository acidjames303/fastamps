import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2, CheckCircle2, ListChecks } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { resolveCompanyIds } from "@/lib/company";
import { assignCompaniesToList, fetchTargetLists } from "@/lib/targetLists";

const schema = {
  type: "object",
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          job_title: { type: "string" },
          company: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          website: { type: "string" },
          industry: { type: "string" },
          employee_range: { type: "string" },
          location: { type: "string" },
        },
      },
    },
  },
};

export default function Import({ embedded = false }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [targetLists, setTargetLists] = useState([]);
  const [targetListId, setTargetListId] = useState("");
  const { user } = useAuth();

  useEffect(() => { fetchTargetLists().then(setTargetLists).catch(() => {}); }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setResult(null);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setStatus("reading");
    const res = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: schema });
    const records = (res.output?.records || res.output || []).filter((r) => r.full_name && r.phone);
    setStatus("saving");
    const getCompanyId = await resolveCompanyIds(
      records.map((r) => ({
        name: r.company,
        industry: r.industry, website: r.website, location: r.location,
        employee_range: r.employee_range, owner_user_id: user.id, organisation_id: user.organisation_id,
      }))
    );
    const importedCompanyIds = records.map((r) => getCompanyId(r.company, r.website)).filter(Boolean);
    for (let i = 0; i < records.length; i += 200) {
      await base44.entities.Contact.bulkCreate(
        records.slice(i, i + 200).map((r) => ({
          ...r,
          source: file.name,
          number_status: "untested",
          organisation_id: user.organisation_id,
          owner_user_id: user.id,
          company_id: getCompanyId(r.company, r.website) || undefined,
        }))
      );
    }
    let addedToList = 0;
    if (targetListId && importedCompanyIds.length) {
      const res = await assignCompaniesToList(targetListId, importedCompanyIds, user.organisation_id, user.id);
      addedToList = res.added;
    }
    setResult({
      contacts: records.length,
      companiesCreated: getCompanyId.stats.created,
      companiesReused: getCompanyId.stats.reused,
      review: getCompanyId.stats.review,
      addedToList,
      targetListName: targetLists.find((l) => l.id === targetListId)?.name || "",
    });
    setStatus("done");
  };

  return (
    <div className={`${embedded ? "" : "max-w-2xl"} space-y-6`}>
      <div>
        {!embedded && (
          <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Import</h1>
        )}
        <p className={`text-slate-500 ${embedded ? "text-sm" : "mt-2"}`}>
          Drop in an Excel or CSV export and link companies to a campaign so they’re ready to dial.
        </p>
      </div>

      <label className="block rounded-3xl bg-white border-2 border-dashed border-slate-200 p-12 text-center cursor-pointer hover:border-slate-300 transition-colors">
        <input type="file" accept=".csv,.xlsx,.json" onChange={handleFile} className="hidden" />
        {status === "idle" || status === "done" ? (
          <>
            <UploadCloud className="w-8 h-8 mx-auto text-slate-400" />
            <p className="mt-4 font-medium text-slate-900">Choose a spreadsheet</p>
            <p className="text-sm text-slate-400 mt-1">Excel (.xlsx), CSV or JSON</p>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
            <p className="mt-4 text-slate-600 capitalize">{status}…</p>
          </>
        )}
      </label>

      {status === "done" && result && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-2 text-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-medium">{result.contacts} contacts added.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-emerald-700 pl-8">
            <p>Companies created: <span className="font-medium">{result.companiesCreated}</span></p>
            <p>Companies reused: <span className="font-medium">{result.companiesReused}</span></p>
          </div>
          {result.review.length > 0 && (
            <p className="text-xs text-amber-700 pl-8">{result.review.length} row(s) flagged for review — possible name matches with a different domain.</p>
          )}
          {result.addedToList > 0 && (
            <p className="text-xs text-emerald-700 pl-8">{result.addedToList} compan{result.addedToList === 1 ? "y" : "ies"} linked to {result.targetListName}.</p>
          )}
        </div>
      )}

      <div className="rounded-3xl bg-white border border-slate-200 p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <ListChecks className="w-4 h-4 text-slate-400" /> Assign to target list
        </div>
        <p className="text-sm text-slate-500 mt-1 mb-3">Optionally link every imported company to a target list so they're ready to dial.</p>
        <select
          value={targetListId}
          onChange={(e) => setTargetListId(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 max-w-xs"
        >
          <option value="">Don't assign</option>
          {targetLists.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {!embedded && (
        <div className="rounded-3xl bg-white border border-slate-200 p-7">
          <h2 className="font-display text-lg font-semibold text-slate-900">Enrichment providers</h2>
          <p className="text-sm text-slate-500 mt-2">
            Connect Apollo, Lusha or FullEnrich under Workspace → Connections so profiles fill automatically.
          </p>
          <Link to="/settings">
            <Button variant="outline" className="rounded-full mt-4 border-slate-300">Open workspace settings</Button>
          </Link>
        </div>
      )}
    </div>
  );
}