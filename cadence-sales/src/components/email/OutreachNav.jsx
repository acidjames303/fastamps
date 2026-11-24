import React, { useEffect, useRef, useState } from "react";
import {
  BookOpen, CalendarClock, ChevronDown, Download, FilePenLine, Inbox, LayoutDashboard,
  Layers3, Mailbox, MoreHorizontal, Signature, UsersRound,
} from "lucide-react";
import OutreachWorkspacePicker from "@/components/email/OutreachWorkspacePicker";

const PRIMARY = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "inbox", label: "Inbox", Icon: Inbox },
  { key: "drafts", label: "Drafts", Icon: FilePenLine },
  { key: "campaign_studio", label: "Campaigns", Icon: UsersRound },
  { key: "templates", label: "Templates", Icon: BookOpen },
];

const TOOLS = [
  { key: "schedule", label: "Schedule & hold", hint: "Choose dates; sending stays disabled", Icon: CalendarClock },
  { key: "exports", label: "Download for Mac Mail", hint: "Take drafts into Apple Mail", Icon: Download },
  { key: "signatures", label: "Signatures", hint: "Your sign-off for each workspace", Icon: Signature },
  { key: "mailboxes", label: "Mailboxes", hint: "Connect your email account", Icon: Mailbox },
  { key: "workspaces", label: "Manage workspaces", hint: "Rename, archive or add details", Icon: Layers3 },
];

export default function OutreachNav({ page, onNavigate, workspace }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const inTools = TOOLS.some((t) => t.key === page);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const escape = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);

  const tab = (active) =>
    `inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
      active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
    }`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2.5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-1">
        {PRIMARY.map(({ key, label, Icon }) => (
          <button key={key} type="button" aria-current={page===key?"page":undefined} onClick={() => onNavigate(key)} className={tab(page === key)}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={tab(inTools)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="h-4 w-4" /> More
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute left-0 z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg">
              {TOOLS.map(({ key, label, hint, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onNavigate(key); }}
                  className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-slate-50 ${page === key ? "bg-emerald-50" : ""}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{label}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        </div>
        <div className="flex justify-start lg:ml-auto lg:justify-end">
          <OutreachWorkspacePicker {...workspace} />
        </div>
      </div>
    </div>
  );
}