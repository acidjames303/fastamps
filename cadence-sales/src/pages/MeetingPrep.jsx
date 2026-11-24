import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Download, Sparkles, Building2, User, Phone, FileText, AlertCircle } from "lucide-react";
import { downloadIcs } from "@/lib/icsGenerator";

export default function MeetingPrep() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [company, setCompany] = useState(null);
  const [contact, setContact] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [opportunity, setOpportunity] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const m = await base44.entities.Meeting.get(id);
        setMeeting(m);
        if (m.preparation_notes) setAiSummary(m.preparation_notes);

        const [comp, cont, intel, opp, logs, camp] = await Promise.all([
          m.company_id ? base44.entities.Company.get(m.company_id).catch(() => null) : null,
          m.contact_id ? base44.entities.Contact.get(m.contact_id).catch(() => null) : null,
          m.company_id ? base44.entities.CompanyIntelligence.filter({ company_id: m.company_id }, "-researched_at", 1).catch(() => []) : [],
          m.opportunity_id ? base44.entities.Opportunity.get(m.opportunity_id).catch(() => null) : null,
          m.company_id ? base44.entities.CallLog.filter({ company_id: m.company_id }, "-started_at", 10).catch(() => []) : [],
          m.campaign_id ? base44.entities.Campaign.get(m.campaign_id).catch(() => null) : null,
        ]);
        setCompany(comp);
        setContact(cont);
        setIntelligence(Array.isArray(intel) && intel.length > 0 ? intel[0] : null);
        setOpportunity(opp);
        setCallLogs(logs || []);
        setCampaign(camp);
      } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const generatePrep = async () => {
    setGenerating(true); setError("");
    try {
      const res = await base44.functions.invoke("generateMeetingPrep", { meeting_id: id });
      setAiSummary((res.data || res).summary);
    } catch (e) { setError(e.message); } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!meeting) return <p className="text-slate-400">Meeting not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-900"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">{meeting.title}</h1>
            <p className="text-sm text-slate-500">{new Date(meeting.starts_at).toLocaleString("en-GB", { timeZone: meeting.timezone || "Europe/London" })} · {meeting.meeting_type}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => downloadIcs(meeting)}>
          <Download className="w-4 h-4 mr-1" /> ICS
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Company overview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3"><Building2 className="w-4 h-4 text-slate-400" /> Company</h2>
          {company ? (
            <div className="text-sm text-slate-600 space-y-1">
              <div className="font-medium text-slate-900">{company.name}</div>
              <div>{company.industry || "—"} · {company.employee_range || "—"} employees</div>
              <div>{company.location || "—"}</div>
              {company.website && <a href={company.website} target="_blank" rel="noreferrer" className="text-blue-500 underline">{company.website}</a>}
            </div>
          ) : <p className="text-sm text-slate-400">No company data.</p>}
        </div>

        {/* Contact */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3"><User className="w-4 h-4 text-slate-400" /> Contact</h2>
          {contact ? (
            <div className="text-sm text-slate-600 space-y-1">
              <div className="font-medium text-slate-900">{contact.full_name}</div>
              <div>{contact.job_title || "—"}</div>
              {contact.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone}</div>}
              {contact.email && <div>{contact.email}</div>}
              {contact.linkedin && <a href={contact.linkedin} target="_blank" rel="noreferrer" className="text-blue-500 underline">LinkedIn</a>}
            </div>
          ) : <p className="text-sm text-slate-400">No contact data.</p>}
        </div>
      </div>

      {/* Company intelligence */}
      {intelligence && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Company intelligence</h2>
          <div className="text-sm text-slate-600 space-y-2">
            {intelligence.ai_summary && <div><span className="font-medium text-slate-700">Summary:</span> {intelligence.ai_summary}</div>}
            {intelligence.news && <div><span className="font-medium text-slate-700">News:</span> {intelligence.news}</div>}
            {intelligence.buyer_signals && <div><span className="font-medium text-slate-700">Buyer signals:</span> {intelligence.buyer_signals}</div>}
            {intelligence.tech_stack && intelligence.tech_stack.length > 0 && <div><span className="font-medium text-slate-700">Tech stack:</span> {intelligence.tech_stack.join(", ")}</div>}
          </div>
        </div>
      )}

      {/* Call history */}
      {callLogs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3"><Phone className="w-4 h-4 text-slate-400" /> Conversation timeline</h2>
          <div className="space-y-2">
            {callLogs.map((cl) => (
              <div key={cl.id} className="text-sm border-l-2 border-slate-200 pl-3 py-1">
                <div className="text-xs text-slate-400">{new Date(cl.started_at || cl.created_date).toLocaleString("en-GB")}</div>
                <div className="text-slate-700">{cl.primary_outcome || cl.outcome}</div>
                {(cl.outcome_notes || cl.notes) && <div className="text-slate-500 text-xs mt-0.5">{cl.outcome_notes || cl.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Qualification summary */}
      {opportunity && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Qualification summary</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-400">Need:</span> {opportunity.need_summary || "—"}</div>
            <div><span className="text-slate-400">Pain points:</span> {opportunity.pain_points || "—"}</div>
            <div><span className="text-slate-400">Current solution:</span> {opportunity.current_solution || "—"}</div>
            <div><span className="text-slate-400">Timing:</span> {opportunity.timing || "—"}</div>
            <div><span className="text-slate-400">Authority:</span> {opportunity.authority_status || "—"}</div>
            <div><span className="text-slate-400">Next step:</span> {opportunity.next_step || "—"}</div>
          </div>
        </div>
      )}

      {/* Campaign proposition */}
      {campaign && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Campaign proposition</h2>
          <div className="text-sm text-slate-600 space-y-1">
            <div><span className="text-slate-400">Client:</span> {campaign.client_name || "—"}</div>
            <div><span className="text-slate-400">Offer:</span> {campaign.offer || "—"}</div>
            {campaign.talking_points && <div><span className="text-slate-400">Talking points:</span> {campaign.talking_points}</div>}
            {campaign.objection_guidance && <div><span className="text-slate-400">Objection guidance:</span> {campaign.objection_guidance}</div>}
          </div>
        </div>
      )}

      {/* AI preparation summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> AI preparation summary</h2>
          <Button variant="outline" size="sm" onClick={generatePrep} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {aiSummary ? "Regenerate" : "Generate"}
          </Button>
        </div>
        {error && <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 rounded-lg p-3 mb-3"><AlertCircle className="w-4 h-4" /> {error}</div>}
        {aiSummary ? (
          <div className="text-sm text-slate-600 whitespace-pre-wrap">
            {typeof aiSummary === "string" ? aiSummary : JSON.stringify(aiSummary, null, 2)}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Click "Generate" to create an AI-powered preparation summary. This is optional and only generated on request.</p>
        )}
      </div>
    </div>
  );
}