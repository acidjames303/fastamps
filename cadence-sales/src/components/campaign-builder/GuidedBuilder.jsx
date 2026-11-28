import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Check, SkipForward } from "lucide-react";
import PillSelect from "@/components/campaign-builder/PillSelect";
import DictateButton from "@/components/dialer/DictateButton";
import { BUILDER_STEPS, followUpSteps } from "@/lib/campaignBuilder";

const hasValue = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(String(value || "").trim()));

// One question at a time: pills for the choices, a box with the microphone for
// anything that needs words. Follow-ups only appear when the answers so far
// make them worth asking.
export default function GuidedBuilder({ answers, setAnswers, onFinish, onSwitchToWrite }) {
  const steps = useMemo(() => [...BUILDER_STEPS, ...followUpSteps(answers)], [answers]);
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex];
  const value = answers[step.key];
  const isLast = safeIndex === steps.length - 1;
  const answered = steps.filter((item) => hasValue(answers[item.key])).length;

  const set = (next) => setAnswers({ ...answers, [step.key]: next });
  const go = (direction) => setIndex(Math.min(steps.length - 1, Math.max(0, safeIndex + direction)));

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Step {safeIndex + 1} of {steps.length}
            <span className="text-slate-400"> · {answered} answered</span>
          </span>
          <button
            type="button"
            onClick={onSwitchToWrite}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
          >
            Prefer to type it all? Write it instead
          </button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${Math.round(((safeIndex + (isLast ? 1 : 0)) / steps.length) * 100)}%` }}
          />
        </div>
      </div>

      <div>
        <h3 className="font-display text-xl font-semibold text-slate-900">{step.title}</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl">{step.help}</p>
      </div>

      {step.kind === "text" ? (
        <div className="space-y-2">
          <Textarea
            value={value || ""}
            onChange={(event) => set(event.target.value)}
            placeholder={step.placeholder}
            rows={4}
            className="rounded-xl text-sm"
          />
          <DictateButton value={value || ""} onChange={set} label="Dictate this answer" />
        </div>
      ) : (
        <PillSelect
          options={step.options}
          value={value}
          onChange={set}
          multi={step.kind === "multi"}
          ordered={!!step.ordered}
          customLabel={step.customLabel}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Button
          variant="ghost"
          onClick={() => go(-1)}
          disabled={safeIndex === 0}
          className="rounded-full text-slate-600"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button
          variant="ghost"
          onClick={() => go(1)}
          disabled={isLast}
          className="rounded-full text-slate-500"
          title="Leave this one for now"
        >
          <SkipForward className="mr-1 h-4 w-4" /> Skip
        </Button>
        <span className="ml-auto" />
        {isLast ? (
          <Button onClick={onFinish} className="rounded-full bg-emerald-600 hover:bg-emerald-500">
            <Check className="mr-1 h-4 w-4" /> Review the brief
          </Button>
        ) : (
          <Button onClick={() => go(1)} className="rounded-full bg-slate-900 hover:bg-slate-800">
            Continue <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}