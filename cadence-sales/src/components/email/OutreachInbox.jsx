import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Inbox, Loader2, Mail, PenLine, RefreshCw, ShieldCheck, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

const actionStyle = "inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function dateLabel(value) {
  if (!value) return "";
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? String(value).slice(0, 32) :
    time.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

// Inbox is a temporary read-only preview of the user's own authorised account.
// Never persists message contents or performs a send / mark-read / delete operation.
export default function OutreachInbox({ mailStatus, onConnections, onNavigate, onReply }) {
  const [provider, setProvider] = useState("gmail");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [reconnect, setReconnect] = useState(false);
  const [nextCursor, setNextCursor] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const requestEpoch = useRef(0); // Invalidate in-flight calls when accounts change.

  const connected = !!mailStatus?.providers?.[provider]?.connected;
  useEffect(() => {
    if (mailStatus && !mailStatus.providers?.[provider]?.connected) {
      if (mailStatus.providers?.gmail?.connected) setProvider("gmail");
      else if (mailStatus.providers?.outlook?.connected) setProvider("outlook");
    }
  }, [mailStatus, provider]);

  const loadInbox = useCallback(async (cursor = "") => {
    if (!connected) return;
    const epoch = requestEpoch.current;
    const sourceProvider = provider;
    setBusy(true); setError(""); setReconnect(false);
    try {
      const response = await base44.functions.invoke("readOutreachInbox",
        { action: "list", provider: sourceProvider, cursor });
      if (requestEpoch.current !== epoch) return; // Ignore previous mailbox.
      const data = response.data || response;
      if (!data.ok) {
        setReconnect(!!data.needs_reconnect);
        throw new Error(data.error || "Could not read your inbox.");
      }
      setItems((previous) => cursor
        ? [...previous, ...(data.messages || []).filter((m) => !previous.some((p) => p.id === m.id))]
        : (data.messages || []));
      setNextCursor(data.next_cursor || "");
      setHasLoaded(true);
    } catch (e) {
      if (requestEpoch.current === epoch) setError(e.message || "Inbox could not be loaded.");
    } finally {
      if (requestEpoch.current === epoch) setBusy(false);
    }
  }, [provider, connected]);

  useEffect(() => {
    requestEpoch.current += 1;
    setItems([]); setMessage(null); setHasLoaded(false); setNextCursor("");
    setBusy(false); setOpening(false); setError("");
    if (connected) loadInbox();
  }, [provider, connected, loadInbox]);

  const openMessage = async (item) => {
    const epoch = requestEpoch.current;
    const sourceProvider = provider;
    setOpening(true); setError(""); setMessage(null);
    try {
      const response = await base44.functions.invoke("readOutreachInbox",
        { action: "get", provider: sourceProvider, message_id: item.id });
      if (requestEpoch.current !== epoch) return;
      const data = response.data || response;
      if (!data.ok || !data.message) throw new Error(data.error || "Could not open this message.");
      setMessage({ ...data.message, source_provider: sourceProvider });
    } catch (e) {
      if (requestEpoch.current === epoch) setError(e.message || "Message could not be opened.");
    } finally { if (requestEpoch.current === epoch) setOpening(false); }
  };

  return (
    <section aria-label="Read-only connected inbox" className="space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-900">Your inbox</h2>
          <p className="text-xs text-slate-500 mt-1">Live, read-only view. Messages stay with your email provider.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="outreach-mail-provider" className="text-xs text-slate-500">Account</label>
          <select id="outreach-mail-provider" value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="max-w-[200px] rounded-xl border border-slate-200 p-2 text-sm">
            <option value="gmail">Gmail {mailStatus?.providers?.gmail?.connected ? "✓" : ""}</option>
            <option value="outlook">Outlook {mailStatus?.providers?.outlook?.connected ? "✓" : ""}</option>
          </select>
          <button type="button" className={actionStyle} disabled={!connected || busy}
            onClick={() => loadInbox()} aria-label="Refresh inbox">
            <RefreshCw className={"h-4 w-4 " + (busy ? "animate-spin" : "")}/>
          </button>
        </div>
      </div>
      {!connected ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center space-y-4">
          <Inbox className="h-9 w-9 mx-auto text-slate-300" />
          <div>
            <h3 className="font-semibold text-slate-900">Inbox waits until you connect email</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              You can build campaigns, write drafts and export to Mac Mail today. Connect Gmail or Outlook when you are ready — Cadence still will not send from here.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {typeof onNavigate === "function" && (
              <>
                <button className={actionStyle} type="button" onClick={() => onNavigate("campaign_studio")}>Create a campaign</button>
                <button className={actionStyle} type="button" onClick={() => onNavigate("exports")}>Mac Mail options</button>
              </>
            )}
            <button className={actionStyle} type="button" onClick={onConnections}>Connect mailbox</button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-xs text-slate-500 px-1 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {mailStatus?.providers?.[provider]?.email || provider} · Read-only inbox access
          </div>
          {!!error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
              {reconnect && <button type="button" className="block mt-2 font-semibold underline" onClick={onConnections}>
                Reconnect with inbox-reading permission
              </button>}
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-[350px,minmax(0,1fr)]">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold">Recent messages</div>
              {busy && !hasLoaded && <p className="p-5 text-sm text-slate-500 flex gap-2 items-center"><Loader2 className="h-4 w-4 animate-spin"/> Loading messages…</p>}
              {!busy && hasLoaded && items.length === 0 && <p className="p-5 text-sm text-slate-500">No inbox messages were returned.</p>}
              <div className="max-h-[640px] overflow-y-auto">
                {items.map((item) => (
                  <button type="button" key={item.id} onClick={() => openMessage(item)}
                    className={"w-full text-left border-b border-slate-100 p-4 hover:bg-emerald-50/60 transition-colors " +
                      (message?.id === item.id ? "bg-emerald-50" : "")}>
                    <div className="flex justify-between items-start gap-2">
                      <p className={"truncate text-sm " + (item.unread ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>{item.from || "Unknown sender"}</p>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300"/>
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate mt-1">{item.subject || "(No subject)"}</p>
                    <p className="text-xs text-slate-500 truncate mt-1">{item.snippet || "Select to read this message"}</p>
                    <p className="text-[11px] text-slate-400 mt-2">{dateLabel(item.date)}</p>
                  </button>
                ))}
              </div>
              {nextCursor && <button type="button" className="w-full py-3 text-sm font-semibold text-emerald-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={busy} onClick={() => loadInbox(nextCursor)}>
                {busy ? "Loading…" : "Load more"}
              </button>}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl min-h-[460px] p-5 sm:p-7">
              {opening ? <p className="text-sm text-slate-500 flex gap-2 items-center"><Loader2 className="h-4 w-4 animate-spin" /> Opening…</p> :
                !message ? (
                  <div className="min-h-[330px] flex flex-col items-center justify-center text-center">
                    <Mail className="w-10 h-10 text-slate-200"/>
                    <h3 className="font-semibold text-slate-800 mt-3">Select an email to read</h3>
                    <p className="text-sm text-slate-500 mt-2">Your inbox remains with Gmail or Outlook. We only show what you've authorised.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button type="button" onClick={() => setMessage(null)} className={actionStyle + " lg:hidden"}>
                      <ArrowLeft className="w-4 h-4"/> Back
                    </button>
                    <h3 className="text-xl font-semibold text-slate-900 break-words">{message.subject || "(No subject)"}</h3>
                    <div className="text-sm text-slate-600 space-y-1 pb-4 border-b">
                      <p><strong>From:</strong> {message.from}</p>
                      <p><strong>To:</strong> {message.to || mailStatus?.providers?.[provider]?.email}</p>
                      <p><strong>Received:</strong> {dateLabel(message.date)}</p>
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-800 max-h-[650px] overflow-y-auto">
                      {message.body_text || message.snippet || "(Message preview unavailable)"}
                    </pre>
                    <div className="border-t pt-4">
                      <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white font-medium hover:bg-slate-700"
                        onClick={() => onReply(message, message.source_provider)}>
                        <PenLine className="w-4 h-4"/> Write editable reply draft
                      </button>
                      <p className="text-xs text-slate-500 mt-2">
                        A new Cadence draft is created for your review. Threaded mailbox replies and sending are not enabled yet.
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
