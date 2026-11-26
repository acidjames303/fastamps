import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import DictateButton from "@/components/dialer/DictateButton";

// One lead sheet field. Empty fields are outlined so a caller can see exactly
// what still needs an answer; dictation is offered on the narrative fields.
export default function LeadSheetField({ field, value, onChange, disabled, missing }) {
  const box = `rounded-xl border bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
    missing ? "border-amber-300" : "border-slate-200"
  }`;
  const inputType = field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className={`text-[11px] font-medium uppercase tracking-wide ${missing ? "text-amber-700" : "text-slate-500"}`}>
          {field.label}
        </label>
        {field.dictation && !disabled && (
          <DictateButton value={value} onChange={onChange} label="Dictate" />
        )}
      </div>
      {field.type === "textarea" ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={3}
          className={box}
        />
      ) : (
        <Input
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={box}
        />
      )}
    </div>
  );
}