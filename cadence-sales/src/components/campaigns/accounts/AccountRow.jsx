import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Globe, Phone, PhoneCall, Mail, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOutcomeLabel } from "@/lib/outcomeRules";
import AccountCompanyDetails from "@/components/campaigns/accounts/AccountCompanyDetails";

const dateLabel = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");

// One account inside a campaign: the people there and the notes callers left.
export default function AccountRow({ account, campaignId, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const emails = (account.contacts || []).filter((c) => c.email);
  // Every account maps to a Company record except imported rows that never got
  // one, and those cannot be positioned in the dialer queue.
  const canCall = !!campaignId && !!account.id && !String(account.id).startsWith("name:");
  const dialerHref = `/dialer?list=${campaignId}&company=${account.id}`;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="w-full px-5 py-4 hover:bg-slate-50 transition-colors flex items-start gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-0 text-left flex items-start gap-3"
        >
          <span className="mt-1 text-slate-400">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-900 truncate">{account.name}</p>
              {account.notes.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                  {account.notes.length} note{account.notes.length === 1 ? "" : "s"}
                </span>
              )}
              {emails.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                  {emails.length} email{emails.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {account.domain || "—"} · {account.contacts.length} contact{account.contacts.length === 1 ? "" : "s"} ·{" "}
              {account.calls} call{account.calls === 1 ? "" : "s"} · {account.conversations} conversation{account.conversations === 1 ? "" : "s"}
              {account.last_contact_at ? ` · last ${dateLabel(account.last_contact_at)}` : " · not called yet"}
            </p>
          </div>
        </button>
        {canCall && (
          <Button asChild size="sm" className="rounded-full h-8 shrink-0 bg-emerald-600 hover:bg-emerald-700">
            <Link to={dialerHref} title="Open this account in the dialer and call from here">
              <PhoneCall className="w-3.5 h-3.5 mr-1.5" /> Call
            </Link>
          </Button>
        )}
      </div>

      {open && (
        <div className="px-5 pb-5 pl-12 space-y-4">
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            {account.domain && (
              <span className="inline-flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {account.domain}</span>
            )}
            {account.phone && (
              <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {account.phone}</span>
            )}
            {account.location && (
              <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {account.location}</span>
            )}
          </div>

          <AccountCompanyDetails account={account} />

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">People</div>
            {account.contacts.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">No named contacts on this account yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {account.contacts.map((c) => (
                  <div key={c.id} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-900 min-w-[140px]">
                      <User className="w-3.5 h-3.5 text-slate-400" /> {c.name || "—"}
                    </span>
                    <span className="text-slate-500 text-xs flex-1 min-w-[120px]">{c.title || "—"}</span>
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> {c.email}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">No email</span>
                    )}
                    <span className="text-xs text-slate-500 min-w-[110px]">{c.phone || "—"}</span>
                    <span className="text-[11px] text-slate-400 min-w-[90px]">
                      {c.last_called ? dateLabel(c.last_called) : "not called"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Caller notes</p>
            {account.notes.length === 0 ? (
              <p className="text-sm text-slate-400">No notes recorded on this account yet.</p>
            ) : (
              <div className="space-y-2">
                {account.notes.map((n) => (
                  <div key={n.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="font-medium text-slate-600">{n.caller || "Caller"}</span>
                      <span>{dateLabel(n.at)}</span>
                      {n.contact_name && <span>{n.contact_name}</span>}
                      {n.outcome && <span className="text-slate-500">{getOutcomeLabel(n.outcome)}</span>}
                      {n.next_action && <span>next: {n.next_action}</span>}
                    </div>
                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{n.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}