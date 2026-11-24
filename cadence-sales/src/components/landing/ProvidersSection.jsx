import React from "react";
import { Phone, Database, Wallet, Settings, Check } from "lucide-react";

const POINTS = [
  { icon: Phone, title: "Bring your own calling", body: "Connect supported calling providers such as Twilio or Yay.com and dial through your own account." },
  { icon: Database, title: "Bring your own enrichment", body: "Use supported enrichment providers such as Lusha or FullEnrich to find contact details." },
  { icon: Wallet, title: "Provider costs stay separate", body: "Cadence does not sell calling minutes or resell enrichment credits. Providers bill you directly." },
  { icon: Settings, title: "Connect during onboarding — or later", body: "Provider setup can be skipped and completed whenever your organisation is ready." },
];

const REUSE = [
  "Existing company intelligence is reused where possible",
  "Duplicate Smart Actions are not triggered for information already saved",
];

export default function ProvidersSection() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">Customer-owned providers</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Your providers. Your data. Your choice.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            Cadence provides the workflow. Connect your own supported calling and enrichment
            accounts, remain in control of provider billing and use the services that suit your
            organisation.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 mb-6">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border bg-muted p-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <ul className="space-y-2">
            {REUSE.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}