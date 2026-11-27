import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DictateButton from "@/components/dialer/DictateButton";
import { BookmarkPlus, Check, Loader2, Trash2 } from "lucide-react";

const EXAMPLE =
  "For each account, record the source link, the supplier, the contract scope, award and end dates, and the one question worth asking first. Keep published findings separate from anything the customer confirms.";

// The instruction every account is researched against, plus the saved briefs the
// team can reuse across campaigns.
export default function ResearchInstructionCard({
  value,
  onChange,
  briefs = [],
  onSave,
  onLoad,
  onDelete,
  disabled,
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value.trim() || !name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave?.(name.trim());
      setName("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="research-instruction" className="text-xs uppercase tracking-widest text-slate-400">
          What should we find out about every account?
        </label>
        <Textarea
          id="research-instruction"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={EXAMPLE}
          rows={4}
          disabled={disabled}
          className="mt-1 rounded-xl text-sm"
        />
      </div>

      <DictateButton value={value} onChange={onChange} label="Dictate instruction" prominent />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name this brief, e.g. Telecare contract review"
          disabled={disabled || !value.trim()}
          className="min-w-56 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
        />
        <Button
          type="button"
          variant="outline"
          onClick={save}
          disabled={disabled || saving || !name.trim() || !value.trim()}
          className="rounded-full border-emerald-300 text-emerald-700"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookmarkPlus className="w-4 h-4 mr-2" />}
          Save brief
        </Button>
      </div>

      {briefs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">Saved briefs</p>
          <div className="flex flex-wrap gap-1.5">
            {briefs.map((brief) => (
              <span
                key={brief.id}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white pl-3 pr-1 py-1 text-xs text-slate-600"
              >
                <button
                  type="button"
                  onClick={() => onLoad?.(brief)}
                  disabled={disabled}
                  className="max-w-56 truncate hover:text-emerald-700 disabled:opacity-50"
                  title={brief.instruction}
                >
                  {brief.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(brief)}
                  disabled={disabled}
                  aria-label={`Delete ${brief.name}`}
                  className="grid h-5 w-5 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" /> Reuse on any campaign or Outreach draft batch — findings stay
            separate per instruction.
          </p>
        </div>
      )}
    </div>
  );
}