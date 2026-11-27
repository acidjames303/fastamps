import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  OUTREACH_INSTRUCTION_PRESETS,
  briefInstructionText,
  sortResearchBriefs,
} from "@/lib/researchBriefReuse";

/**
 * Reuse ResearchBriefs saved in Campaign research on Outreach (and elsewhere).
 * Same entity store — no second template model.
 */
export default function SavedResearchBriefPills({
  value = "",
  onSelect,
  disabled = false,
  showPresets = true,
  className = "",
}) {
  const [briefs, setBriefs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    base44.entities.ResearchBrief
      .list("-created_date", 50)
      .then((rows) => {
        if (!cancelled) setBriefs(sortResearchBriefs(rows || []));
      })
      .catch(() => {
        if (!cancelled) setBriefs([]);
      });
    return () => { cancelled = true; };
  }, []);

  const apply = async (text, brief = null) => {
    const next = briefInstructionText({ instruction: text });
    if (!next || disabled) return;
    onSelect?.(next);
    if (brief?.id) {
      await base44.entities.ResearchBrief
        .update(brief.id, {
          use_count: (brief.use_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .catch(() => {});
      setBriefs((items) =>
        sortResearchBriefs(
          items.map((item) =>
            item.id === brief.id
              ? { ...item, use_count: (item.use_count || 0) + 1, last_used_at: new Date().toISOString() }
              : item,
          ),
        ),
      );
    }
  };

  const pill = (active) =>
    `rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
      active
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
    }`;

  if (!showPresets && !briefs.length) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {showPresets && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">Quick angles</p>
          <div className="flex flex-wrap gap-1.5">
            {OUTREACH_INSTRUCTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                title={preset.text}
                onClick={() => apply(preset.text)}
                className={pill(value.trim() === preset.text.trim())}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {briefs.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">
            Saved research briefs
          </p>
          <div className="flex flex-wrap gap-1.5">
            {briefs.map((brief) => {
              const text = briefInstructionText(brief);
              if (!text) return null;
              return (
                <button
                  key={brief.id}
                  type="button"
                  disabled={disabled}
                  title={text}
                  onClick={() => apply(text, brief)}
                  className={pill(value.trim() === text)}
                >
                  {brief.name || "Untitled brief"}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Same briefs as Campaign research — pick one instead of re-dictating.
          </p>
        </div>
      )}
    </div>
  );
}
