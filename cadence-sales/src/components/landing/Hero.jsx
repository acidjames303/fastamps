import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import NextCallMock from "@/components/landing/NextCallMock";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-background pt-28 pb-20 sm:pt-32 sm:pb-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_60%_0%,rgba(16,185,129,0.18),transparent_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      {/* fine grid lines */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(100,116,139,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.10) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent 75%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-5">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          {/* Copy */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-4 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-6">
              The prospecting and calling workspace before your CRM
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
              One call away<br />from your ideal client<span className="text-emerald-500">.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Know who you're calling, understand why they fit and move straight to your next best
              prospect. Cadence brings company briefings, prioritised lists and your calling
              workflow into one focused workspace.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Link
                to="/app"
                className="group inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-7 py-3.5 rounded-full transition-colors shadow-lg shadow-emerald-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Go Cadence
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 text-foreground/90 hover:text-foreground font-medium px-7 py-3.5 rounded-full border border-border hover:border-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                See how it works
              </a>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              7 days free · 1 Operations Admin + 2 SDRs · No card required
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your own calling and enrichment providers.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Compliance controls designed to support responsible UK prospecting.
            </p>
          </div>

          {/* Product composition */}
          <div className="relative">
            <div className="absolute -inset-6 bg-[radial-gradient(ellipse_60%_60%_at_70%_40%,rgba(16,185,129,0.12),transparent_70%)]" aria-hidden="true" />
            <div className="relative">
              <NextCallMock />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}