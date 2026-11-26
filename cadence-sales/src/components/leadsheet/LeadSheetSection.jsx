import React from "react";
import LeadSheetField from "@/components/leadsheet/LeadSheetField";

// One numbered section of the seven-section lead sheet. With the missing-only
// filter on, filled fields are hidden so the caller sees only what is left.
export default function LeadSheetSection({ section, form, onChange, disabled, missingOnly, missing }) {
  const fields = missingOnly ? section.fields.filter((field) => missing.includes(field.key)) : section.fields;
  if (!fields.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 text-xs font-semibold flex items-center justify-center">
          {section.number}
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            <LeadSheetField
              field={field}
              value={form[field.key] || ""}
              onChange={(value) => onChange(field.key, value)}
              disabled={disabled}
              missing={missing.includes(field.key)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}