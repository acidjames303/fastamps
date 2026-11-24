import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Building2, Phone, MessageSquare, NotebookPen, CalendarClock, ArrowRight as ArrowNext, CheckCircle2, ListOrdered } from "lucide-react";

const STEPS = [
  {
    title: "Select the next prospect",
    icon: ListOrdered,
    body: "Your prioritised queue shows who deserves the next call, ranked by fit and recency.",
    render: () => (
      <div className="space-y-2">
        {[
          { c: "Northwind Analytics", t: "Callback · due today", on: true },
          { c: "Brightpath Logistics", t: "New call" },
          { c: "Cedar & Co. Consulting", t: "New call" },
        ].map((r) => (
          <div key={r.c} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${r.on ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted border-border"}`}>
            {r.on && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            <span className="text-xs text-foreground truncate flex-1">{r.c}</span>
            <span className="text-[11px] text-muted-foreground">{r.t}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Read the company briefing",
    icon: Building2,
    body: "Understand what the company does, who it serves and why it fits before you dial.",
    render: () => (
      <div className="space-y-2">
        <div className="rounded-lg bg-muted border border-border px-3 py-2">
          <p className="text-xs text-foreground">Northwind Analytics</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">FP&amp;M software · 180 staff · Manchester</p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Why it fits</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Targets manufacturers with 100–500 staff and runs recurring finance reviews.</p>
        </div>
      </div>
    ),
  },
  {
    title: "Start the call",
    icon: Phone,
    body: "Dial through your connected provider — no new number, no separate softphone to manage.",
    render: () => (
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-muted border border-border px-3 py-2">
          <span className="text-xs text-foreground">Gary Collin</span>
          <span className="text-[11px] text-muted-foreground">Direct line</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
            <Phone className="w-3 h-3" /> Connected
          </span>
          <span className="text-[11px] text-muted-foreground">00:42</span>
        </div>
      </div>
    ),
  },
  {
    title: "Choose the correct outcome",
    icon: MessageSquare,
    body: "Record what genuinely happened — a real conversation, a callback, or no answer.",
    render: () => (
      <div className="grid grid-cols-2 gap-2">
        {["Connected · callback", "No answer", "Voicemail", "Wrong person"].map((o, i) => (
          <div key={o} className={`rounded-lg px-3 py-2 text-xs border ${i === 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300" : "bg-muted border-border text-muted-foreground"}`}>
            {o}
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Save notes",
    icon: NotebookPen,
    body: "Capture the detail that matters while it's fresh — kept with the call, not elsewhere.",
    render: () => (
      <div className="rounded-lg bg-muted border border-border px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Interested in Q4 review. Wants the one-page summary before a longer conversation. Send
          Thursday, follow up Monday.
        </p>
      </div>
    ),
  },
  {
    title: "Schedule the follow-up",
    icon: CalendarClock,
    body: "Turn the outcome into a concrete next step with a date, so nothing slips through.",
    render: () => (
      <div className="space-y-2">
        <div className="rounded-lg bg-muted border border-border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Next action</p>
          <p className="text-[11px] text-foreground mt-0.5">Send summary &amp; follow up</p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2">
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Due Monday, 09:30</p>
        </div>
      </div>
    ),
  },
  {
    title: "Continue to the next call",
    icon: ArrowNext,
    body: "Move straight to your next best prospect without leaving the workspace.",
    render: () => (
      <div className="space-y-2">
        <div className="rounded-lg bg-muted border border-border px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-foreground">Brightpath Logistics</span>
          <span className="text-[11px] text-muted-foreground">Fit 81</span>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
          Next call <ArrowNext className="w-3 h-3" />
        </span>
      </div>
    ),
  },
];

export default function ProductDemo() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  const StepIcon = step.icon;

  return (
    <section id="demo" className="bg-muted py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            See the Cadence workflow.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From company briefing to saved follow-up without losing the thread.
          </p>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* Step list (desktop tabs / mobile stacked) */}
          <ol className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0" aria-label="Workflow steps">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const on = i === active;
              return (
                <li key={s.title} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    className={`w-full text-left flex items-center gap-2.5 rounded-xl px-3.5 py-3 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      on
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                    aria-current={on ? "step" : undefined}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium ${on ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Icon className={`w-4 h-4 shrink-0 ${on ? "text-emerald-500" : "text-muted-foreground"}`} />
                    <span className="text-sm font-medium hidden sm:inline">{s.title}</span>
                    <span className="text-sm font-medium sm:hidden">Step {i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Stage panel */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl shadow-black/10">
            <div className="flex items-center gap-2 px-4 h-9 border-b border-border bg-muted/60">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
              <span className="ml-2 text-[11px] text-muted-foreground">cadence · call workspace</span>
              <span className="ml-auto text-[10px] text-muted-foreground/70">Sample data</span>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <StepIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Step {active + 1} of {STEPS.length}</p>
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{step.body}</p>
              <div>{step.render()}</div>

              <div className="mt-6 pt-5 border-t border-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActive((a) => Math.max(0, a - 1))}
                  disabled={active === 0}
                  className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded px-1"
                >
                  Previous
                </button>
                {active < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActive((a) => Math.min(STEPS.length - 1, a + 1))}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded px-1"
                  >
                    Next step <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <Link
                    to="/app"
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
                  >
                    Go Cadence <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}