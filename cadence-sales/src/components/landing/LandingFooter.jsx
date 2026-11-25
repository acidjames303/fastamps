import React from "react";
import { Link } from "react-router-dom";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how" },
      { label: "Pricing", href: "#pricing" },
      { label: "Security", href: "#security" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Open Cadence", to: "/app" },
      { label: "Sign in", to: "/app" },
    ],
  },
];

const LEGAL_LINKS = [
  { label: "Support", to: "/support-info" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Data Processing", to: "/data-processing" },
];

export default function LandingFooter() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="font-display text-lg font-semibold text-foreground">
              Cadence<span className="text-emerald-500">.</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
              The prospecting and calling workspace before your CRM.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((l) =>
                  l.href ? (
                    <li key={l.label}>
                      <a href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Legal</p>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© 2026 Cadence. Trading entity to be confirmed.</p>
          <p className="text-xs text-muted-foreground/70">Built in the UK for responsible prospecting.</p>
        </div>
      </div>
    </footer>
  );
}