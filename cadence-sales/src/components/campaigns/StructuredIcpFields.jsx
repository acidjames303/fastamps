import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { parseExcludedCompaniesFromSheet, parseExcludedCompanyLines } from "@/lib/companyExclusion";

const FIELDS = [
  ["target_sectors", "Target sectors"],
  ["target_company_types", "Target company types"],
  ["company_sizes", "Company sizes"],
  ["locations", "Locations"],
  ["target_job_titles", "Target job titles"],
  ["departments", "Departments"],
  ["seniority", "Seniority"],
  ["excluded_roles", "Excluded roles"],
  ["excluded_companies", "Excluded companies"],
  ["buying_triggers", "Buying triggers"],
  ["preferred_contact_order", "Preferred contact order"],
];

export default function StructuredIcpFields({ value, onChange }) {
  const fileRef = useRef(null);
  const [excludeMsg, setExcludeMsg] = useState("");
  const [excludeErr, setExcludeErr] = useState("");

  const mergeExcluded = (incoming = []) => {
    const current = value?.excluded_companies || [];
    const merged = parseExcludedCompanyLines([...current, ...incoming].join("\n"));
    onChange({ ...value, excluded_companies: merged });
    setExcludeMsg(`Exclusion list now has ${merged.length} compan${merged.length === 1 ? "y" : "ies"}. Discovery and imports will skip these.`);
  };

  const importExclusionFile = async (file) => {
    setExcludeErr("");
    setExcludeMsg("");
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const names = parseExcludedCompaniesFromSheet(aoa);
      if (!names.length) throw new Error("No company names found in that file.");
      mergeExcluded(names);
    } catch (error) {
      setExcludeErr(error.message || "Could not read that exclusion list.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FIELDS.map(([key, label]) => (
        <label key={key} className="text-sm text-foreground">
          {label}
          {key === "target_job_titles" ? ` (${value[key]?.length || 0})` : ""}
          {key === "excluded_companies" ? ` (${value[key]?.length || 0})` : ""}
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
            rows={key === "target_job_titles" || key === "excluded_companies" ? 7 : 3}
            value={(value[key] || []).join("\n")}
            onChange={(e) => onChange({ ...value, [key]: e.target.value.split("\n") })}
            placeholder={key === "excluded_companies" ? "One company per line — or import a client list below" : "One entry per line"}
          />
          {key === "excluded_companies" && (
            <div className="mt-2 space-y-1">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-full file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-emerald-800"
                onChange={(e) => importExclusionFile(e.target.files?.[0])}
              />
              <p className="text-xs text-muted-foreground">
                Import current clients / do-not-prospect (Excel or CSV). Cadence will not search or add these companies.
              </p>
              {excludeMsg && <p className="text-xs text-emerald-700">{excludeMsg}</p>}
              {excludeErr && <p className="text-xs text-rose-600">{excludeErr}</p>}
            </div>
          )}
        </label>
      ))}
      <label className="text-sm">
        Maximum contacts per company
        <input
          className="mt-1 block w-full rounded-md border border-input bg-background p-2"
          type="number"
          min="1"
          max="10"
          value={value.max_contacts_per_company || 1}
          onChange={(e) => onChange({ ...value, max_contacts_per_company: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
