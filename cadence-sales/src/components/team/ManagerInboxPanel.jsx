import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Inbox, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import EmailDraftModal from "@/components/dialer/EmailDraftModal";
import DictateButton from "@/components/dialer/DictateButton";
import InfoRequestRow from "@/components/team/InfoRequestRow";
import { buildInfoRequestEmailDraft } from "@/lib/emailDraft";
import { useAuth } from "@/lib/AuthContext";

const PAGE_SIZE = 10;

// Words people say out loud ("bring up all the info requests for the Tunstall
// campaign") that should not narrow the search.
const FILLER = new Set([
  "bring", "up", "show", "me", "all", "the", "info", "information", "request", "requests",
  "for", "from", "in", "on", "about", "any", "and", "of", "please", "get", "pull", "open",
  "list", "pending", "my", "our", "to", "with", "a", "an", "is", "are", "there", "campaign",
  "campaigns", "caller", "callers", "company", "companies", "notes", "note", "that", "this",
]);

const searchTerms = (value) =>
  String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9@.']+/)
    .filter((token) => token && !FILLER.has(token));

export default function ManagerInboxPanel({ limit, callerUserId = "", focusTaskId = "", onClearCaller }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [caller, setCaller] = useState("");
  const [page, setPage] = useState(0);

  const load = async () => {
    setError("");
    try {
      const res = await base44.functions.invoke("getManagerInbox", {});
      const data = res.data || res;
      setItems(data.items || []);
    } catch (e) {
      setError(e.message || "Could not load inbox.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(0); }, [query, caller]);

  const openDraft = (item) => {
    // The draft is written around the caller who actually spoke to the contact,
    // and can be switched to come personally from that caller.
    const shared = {
      contactName: item.contact_name,
      companyName: item.company_name,
      topic: item.info_request_topic,
      clientNotes: item.client_notes,
      callerName: item.caller_name,
      senderName: user?.full_name || user?.email || "",
      offer: item.campaign_offer,
      campaignName: item.campaign_name,
      accountManagerName: item.account_manager_name,
    };
    const fromTeam = buildInfoRequestEmailDraft({ ...shared, perspective: "team" });
    const fromCaller = buildInfoRequestEmailDraft({ ...shared, perspective: "caller" });
    const callerFirst = (item.caller_name || "").trim().split(/\s+/)[0];

    setDraft({
      ...fromTeam,
      perspectives: [
        {
          id: "team",
          label: callerFirst ? `From the team (mentions ${callerFirst})` : "From the team",
          subject: fromTeam.subject,
          body: fromTeam.body,
        },
        {
          id: "caller",
          label: callerFirst ? `Personally from ${callerFirst}` : "Personally from the caller",
          subject: fromCaller.subject,
          body: fromCaller.body,
        },
      ],
      contactEmail: item.contact_email || "",
      accountManagerEmail: item.account_manager_email || "",
      taskId: item.task_id,
    });
  };

  const markDone = async (taskId) => {
    try {
      await base44.functions.invoke("updateTask", { task_id: taskId, status: "completed" });
      setDraft(null);
      await load();
    } catch (e) {
      setError(e.message || "Could not complete task.");
    }
  };

  const completeAfterDraft = async () => {
    const taskId = draft?.taskId;
    setDraft(null);
    if (taskId) await markDone(taskId);
  };

  // Arriving from a caller's account narrows the inbox to that caller's own
  // requests — the same records, filtered by the caller's user id.
  const scoped = useMemo(
    () => (callerUserId ? items.filter((item) => item.caller_user_id === callerUserId) : items),
    [items, callerUserId]
  );

  const callers = useMemo(
    () => [...new Set(scoped.map((item) => item.caller_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [scoped]
  );

  const filtered = useMemo(() => {
    const terms = searchTerms(query);
    return scoped.filter((item) => {
      if (caller && item.caller_name !== caller) return false;
      if (!terms.length) return true;
      const haystack = [
        item.company_name, item.contact_name, item.caller_name, item.campaign_name,
        item.info_request_topic, item.client_notes, item.internal_notes, item.description,
      ].filter(Boolean).join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [scoped, query, caller]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const shown = typeof limit === "number"
    ? filtered.slice(0, limit)
    : filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
  const filtering = Boolean(query.trim() || caller);
  const scopedCallerName = callerUserId
    ? (items.find((item) => item.caller_user_id === callerUserId)?.caller_name || "")
    : "";

  // A request opened from a caller's account is put on the right page first.
  useEffect(() => {
    if (!focusTaskId) return;
    const index = filtered.findIndex((item) => item.task_id === focusTaskId);
    if (index >= 0) setPage(Math.floor(index / PAGE_SIZE));
  }, [focusTaskId, filtered]);

  useEffect(() => {
    if (!focusTaskId) return;
    const el = document.getElementById(`ir-${focusTaskId}`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusTaskId, currentPage, loading]);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Inbox className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                Info requests from callers
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{scoped.length}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Callers send IR notes here for admin to draft the client email — nothing auto-sends.
              </p>
            </div>
          </div>
          {typeof limit === "number" && scoped.length > limit && (
            <Link to="/manager-inbox" className="text-sm text-emerald-700 hover:underline shrink-0">View all ({scoped.length})</Link>
          )}
        </div>

        {scoped.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search or dictate — company, caller, campaign or notes"
                className="h-8 rounded-full border-slate-200 pl-8 pr-8 text-xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <DictateButton value={query} onChange={setQuery} label="Dictate" />

            {callerUserId ? (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs text-emerald-800">
                {scopedCallerName || "This caller"} only
                {onClearCaller && (
                  <button
                    type="button"
                    onClick={onClearCaller}
                    aria-label="Show every caller"
                    className="text-emerald-700/70 hover:text-emerald-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ) : (
              <select
                value={caller}
                onChange={(event) => setCaller(event.target.value)}
                aria-label="Filter by caller"
                className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">All callers</option>
                {callers.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}

            {filtering && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => { setQuery(""); setCaller(""); }}
                className="h-8 rounded-full px-3 text-xs text-slate-500"
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-400 p-6">
          {scoped.length === 0
            ? (callerUserId
              ? "No pending info requests from this caller."
              : "No pending info requests. When a caller logs “Info requested”, it lands here.")
            : `No info requests match${query.trim() ? ` “${query.trim()}”` : ""}${caller ? ` for ${caller}` : ""}.`}
        </p>
      ) : (
        <div className="divide-y divide-slate-100 overflow-y-auto max-h-[calc(100vh-17rem)]">
          {shown.map((item) => (
            <div
              key={item.task_id}
              id={`ir-${item.task_id}`}
              className={item.task_id === focusTaskId ? "bg-emerald-50/40 ring-2 ring-inset ring-emerald-300" : ""}
            >
              <InfoRequestRow item={item} onDraft={openDraft} onDone={markDone} />
            </div>
          ))}
        </div>
      )}

      {typeof limit !== "number" && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
          <p className="text-[11px] text-slate-500">
            {currentPage * PAGE_SIZE + 1}–{Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button" size="sm" variant="ghost"
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="h-7 rounded-full px-2 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </Button>
            <span className="text-[11px] text-slate-500 px-1">{currentPage + 1} / {pageCount}</span>
            <Button
              type="button" size="sm" variant="ghost"
              onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
              disabled={currentPage >= pageCount - 1}
              className="h-7 rounded-full px-2 text-xs"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600 px-5 pb-4 pt-2">{error}</p>}

      {draft && (
        <EmailDraftModal
          draft={draft}
          contactEmail={draft.contactEmail}
          accountManagerEmail={draft.accountManagerEmail}
          allowSaveDraft
          onClose={completeAfterDraft}
        />
      )}
    </div>
  );
}