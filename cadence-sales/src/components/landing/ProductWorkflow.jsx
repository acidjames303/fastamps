import React from "react";
import { ListOrdered, Building2, Phone, ArrowRight, ListChecks } from "lucide-react";

const STAGES = [
  {
    key: "choose",
    tag: "Stage 1 — Choose",
    title: "Know who deserves the next call.",
    body: "Rank and organise prospecting lists so the strongest opportunities remain visible.",
    icon: ListOrdered,
    panel: (
      <div className="space-y-2">
        {[
          { c: "Northwind Analytics", f: 86, top: true },
          { c: "Brightpath Logistics", f: 81 },
          { c: "Cedar & Co. Consulting", f: 74 },
        ].map((r) => (
          <div key={r.c} className="flex items-center gap-2 rounded-lg bg-muted border border-border px-3 py-2">
            <span className="text-xs text-muted-foreground truncate flex-1">{r.c}</span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${r.top ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}>
              {r.f}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "understand",
    tag: "Stage 2 — Understand",
    title: "Know the company before you dial.",
    body: "See what the company does, who it serves and why it may fit the campaign.",
    icon: Building2,
    panel: (
      <div className="space-y-2">
        <div className="rounded-lg bg-muted border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">Northwind Analytics</p>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">FP&amp;M software · 180 staff · Manchester</p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-0.5">Why it fits</p>
          <p className="text-xs text-muted-foreground">Targets manufacturers with 100–500 staff.</p>
        </div>
      </div>
    ),
  },
  {
    key: "call",
    tag: "Stage 3 — Call",
    title: "Enter the conversation ready.",
    body: "Call through the organisation's connected provider and record what genuinely happened.",
    icon: Phone,
    panel: (
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-muted border border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">Gary Collin</span>
          <span className="text-[11px] text-muted-foreground/80">Direct line</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
            <Phone className="w-3 h-3" /> Calling…
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "continue",
    tag: "Stage 4 — Continue",
    title: "Never lose the next step.",
    body: "Save notes, create the follow-up and move directly to the next prospect.",
    icon: ListChecks,
    panel: (
      <div className="space-y-2">
        <div className="rounded-lg bg-muted border border-border px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Outcome</p>
          <p className="text-xs text-foreground">Callback requested</p>
        </div>
        <div className="rounded-lg bg-muted border border-border px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Follow-up</p>
          <p className="text-xs text-foreground">Tomorrow, 09:30</p>
        </div>
      </div>
    ),
  },
];

export default function ProductWorkflow() {
  return (
    <section id="how" className="bg-card py-20 sm:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(16,185,129,0.10),transparent_70%)]" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Everything around the call, in one place.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Four stages, one focused caller — from choosing who deserves the dial to saving the next step.
          </p>
        </div>

        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-4 lg:gap-4">
          {STAGES.map((s, i) => (
            <div key={s.key} className="relative">
              <div className="rounded-2xl border border-border bg-background/60 p-6 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <s.icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.tag}</span>
                </div>
                <h3 className="font-semibold text-foreground text-lg leading-snug">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>

                <div className="mt-5 p-3 rounded-xl bg-muted/50 border border-border">
                  {s.panel}
                </div>
              </div>

              {i < STAGES.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 items-center justify-center w-6 h-6 rounded-full bg-secondary border border-border">
                  <ArrowRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">Sample data shown for illustration.</p>
      </div>
    </section>
  );
}