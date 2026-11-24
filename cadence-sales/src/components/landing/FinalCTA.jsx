import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-card py-24 sm:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(16,185,129,0.22),transparent_70%)]" aria-hidden="true" />
      <div className="relative max-w-3xl mx-auto px-5 text-center">
        <h2 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-foreground leading-tight">
          Your next best conversation is already in the list.
        </h2>
        <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
          Go Cadence, organise the opportunity and make the call properly prepared.
        </p>
        <div className="mt-9 flex justify-center">
          <Link
            to="/app"
            className="group inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-8 py-4 rounded-full transition-colors shadow-lg shadow-emerald-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Go Cadence
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">7 days free · No card required</p>
      </div>
    </section>
  );
}