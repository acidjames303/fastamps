import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Calendar, Download, CheckCircle2, XCircle, Send, AlertCircle, FileText } from "lucide-react";
import { downloadIcs } from "@/lib/icsGenerator";
import QualificationPanel from "@/components/opportunities/QualificationPanel";
import MeetingBookingPanel from "@/components/opportunities/MeetingBookingPanel";
import HandoffPreviewModal from "@/components/opportunities/HandoffPreviewModal";

const STAGE_LABELS = {
  discovered: "Discovered", qualifying: "Qualifying", qualified: "Qualified",
  meeting_proposed: "Meeting proposed", meeting_booked: "Meeting booked",
  handoff_ready: "Ready for handoff", handed_off: "Handed off",
  closed_won: "Closed won", closed_lost: "Closed lost",
};

const REVIEW_LABELS = {
  not_submitted: "Not submitted", awaiting_review: "Awaiting review",
  approved: "Approved", changes_requested: "Changes requested", rejected: "Rejected",
};

const HANDOFF_LABELS = {
  not_ready: "Not ready", awaiting_review: "Awaiting review", approved: "Approved",
  sending: "Sending", handed_off: "Handed off", failed: "Failed", changes_requested: "Changes requested",
};

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [opp, setOpp] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHandoff, setShowHandoff] = useState(false);
  const [reviewAction, setReviewAction] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [opportunity, dests] = await Promise.all([
        base44.entities.Opportunity.get(id),
        base44.functions.invoke("manageIntegration", { action: "list" }).catch(() => ({ destinations: [] })),
      ]);
      setOpp(opportunity);
      setDestinations((dests.data || dests).destinations || []);
      if (opportunity.meeting_id) {
        const m = await base44.entities.Meeting.get(opportunity.meeting_id).catch(() => null);
        setMeeting(m);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const doReviewAction = async (action) => {
    setActing(true);
    try {
      await base44.functions.invoke("manageOpportunityReview", {
        opportunity_id: id, action, notes: reviewNotes,
      });
      setReviewAction("");
      setReviewNotes("");
      await load();
    } catch {} finally { setActing(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!opp) return <p className="text-slate-400">Opportunity not found.</p>;

  const isManager = true; // RLS + function-level checks handle the real auth

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">{opp.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{STAGE_LABELS[opp.stage] || opp.stage}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{REVIEW_LABELS[opp.manager_review_status] || opp.manager_review_status}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">{HANDOFF_LABELS[opp.handoff_status] || opp.handoff_status}</span>
          </div>
        </div>
      </div>

      {/* Meeting section */}
      {meeting && meeting.status !== "cancelled" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> Meeting</h2>
            <Button variant="ghost" size="sm" onClick={() => downloadIcs(meeting)}>
              <Download className="w-4 h-4 mr-1" /> ICS
            </Button>
          </div>
          <div className="text-sm text-slate-600 space-y-1">
            <div className="font-medium text-slate-900">{meeting.title}</div>
            <div>{new Date(meeting.starts_at).toLocaleString("en-GB", { timeZone: meeting.timezone || "Europe/London" })} ({meeting.timezone || "Europe/London"})</div>
            <div>Type: {meeting.meeting_type} · Status: {meeting.status}</div>
            {meeting.meeting_url && <div>URL: <a href={meeting.meeting_url} target="_blank" rel="noreferrer" className="text-blue-500 underline">{meeting.meeting_url}</a></div>}
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(`/meetings/${meeting.id}/prep`)}>
            <FileText className="w-4 h-4 mr-1" /> Meeting preparation
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> Book a meeting</h2>
          <MeetingBookingPanel opportunity={opp} onBooked={load} />
        </div>
      )}

      {/* Qualification section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Qualification</h2>
        <QualificationPanel opportunity={opp} onSaved={load} />
      </div>

      {/* Manager review section */}
      {opp.manager_review_status === "awaiting_review" && isManager && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Manager review</h2>
          <textarea className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm mb-3" rows={2} placeholder="Review notes (optional)..." value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={() => doReviewAction("approve")} disabled={acting} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Approve for handoff
            </Button>
            <Button variant="outline" onClick={() => doReviewAction("request_changes")} disabled={acting}>
              Request changes
            </Button>
            <Button variant="outline" onClick={() => doReviewAction("reject")} disabled={acting} className="text-rose-600 hover:text-rose-700">
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
          </div>
        </div>
      )}

      {/* Handoff section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Handoff</h2>
          {opp.manager_review_status === "approved" && (
            <Button onClick={() => setShowHandoff(true)}>
              <Send className="w-4 h-4 mr-1" /> Preview & send
            </Button>
          )}
        </div>
        {opp.handoff_status === "handed_off" && (
          <div className="text-sm text-emerald-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Handed off via {opp.handoff_destination}
            {opp.external_record_url && <a href={opp.external_record_url} target="_blank" rel="noreferrer" className="underline">View record</a>}
          </div>
        )}
        {opp.handoff_status === "failed" && (
          <div className="text-sm text-rose-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Failed: {opp.last_handoff_error}
            <Button variant="outline" size="sm" onClick={() => setShowHandoff(true)}>Retry</Button>
          </div>
        )}
        {opp.handoff_status === "not_ready" && opp.manager_review_status !== "approved" && (
          <p className="text-sm text-slate-400">Opportunity must be approved by a manager before handoff.</p>
        )}
      </div>

      {showHandoff && (
        <HandoffPreviewModal opportunity={opp} destinations={destinations} onClose={() => setShowHandoff(false)} onSent={load} />
      )}
    </div>
  );
}