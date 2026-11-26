import React, { useState } from "react";
import { Loader2, Sparkles, ShieldCheck } from "lucide-react";
import DictateButton from "@/components/dialer/DictateButton";

const TONES = ["consultative", "concise", "warm", "direct"];
const INTENTS = [
  { id: "first_touch", label: "First touch" },
  { id: "follow_up", label: "Follow-up" },
];

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

export default function OutreachGroundedGenerate({
  approvedCount,
  selectedCount,
  defaultSignature = "",
  defaultIntent = "first_touch",
  busy = false,
  onGenerate,
}) {
  const [tone, setTone] = useState("consultative");
  const [intent, setIntent] = useState(defaultIntent);
  const [instructions, setInstructions] = useState("");
  const [signature, setSignature] = useState(defaultSignature);
  const [allowGeneric, setAllowGeneric] = useState(false);

  const batch = Math.min(selectedCount || approvedCount || 0, 10);
  const disabled = busy || batch === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">4. Generate evidence-led drafts</h3>
        <p className="text-xs text-slate-500 mt-1">
          Each draft is written from the contact's own reviewed research, with the cited page kept beside it. Ten
          contacts per batch.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Tone</p>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={tone === option}
                onClick={() => setTone(option)}
                disabled={busy}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors disabled:opacity-50 ${
                  tone === option
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Intent</p>
          <div className="flex flex-wrap gap-1.5">
            {INTENTS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={intent === option.id}
                onClick={() => setIntent(option.id)}
                disabled={busy}
                className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                  intent === option.id
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="block text-xs font-medium text-slate-600">
        Campaign instructions for this batch
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder="What matters to this buyer, the angle to lead with, anything to avoid…"
          className={`${input} mt-1`}
        />
      </label>
      <DictateButton value={instructions} onChange={setInstructions} label="Dictate instructions" />

      <label className="block text-xs font-medium text-slate-600">
        Signature
        <textarea
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Name, role, company, contact details"
          className={`${input} mt-1`}
        />
      </label>

      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={allowGeneric}
          onChange={(e) => setAllowGeneric(e.target.checked)}
          className="mt-0.5"
        />
        Allow a generic greeting for contacts with no confirmed first name (otherwise they are skipped for review).
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onGenerate({ tone, intent, instructions, signature, allowGeneric })}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy ? "Writing drafts…" : `Generate ${batch || ""} draft${batch === 1 ? "" : "s"}`}
      </button>

      <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-none" />
        Drafts are held for human review. Nothing is sent, scheduled or auto-approved, and no name, contract or URL is
        ever invented.
      </p>
    </div>
  );
}