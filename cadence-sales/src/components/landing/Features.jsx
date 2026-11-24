import React from "react";
import { Phone, ShieldCheck, Building2, ListOrdered, Clock, Send } from "lucide-react";

const LARGE = [
  {
    icon: Building2,
    title: "Know the company before you dial.",
    body: "See what the company does, who it serves and why it may fit your campaign before you start the conversation.",
    panel: (
      <div className="mt-5 rounded-xl bg-muted/60 border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Northwind Analytics</span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">Fit 86</span>
        </div>
        <p className="text-[11px] text-muted-foreground/80">FP&amp;M software · 180 staff · Manchester</p>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Why it fits</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Targets manufacturers with 100–500 staff.</p>
        </div>
      </div>
    ),
  },
  {
    icon: Phone,
    title: "Dial your next best call in one tap.",
    body: "Move from briefing to call without switching tools, then continue directly to the next best prospect.",
    panel: (
      <div className="mt-5 rounded-xl bg-muted/60 border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Gary Collin</span>
          <span className="text-[11px] text-muted-foreground/80">Direct line</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
            <Phone className="w-3 h-3" /> Call now
          </span>
          <span className="inline-flex items-center gap-1.5 bg-muted text-muted-foreground text-xs px-3 py-1.5 rounded-lg border border-border">
            Next prospect
          </span>
        </div>
      </div>
    ),
  },
];

const SMALL = [
  { icon: ListOrdered, title: "Never waste a dial.", body: "Rank and organise prospects by fit so your strongest opportunities rise to the top." },
  { icon: ShieldCheck, title: "Call with confidence, compliant by design.", body: "Suppression controls and calling safeguards that support responsible prospecting without slowing you down." },
  { icon: Clock, title: "Never lose the next step.", body: "Save notes, create the follow-up and keep every result and next action in one place." },
  { icon: Send, title: "Hand the winners over without doing the work twice.", body: "Pass qualified opportunities into your connected CRM when they are ready, with outcomes and notes intact." },
];

export default function Features() {
  return (
    <section id="features" className="bg-background py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-5">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">Product</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Built around the complete call cycle.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The caller leads. Cadence supports every step — from choosing the prospect to handing off the opportunity.
          </p>
        </div>

        {/* Two large panels */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {LARGE.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-7 hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">{f.title}</h3>
              </div>
              <p className="mt-3 text-muted-foreground leading-relaxed text-sm">{f.body}</p>
              {f.panel}
            </div>
          ))}
        </div>

        {/* Four supporting panels */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SMALL.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-muted p-6 hover:border-emerald-500/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5 text-[15px] leading-snug">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}