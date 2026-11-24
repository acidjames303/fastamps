import React from "react";
import { FileSpreadsheet, PhoneOff, ClipboardX, BellOff } from "lucide-react";

const PROBLEMS = [
  {
    icon: FileSpreadsheet,
    title: "Scattered prospect lists",
    body: "Lists live in spreadsheets, inboxes and separate tools — never where the calling happens.",
  },
  {
    icon: PhoneOff,
    title: "Calls made without context",
    body: "Dialling a name and number with no real understanding of the company or why it fits.",
  },
  {
    icon: ClipboardX,
    title: "Outcomes recorded inconsistently",
    body: "Results captured differently every time, so no one knows what actually happened.",
  },
  {
    icon: BellOff,
    title: "Follow-ups easily missed",
    body: "Callbacks and next steps buried in notes, lost between calls and handovers.",
  },
];

export default function ProblemSection() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-5">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">The gap</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight">
            Prospecting breaks between the spreadsheet and the CRM.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            Lists live in one place, company research in another, calls happen somewhere else and
            follow-ups disappear into notes. Cadence brings the work around the call together.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="bg-muted p-7">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}