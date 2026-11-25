import React from "react";
import { Phone, ArrowRight, Building2, User2, CheckCircle2, Clock } from "lucide-react";

// Original "next call" workspace composition for the hero. All data is fictional sample data.
export default function NextCallMock() {
  return (
    <div className="relative">
      {/* Workflow ribbon */}
      <div className="hidden sm:flex items-center justify-center gap-2 mb-4 text-[11px] font-medium text-muted-foreground">
        {["Brief", "Call", "Outcome", "Follow-up"].map((s, i, arr) => (
          <React.Fragment key={s}>
            <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-foreground">{s}</span>
            {i < arr.length - 1 && (
              <span className="w-6 h-px bg-gradient-to-r from-emerald-500/60 to-emerald-500/20" aria-hidden="true" />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card backdrop-blur shadow-2xl shadow-black/20 overflow-hidden">
        {/* window chrome */}
        <div className="flex items-center gap-2 px-4 h-9 border-b border-border bg-muted/60">
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
          <span className="ml-2 text-[11px] text-muted-foreground">cadence · next call</span>
          <span className="ml-auto text-[10px] text-muted-foreground/70">Sample data</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Company + fit */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">Northwind Analytics</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                FP&amp;M software for mid-market manufacturers. 180 staff, Manchester.
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
              Fit 86
            </span>
          </div>

          {/* Why it fits */}
          <div className="rounded-xl bg-muted/50 border border-border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Why it fits</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Targets manufacturers with 100–500 staff and runs recurring finance reviews — a strong
              match for the campaign profile.
            </p>
          </div>

          {/* Decision maker */}
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <User2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">Gary Collin</p>
              <p className="text-xs text-muted-foreground truncate">Head of Finance · direct line confirmed</p>
            </div>
          </div>

          {/* Previous outcome + follow-up */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 border border-border p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <CheckCircle2 className="w-3 h-3" /> Previous outcome
              </div>
              <p className="text-sm text-foreground">Callback requested</p>
            </div>
            <div className="rounded-xl bg-muted/50 border border-border p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <Clock className="w-3 h-3" /> Follow-up
              </div>
              <p className="text-sm text-foreground">Due today, 14:30</p>
            </div>
          </div>

          {/* Next-call action */}
          <button
            type="button"
            tabIndex={-1}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg shadow-emerald-900/30"
          >
            <Phone className="w-4 h-4" />
            Call Gary now
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}