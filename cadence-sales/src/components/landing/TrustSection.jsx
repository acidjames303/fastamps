import React from "react";
import { Building, KeyRound, ShieldCheck, Download, Stethoscope, Lock } from "lucide-react";

const TRUST = [
  { icon: Building, title: "Organisation-separated workspaces", body: "Each organisation's prospect data is isolated from others." },
  { icon: Lock, title: "Role-based access", body: "Access to lists, contacts and outcomes is governed by user role." },
  { icon: KeyRound, title: "Encrypted provider credentials", body: "Connected provider credentials are encrypted, not exposed in the interface." },
  { icon: Download, title: "Customer-controlled exports", body: "Export your data when you need it — it remains yours." },
  { icon: Stethoscope, title: "Safe support diagnostics", body: "Support uses usage metadata and diagnostics, not prospect notes or call content." },
  { icon: ShieldCheck, title: "No credentials in support reports", body: "API keys and secrets are never stored in or surfaced through support reports." },
];

export default function TrustSection() {
  return (
    <section id="security" className="bg-muted py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">Security &amp; data protection</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Built for prospecting data that matters.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {TRUST.map((t) => (
            <div key={t.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <t.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{t.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Customer-owned calling and enrichment accounts mean the services that reach your
            prospects stay under your control. Access is restricted and audited for legitimate
            support and operational purposes.
          </p>
          <p className="mt-4 text-xs text-muted-foreground/80 leading-relaxed">
            Cadence is built to support responsible UK prospecting. It is not a substitute for your
            own compliance responsibilities, and no system can guarantee absolute security or
            guaranteed regulatory compliance.
          </p>
        </div>
      </div>
    </section>
  );
}