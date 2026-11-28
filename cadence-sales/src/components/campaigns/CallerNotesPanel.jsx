import React, { useMemo, useState } from "react";
import { StickyNote } from "lucide-react";

// Caller notes only — what was said on each account. The accounts themselves are
// shown once, in the campaign's prospect table, so this panel never repeats them.
export default function CallerNotesPanel({ accounts = [] }) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return accounts
      .filter((account) => (account.notes || []).length > 0)
      .filter((account) => {
        if (!query) return true;
        const hay = [account.name, ...(account.notes || []).map((note) => note.text)].join(" ").toLowerCase();
        return hay.includes(query);
      });
  }, [accounts, search]);

  const total = accounts.reduce((count, account) => count + (account.notes || []).length, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <StickyNote className="w-4 h-4 text-slate-400" /> Caller notes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{total} note{total === 1 ? "" : "s"} across {rows.length} account{rows.length === 1 ? "" : "s"}</p>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes…"
          className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 w-full sm:w-64"
        />
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-400 text-center">No notes match that search.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((account) => (
            <li key={account.id} className="px-5 py-3">
              <p className="text-sm font-medium text-slate-900">{account.name}</p>
              <div className="mt-1 space-y-1">
                {(account.notes || []).map((note) => (
                  <p key={note.id} className="text-xs text-slate-600">
                    <span className="text-slate-400">
                      {[note.caller, note.at ? new Date(note.at).toLocaleDateString("en-GB") : "", note.contact_name]
                        .filter(Boolean)
                        .join(" · ")}
                      {note.caller || note.at || note.contact_name ? " — " : ""}
                    </span>
                    {note.text}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}