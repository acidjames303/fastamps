import React from "react";
import { CheckCircle2, MessageSquare, CalendarClock, Trophy } from "lucide-react";

const OUTCOMES = [
  { icon: CheckCircle2, title: "Know what you completed", body: "See every call made today and where your effort went." },
  { icon: MessageSquare, title: "Recognise genuine conversations", body: "Distinguish real conversations from no-answers and voicemails." },
  { icon: CalendarClock, title: "See every follow-up due", body: "Callbacks and next steps stay visible, never buried in notes." },
  { icon: Trophy, title: "Track opportunities created", body: "Watch qualified opportunities build from each honest conversation." },
];

export default function OwnYourCadence() {
  return (
    <section className="relative bg-card py-20 sm:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(16,185,129,0.18),transparent_70%)]" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Own your cadence.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            Your number. Your target. Your momentum. See what you've completed, who needs following
            up and where each conversation is leading. Every call strengthens your rhythm, your
            knowledge and your craft.
          </p>
        </div>

        {/* Rhythm line */}
        <div className="relative mb-10 h-12" aria-hidden="true">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
          <div className="absolute top-1/2 left-0 right-0 flex justify-between -translate-y-1/2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${i < 5 ? "bg-emerald-500" : "bg-muted-foreground/40"} border-2 border-card`}
              />
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OUTCOMES.map((o) => (
            <div key={o.title} className="rounded-2xl border border-emerald-500/15 bg-background/50 backdrop-blur p-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-4">
                <o.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-foreground text-[15px] leading-snug">{o.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{o.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Your live numbers appear in your workspace. Cadence does not publish invented performance statistics.
        </p>
      </div>
    </section>
  );
}