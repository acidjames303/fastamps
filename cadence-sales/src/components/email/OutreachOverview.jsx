import React from "react";
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, Download, FilePenLine, Inbox, Mail, ShieldCheck, UsersRound } from "lucide-react";

const secondary = "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
const card = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";

export default function OutreachOverview({ workspaceName, drafts, loading, mailboxConnected, onNavigate, onCompose }) {
  const reviewed = drafts.filter((d) => d.status === "approved_hold").length;
  const pending = drafts.filter((d) => d.status !== "approved_hold").length;
  const shown = drafts.length;

  const actions = [
    {
      icon: UsersRound, title: "Build a campaign", description: "Import contacts, choose a template and prepare personalised messages.",
      action: "Campaign studio", destination: "campaign_studio",
    },
    {
      icon: FilePenLine, title: "Review your drafts", description: "Edit messages individually, check recipients and approve the content.",
      action: "Open drafts", destination: "drafts",
    },
    {
      icon: Download, title: "Take drafts into Mac Mail", description: "Download CSV/MBOX archives or prepare a small pack of unsent Apple Mail drafts.",
      action: "Open Mac Mail exports", destination: "exports",
    },
    {
      icon: CalendarClock, title: "Plan your send dates", description: "Arrange a staggered campaign and keep every message safely held.",
      action: "Schedule & hold", destination: "schedule",
    },
  ];

  return (
    <div className="space-y-5" aria-label="Outreach workspace overview">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="grid items-center gap-5 lg:grid-cols-[1fr,auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{workspaceName} workspace</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">What would you like to work on?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Create a campaign, write one personal email, or pick up where you left off. Your drafts, signatures and templates belong to your login.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-[370px]">
            <button type="button" onClick={() => onNavigate("campaign_studio")}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <UsersRound className="h-4 w-4"/> Create a campaign <ArrowRight className="h-4 w-4"/>
            </button>
            <button type="button" onClick={onCompose} className={secondary}><Mail className="h-4 w-4"/> Write one email</button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={card}>
          <p className="text-xs font-medium text-slate-500">Recent drafts in this workspace</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{loading ? "…" : shown}</p>
          <p className="mt-1 text-xs text-slate-500">Showing the first 100; not a total campaign count</p>
        </div>
        <div className={card}>
          <p className="text-xs font-medium text-slate-500">Awaiting content review</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{loading ? "…" : pending}</p>
          <p className="mt-1 text-xs text-slate-500">Of the recent drafts shown</p>
        </div>
        <div className={card}>
          <p className="text-xs font-medium text-slate-500">Content approved, still held</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{loading ? "…" : reviewed}</p>
          <p className="mt-1 text-xs text-slate-500">Approval never triggers sending</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),310px]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Your next steps</h3>
            <button type="button" onClick={() => onNavigate("templates")} className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline">
              <BookOpen className="h-4 w-4"/> Templates
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {actions.map(({ icon: Icon, title, description, action, destination }) => (
              <div key={destination} className={card+" flex flex-col"}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100"><Icon className="h-4 w-4 text-slate-600"/></span>
                <h4 className="mt-3 text-sm font-semibold text-slate-900">{title}</h4>
                <p className="mt-1 flex-1 text-sm leading-6 text-slate-600">{description}</p>
                <button type="button" onClick={() => onNavigate(destination)}
                  className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-medium text-emerald-700 hover:underline">
                  {action} <ArrowRight className="h-4 w-4"/>
                </button>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-3">
          <section className={card}>
            <div className="flex gap-2 items-center">
              {mailboxConnected ? <CheckCircle2 className="h-5 w-5 text-emerald-600"/> : <Inbox className="h-5 w-5 text-slate-500"/>}
              <h3 className="text-sm font-semibold text-slate-900">{mailboxConnected ? "Mailbox connected" : "Using Apple Mail?"}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {mailboxConnected
                ? "Your authorised provider account is available for the current read-only inbox preview."
                : "You can prepare campaigns without linking an inbox. Use the local Mac Mail bridge or connect the underlying Google/Microsoft provider."}
            </p>
            <button type="button" onClick={() => onNavigate(mailboxConnected ? "inbox" : "exports")}
              className="mt-3 text-sm font-semibold text-emerald-700 hover:underline">
              {mailboxConnected ? "Open inbox" : "View Mac Mail options"} →
            </button>
          </section>
          <section className={card}>
            <div className="flex gap-2 items-center"><ShieldCheck className="h-5 w-5 text-slate-600"/><h3 className="text-sm font-semibold text-slate-900">Every email stays under your control</h3></div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Draft review, approval and schedule planning are available. Automatic sending, live test batches and follow-ups are not enabled in this private preview.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
