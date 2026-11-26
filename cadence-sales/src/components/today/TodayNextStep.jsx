import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Inbox, PhoneCall, Target } from "lucide-react";
import { todayNextAction } from "@/lib/campaignNextAction";

// First thing on Today: one clear next move based on real work, role and progress.
export default function TodayNextStep({
  dueNow = 0,
  overdue = 0,
  newProspects = 0,
  pendingIrs = 0,
  canProspect = false,
  isAdmin = false,
  hasCallingWork = false,
  lastDialResume = null,
  onStartCalling,
  starting = false,
}) {
  const next = todayNextAction({
    dueNow,
    overdue,
    newProspects,
    pendingIrs,
    canProspect,
    isAdmin,
    hasCallingWork,
    lastDialResume,
  });

  const Icon = next.kind === "inbox" ? Inbox : next.kind === "prospect" ? Target : PhoneCall;

  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/50 p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
        Today · what next
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-slate-900">{next.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{next.detail}</p>
          </div>
        </div>

        {next.kind === "call" && next.cta && (
          <Button
            onClick={onStartCalling}
            disabled={starting}
            className="rounded-full bg-emerald-600 hover:bg-emerald-500 h-11 px-5"
          >
            {starting ? "Starting…" : next.cta}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
        {next.href && next.cta && (
          <Link
            to={next.href}
            className="inline-flex h-11 items-center rounded-full bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            {next.cta}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
