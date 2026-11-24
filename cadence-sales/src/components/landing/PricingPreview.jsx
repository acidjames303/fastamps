import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight, ChevronDown, Sparkles } from "lucide-react";

const PRIMARY = [
  {
    name: "Solo",
    price: "£39",
    blurb: "For one admin/caller managing their own prospecting and follow-up.",
    features: [
      "1 user seat",
      "100 Smart Actions / month",
      "500 MB storage",
      "AI research & lead briefings",
      "Click-to-call telephony",
      "Client reports",
    ],
  },
  {
    name: "Team",
    price: "£99",
    blurb: "For one Operations Admin and two SDRs sharing lists and results.",
    features: [
      "3 user seats",
      "500 Smart Actions / month",
      "2 GB storage",
      "Team assignment & shared lists",
      "CRM integrations & webhooks",
      "PDF exports & client reports",
    ],
  },
  {
    name: "Growth",
    price: "£249",
    blurb: "For one Operations Admin and five SDRs scaling a repeatable workflow.",
    features: [
      "6 user seats",
      "1,000 Smart Actions / month",
      "3 GB storage",
      "Team assignment & shared lists",
      "CRM integrations & webhooks",
      "PDF exports & client reports",
    ],
    popular: true,
  },
];

const ENTERPRISE = [
  {
    name: "Business",
    price: "£499",
    blurb: "For two Operations Admins and ten SDRs across multiple campaigns.",
    features: [
      "12 user seats",
      "1,500 Smart Actions / month",
      "5 GB storage",
      "Advanced reporting",
      "Priority support",
    ],
  },
  {
    name: "Scale",
    price: "from £1,499",
    blurb: "For larger organisations running high-volume calling across teams.",
    features: [
      "Up to 50 user seats",
      "2,500 Smart Actions / month",
      "10 GB storage",
      "Advanced reporting",
      "Dedicated support",
    ],
  },
];

const TRIAL = [
  "1 Operations Admin",
  "2 SDR accounts",
  "50 Smart Actions",
  "No payment card required",
  "Provider connections optional during setup",
  "Read-only access after expiry",
  "Data export remains available",
];

function Card({ t }) {
  return (
    <div
      className={`relative rounded-2xl border p-6 flex flex-col ${
        t.popular
          ? "border-emerald-500 bg-emerald-500/5 shadow-sm ring-1 ring-emerald-500"
          : "border-border bg-card"
      }`}
    >
      {t.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-medium px-3 py-1 rounded-full">
          Most popular
        </span>
      )}
      <h3 className="font-semibold text-lg text-foreground">{t.name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-3xl font-bold text-foreground">{t.price}</span>
        <span className="text-sm text-muted-foreground">/mo</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">{t.blurb}</p>
      <ul className="mt-4 space-y-2 flex-1">
        {t.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-foreground">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
      <Link
        to="/app"
        className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          t.popular
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : "bg-primary hover:bg-primary/90 text-primary-foreground"
        }`}
      >
        Go Cadence
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

export default function PricingPreview() {
  const [showActions, setShowActions] = useState(false);

  return (
    <section id="pricing" className="bg-background py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start in minutes. Subscribe in-app whenever you are ready.
          </p>
        </div>

        {/* Trial panel */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8 mb-10">
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Try the complete Cadence workflow for 7 days.
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">No payment card required. Provider connections optional during setup.</p>
              <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {TRIAL.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              to="/app"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-6 py-3 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Start free trial <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Primary tiers */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {PRIMARY.map((t) => (
            <Card key={t.name} t={t} />
          ))}
        </div>

        {/* Larger-organisation tiers */}
        <p className="text-sm font-medium text-muted-foreground mt-10 mb-3">For larger organisations</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {ENTERPRISE.map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-muted p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <h3 className="font-semibold text-lg text-foreground">{t.name}</h3>
                  <span className="text-muted-foreground text-sm">·</span>
                  <span className="font-display text-xl font-bold text-foreground">{t.price}</span>
                  {t.price.includes("from") && <span className="text-sm text-muted-foreground">/mo</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/app"
                className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-5 py-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Go Cadence <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* Smart Action explanation */}
        <div className="mt-10 rounded-2xl border border-border bg-muted">
          <button
            type="button"
            onClick={() => setShowActions((v) => !v)}
            aria-expanded={showActions}
            className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-2xl"
          >
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              What is a Smart Action?
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showActions ? "rotate-180" : ""}`} />
          </button>
          {showActions && (
            <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
              <p>
                Smart Actions cover Cadence-powered research and processing. Managing lists, making
                calls through your provider, recording notes, saving outcomes and managing
                follow-ups do not each consume a Smart Action.
              </p>
              <p className="mt-3">
                Saved company intelligence is reused before a new Smart Action is requested, so you
                don't pay twice for information you already hold.
              </p>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          All plans include unlimited core workflow under fair use and bring-your-own provider
          billing. Additional SDR seats £35/month. Subscriptions are managed securely inside the app.
        </p>
      </div>
    </section>
  );
}