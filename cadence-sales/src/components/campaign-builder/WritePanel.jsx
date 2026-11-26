import React from "react";
import { Textarea } from "@/components/ui/textarea";
import DictateButton from "@/components/dialer/DictateButton";

// Typing and talking are the same box: the microphone fills the field the
// cursor is in, so someone can dictate the brief and edit it by hand after.
export default function WritePanel({ draft, onChange, dictateFirst = false }) {
  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
      <div>
        <h3 className="font-display text-xl font-semibold text-slate-900">
          {dictateFirst ? "Talk the campaign through" : "Write the campaign out"}
        </h3>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl">
          {dictateFirst
            ? "Press the microphone and describe what you sell, who you want to reach and where. Edit anything the transcript gets wrong."
            : "Write the brief in your own words. The ideal customer profile and the research instruction below are what the agent works from."}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="builder-brief" className="text-xs uppercase tracking-widest text-slate-400">
          Campaign brief
        </label>
        <Textarea
          id="builder-brief"
          value={draft.brief}
          onChange={(event) => set({ brief: event.target.value })}
          rows={dictateFirst ? 8 : 6}
          placeholder="e.g. We sell planned maintenance cover to UK food manufacturers. We want operations and engineering managers at sites with their own production lines."
          className="rounded-xl text-sm"
        />
        <DictateButton value={draft.brief} onChange={(value) => set({ brief: value })} label="Dictate the brief" prominent={dictateFirst} />
      </div>

      <div className="space-y-2">
        <label htmlFor="builder-icp" className="text-xs uppercase tracking-widest text-slate-400">
          Ideal customer profile
        </label>
        <Textarea
          id="builder-icp"
          value={draft.icp}
          onChange={(event) => set({ icp: event.target.value })}
          rows={4}
          placeholder="Company size, industries, geography and the roles worth calling."
          className="rounded-xl text-sm"
        />
        <DictateButton value={draft.icp} onChange={(value) => set({ icp: value })} label="Dictate the profile" />
      </div>

      <div className="space-y-2">
        <label htmlFor="builder-instruction" className="text-xs uppercase tracking-widest text-slate-400">
          Research instruction
        </label>
        <Textarea
          id="builder-instruction"
          value={draft.instruction}
          onChange={(event) => set({ instruction: event.target.value })}
          rows={5}
          placeholder="What should be recorded about each account, from which sources, in what shape — with the source link kept beside every finding."
          className="rounded-xl text-sm"
        />
        <DictateButton value={draft.instruction} onChange={(value) => set({ instruction: value })} label="Dictate the instruction" />
        <p className="text-[11px] text-slate-400">
          Leave the instruction blank to find accounts without researching them.
        </p>
      </div>
    </div>
  );
}