import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { LifeBuoy, RefreshCw, Plus, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import ReportProblemDialog from "@/components/support/ReportProblemDialog";

const PRIORITY_STYLES = {
  critical: "text-rose-700 bg-rose-50 border-rose-200",
  high: "text-amber-700 bg-amber-50 border-amber-200",
  normal: "text-slate-600 bg-slate-50 border-slate-200",
  low: "text-slate-400 bg-slate-50 border-slate-200",
};
const STATUS_LABELS = {
  new: "New", investigating: "Investigating", waiting_for_customer: "Waiting for you",
  fix_in_progress: "Fix in progress", resolved: "Resolved", closed: "Closed",
};

export default function SupportCenter() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");

  const isCaller = ['bdm', 'reporting_user'].includes(user?.app_role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.SupportRequest.list('-created_at', 50);
      // Callers see only their own requests; admins/managers see all org requests.
      const visible = isCaller ? data.filter(r => r.submitted_by_user_id === user.id) : data;
      setRequests(visible);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, [user, isCaller]);

  useEffect(() => { load(); }, [load]);

  const sendReply = async () => {
    if (!replyText.trim() || !replyTo) return;
    try {
      await base44.functions.invoke("manageSupportRequest", {
        action: "reply",
        request_id: replyTo.id,
        reply_text: replyText,
      });
      setReplyTo(null);
      setReplyText("");
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <LifeBuoy className="w-7 h-7 text-slate-700" /> Support
          </h1>
          <p className="text-slate-500 mt-1">
            {isCaller ? "Report problems and track their resolution." : "View and manage support requests."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button onClick={() => setShowDialog(true)}><Plus className="w-4 h-4 mr-2" />Report a problem</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <LifeBuoy className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No support requests yet.</p>
          <p className="text-sm text-slate-400 mt-1">If something isn't working, report it and we'll help.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 px-2 py-1 rounded-full border text-xs font-medium ${PRIORITY_STYLES[r.priority] || PRIORITY_STYLES.normal}`}>
                  {r.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{r.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{r.category.replace(/_/g, ' ')} · {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-xs">{STATUS_LABELS[r.status] || r.status}</Badge>
                {!['resolved', 'closed'].includes(r.status) && (
                  <Button variant="ghost" size="sm" onClick={() => { setReplyTo(r); setReplyText(""); }}>
                    <Reply className="w-3.5 h-3.5 mr-1" /> Reply
                  </Button>
                )}
              </div>
              {replyTo?.id === r.id && (
                <div className="mt-3 space-y-2">
                  <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Add a reply…" rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={sendReply} disabled={!replyText.trim()}>Send reply</Button>
                    <Button size="sm" variant="outline" onClick={() => setReplyTo(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ReportProblemDialog open={showDialog} onOpenChange={setShowDialog} />
    </div>
  );
}