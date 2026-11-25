import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Inbox, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import EmailDraftModal from "@/components/dialer/EmailDraftModal";
import { buildInfoRequestEmailDraft } from "@/lib/emailDraft";
import { useAuth } from "@/lib/AuthContext";

export default function ManagerInboxPanel({ limit }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");

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

  const openDraft = (item) => {
    const built = buildInfoRequestEmailDraft({
      contactName: item.contact_name,
      companyName: item.company_name,
      topic: item.info_request_topic,
      clientNotes: item.client_notes,
      callerName: user?.full_name || user?.email || "",
      accountManagerName: item.account_manager_name,
    });
    setDraft({
      ...built,
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

  const shown = typeof limit === "number" ? items.slice(0, limit) : items;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Inbox className="w-4 h-4" /> Info requests from callers
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Callers send IR notes here for admin to draft the client email — nothing auto-sends.
          </p>
        </div>
        {typeof limit === "number" && items.length > limit && (
          <Link to="/manager-inbox" className="text-sm text-emerald-700 hover:underline">View all ({items.length})</Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-400 p-6">No pending info requests. When a caller logs “Info requested”, it lands here.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {shown.map((item) => (
            <div key={item.task_id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {item.company_name || "Company"} · {item.contact_name || "Contact"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  From {item.caller_name}
                  {item.info_request_topic ? ` · ${item.info_request_topic}` : ""}
                  {item.who_spoken_to || item.conversation_type ? ` · ${item.conversation_type || ""}` : ""}
                </p>
                {item.client_notes && (
                  <p className="text-sm text-slate-600 mt-2 line-clamp-3 whitespace-pre-wrap">{item.client_notes}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button type="button" size="sm" className="rounded-full" onClick={() => openDraft(item)}>
                  <Mail className="w-3.5 h-3.5 mr-1" /> Draft email
                </Button>
                <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => markDone(item.task_id)}>
                  Done
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-rose-600 px-5 pb-4">{error}</p>}

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
