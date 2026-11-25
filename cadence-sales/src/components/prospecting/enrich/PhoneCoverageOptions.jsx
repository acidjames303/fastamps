import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

const OPTIONS = [
  {
    key: "best",
    label: "Check the best ICP-matched contact",
    detail: "Always applied. Only the strongest match for this campaign's target roles is looked up.",
    locked: true,
  },
  {
    key: "otherKnown",
    label: "Also find mobiles for other already-known contacts",
    detail:
      "After the best match, keep asking Lusha for mobiles on the other named people Cadence already holds (emails often cover several people). Does not discover new people.",
  },
  {
    key: "discover",
    label: "Discover additional ICP contacts before checking for numbers",
    detail:
      "Runs a separate decision-maker research step first and may use Smart Actions. Newly found people are saved to this prospect list before any number is requested.",
  },
];

// Phone coverage choices. Connected providers reveal numbers for named contacts;
// they are not contact-discovery tools, and the copy here says so plainly.
export default function PhoneCoverageOptions({ value, onChange, showDiscovery = true }) {
  return (
    <div className="space-y-2">
      {OPTIONS.filter((option) => showDiscovery || option.key !== "discover").map((option) => {
        const checked = option.locked ? true : !!value?.[option.key];
        return (
          <label
            key={option.key}
            className={`flex items-start gap-2 rounded-xl border p-3 ${
              checked ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
            } ${option.locked ? "cursor-default" : "cursor-pointer"}`}
          >
            <Checkbox
              checked={checked}
              disabled={option.locked}
              onCheckedChange={(next) => {
                if (option.locked) return;
                onChange({ ...value, [option.key]: next === true });
              }}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                {option.detail}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}