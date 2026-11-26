import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookmarkPlus, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import DictateButton from "@/components/dialer/DictateButton";
import { ENRICHMENT_PILLS, PROVIDER_PILLS } from "@/lib/campaignBuilder";

const labelFor = (list, key) => list.find((item) => item.key === key)?.label || key;

// The last stop before anything runs: read the brief, the profile and the
// research instruction, edit them, save them as a template, then act.
export default function BuilderReview({
  draft,
  onChange,
  templates = [],
  onLoadTemplate,
  onSaveTemplate,
  savingTemplate = false,
  children,
}) {
  const [advanced, setAdvanced] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const set = (patch) => onChange({ ...draft, ...patch });
  const answers = draft.answers || {};

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-slate-900">Review the brief</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            This is what Cadence works from. Edit anything before you find accounts or save it to the campaign.
          </p>
        </div>
        {templates.length > 0 && (
          <label className="text-xs text-slate-500">
            Start from a template
            <select
              value={draft.template_id || ""}
              onChange={(event) => onLoadTemplate?.(event.target.value)}
              className="mt-1 block w-full min-w-56 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Choose a template…</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="review-brief" className="text-xs uppercase tracking-widest text-slate-400">
          Campaign brief
        </label>
        <Textarea
          id="review-brief"
          value={draft.brief}
          onChange={(event) => set({ brief: event.target.value })}
          rows={8}
          className="rounded-xl text-sm"
        />
        <DictateButton value={draft.brief} onChange={(value) => set({ brief: value })} label="Dictate the brief" />
      </div>

      <div className="space-y-2">
        <label htmlFor="review-icp" className="text-xs uppercase tracking-widest text-slate-400">
          Ideal customer profile
        </label>
        <Textarea
          id="review-icp"
          value={draft.icp}
          onChange={(event) => set({ icp: event.target.value })}
          rows={3}
          className="rounded-xl text-sm"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="review-instruction" className="text-xs uppercase tracking-widest text-slate-400">
          Research instruction
        </label>
        <Textarea
          id="review-instruction"
          value={draft.instruction}
          onChange={(event) => set({ instruction: event.target.value })}
          rows={5}
          className="rounded-xl text-sm"
        />
        <DictateButton value={draft.instruction} onChange={(value) => set({ instruction: value })} label="Dictate the instruction" />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setAdvanced((current) => !current)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
          aria-expanded={advanced}
        >
          <span>
            <span className="block text-sm font-semibold text-slate-900">Advanced</span>
            <span className="block text-xs text-slate-500">Enrichment fields and provider priority</span>
          </span>
          {advanced ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </button>
        {advanced && (
          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fill in when enriching</p>
              <p className="mt-1 text-slate-700">
                {(answers.enrichment || []).length
                  ? answers.enrichment.map((key) => labelFor(ENRICHMENT_PILLS, key)).join(", ")
                  : "Nothing selected — you will choose at enrichment time."}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Provider priority</p>
              <p className="mt-1 text-slate-700">
                {(answers.provider_order || []).length
                  ? answers.provider_order.map((key) => labelFor(PROVIDER_PILLS, key)).join(" → ")
                  : "Organisation default"}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Change these in the guided builder. Only providers connected in Settings are ever called.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
        <label className="min-w-0 flex-1 text-xs text-slate-500">
          Save as a template
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="e.g. Tunstall-style contract research"
            className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          />
        </label>
        <Button
          variant="outline"
          disabled={savingTemplate || !templateName.trim()}
          onClick={async () => {
            await onSaveTemplate?.(templateName.trim());
            setTemplateName("");
          }}
          className="rounded-full border-slate-300"
        >
          {savingTemplate ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-1 h-4 w-4" />}
          Save template
        </Button>
      </div>

      {children}
    </div>
  );
}