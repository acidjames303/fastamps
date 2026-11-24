import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DictateButton from "@/components/dialer/DictateButton";
import OutcomeSelect from "@/components/dialer/OutcomeSelect";
import { CheckCircle2, ChevronDown, ChevronUp, AlertTriangle, UserSearch, X } from "lucide-react";
import { OUTCOMES } from "@/lib/outcomeRules";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";

const CONVERSATION_TYPES = [
  { value: "decision_maker", label: "Decision-maker" },
  { value: "gatekeeper", label: "Gatekeeper" },
  { value: "wrong_person", label: "Wrong person" },
  { value: "other", label: "Other person" },
];

// Fast outcome capture for Dialer.
// Voice-note adjustments: notes split (client vs internal), short IR form,
// territory / AM mapping on info-requested — no auto-send.
export default function OutcomePanel({ contact, company, disabled, saving, onSave }) {
  const [outcome, setOutcome] = useState("");
  // Notes draft to this device as they are typed, per contact, so switching
  // contact or leaving the dialer never loses them. Cleared once saved.
  const {
    values: notes,
    updateField: setNote,
    restored,
    clearDraft,
  } = useDraftAutosave(contact?.id ? `call_notes_${contact.id}` : null, {
    client_notes: "",
    internal_notes: "",
    info_request_topic: "",
  });
  const clientNotes = notes.client_notes || "";
  const internalNotes = notes.internal_notes || "";
  const infoTopic = notes.info_request_topic || "";
  const [territory, setTerritory] = useState("");
  const [accountManagerName, setAccountManagerName] = useState("");
  const [accountManagerEmail, setAccountManagerEmail] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("09:00");
  const [showQualification, setShowQualification] = useState(false);
  const [qualification, setQualification] = useState({});
  const [conversationType, setConversationType] = useState("");
  const [dismissFollowUp, setDismissFollowUp] = useState(false);
  const [dismissInfoRequest, setDismissInfoRequest] = useState(false);

  useEffect(() => {
    setOutcome("");
    setTerritory(company?.territory || "");
    setAccountManagerName(company?.account_manager_name || "");
    setAccountManagerEmail(company?.account_manager_email || "");
    setFollowUpDate("");
    setFollowUpTime("09:00");
    setShowQualification(false);
    setQualification({});
    setConversationType("");
    setDismissFollowUp(false);
    setDismissInfoRequest(false);
  }, [contact?.id, company?.id, company?.territory, company?.account_manager_name, company?.account_manager_email]);

  const rule = OUTCOMES[outcome];
  const needsFollowUpDate = rule?.requires_follow_up_date;
  const isQualifiedOutcome = outcome === "connected_qualified";
  const isInfoRequest = (rule?.primary || outcome) === "connected_information_requested";
  const needsNotes = rule?.notes_required;
  const isWrongPerson = outcome === "connected_wrong_person";
  const isConnectedOutcome = rule?.category === "connected";

  const selectOutcome = (code) => {
    setOutcome(code);
    const r = OUTCOMES[code];
    if (r?.category === "connected") {
      if (code === "gatekeeper" || code === "gatekeeper_pa_screened") setConversationType("gatekeeper");
      else if (code === "connected_wrong_person" || code === "connected_contact_left") setConversationType("wrong_person");
      else setConversationType("decision_maker");
    } else {
      setConversationType("");
    }
    if (r?.requires_follow_up_date) {
      const tomorrow = new Date(Date.now() + 86400000);
      setFollowUpDate(tomorrow.toISOString().split("T")[0]);
      setFollowUpTime("09:00");
      setDismissFollowUp(false);
    }
    if (code === "connected_qualified") setShowQualification(true);
  };

  const canSave = () => {
    if (!outcome || !contact) return false;
    if (needsFollowUpDate && !followUpDate) return false;
    if (needsNotes && !clientNotes.trim() && !internalNotes.trim()) return false;

    if (isConnectedOutcome && !conversationType) return false;
    return true;
  };

  const handleSave = async () => {
    if (!canSave()) return;
    const combinedNotes = [clientNotes, internalNotes].filter(Boolean).join("\n\n").trim();
    const data = {
      outcome,
      notes: combinedNotes,
      client_notes: clientNotes || "",
      internal_notes: internalNotes || "",
      info_request_topic: isInfoRequest ? (infoTopic || "") : "",
      territory: territory || "",
      account_manager_name: accountManagerName || "",
      account_manager_email: accountManagerEmail || "",
    };
    if (isConnectedOutcome) data.conversation_type = conversationType;
    if (needsFollowUpDate && followUpDate) {
      data.next_action_at = new Date(`${followUpDate}T${followUpTime || "09:00"}:00`).toISOString();
    }
    if (isQualifiedOutcome) {
      data.qualification = {
        ...qualification,
        qualified: !!(qualification.need && qualification.next_step),
      };
    }
    const saved = await onSave(data);
    // Keep the draft if the save failed, so nothing typed is lost.
    if (saved !== false) clearDraft();
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Call outcome</label>
        <OutcomeSelect value={outcome} onChange={selectOutcome} disabled={disabled} />
      </div>

      {isConnectedOutcome && (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs text-slate-500 mb-2">Who did you speak to?</p>
          <div className="flex flex-wrap gap-1.5">
            {CONVERSATION_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setConversationType(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  conversationType === value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsFollowUpDate && !dismissFollowUp && (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">When should we call back?</p>
            <button
              type="button"
              onClick={() => setDismissFollowUp(true)}
              className="text-slate-400 hover:text-slate-700 transition-colors"
              aria-label="Close callback scheduler"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white"
            />
            <input
              type="time"
              value={followUpTime}
              onChange={(e) => setFollowUpTime(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white"
            />
          </div>
        </div>
      )}

      {isWrongPerson && (
        <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3 flex items-start gap-2">
          <UserSearch className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
          <p className="text-xs text-sky-700">
            Select the correct contact from the decision-makers list on the right, then save. A research task will be created to verify the right person.
          </p>
        </div>
      )}

      {/* Short IR form — topic + AM/territory, not the full qualification sheet */}
      {isInfoRequest && !dismissInfoRequest && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-amber-800">Info request (keep it short)</p>
            <button
              type="button"
              onClick={() => setDismissInfoRequest(true)}
              className="text-amber-600 hover:text-amber-800 transition-colors shrink-0"
              aria-label="Close info request form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="text-xs text-amber-700">What information did they ask for?</label>
            <input
              type="text"
              value={infoTopic}
              onChange={(e) => setNote("info_request_topic", e.target.value)}
              placeholder="e.g. dairy case study, pricing overview"
              className="w-full rounded-lg border border-amber-200 px-3 py-1.5 text-sm bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-amber-700">Territory</label>
              <input
                type="text"
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
                placeholder="Territory"
                className="w-full rounded-lg border border-amber-200 px-3 py-1.5 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-amber-700">Account manager</label>
              <input
                type="text"
                value={accountManagerName}
                onChange={(e) => setAccountManagerName(e.target.value)}
                placeholder="AM name"
                className="w-full rounded-lg border border-amber-200 px-3 py-1.5 text-sm bg-white"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-amber-700">AM email (optional)</label>
            <input
              type="email"
              value={accountManagerEmail}
              onChange={(e) => setAccountManagerEmail(e.target.value)}
              placeholder="am@client.com"
              className="w-full rounded-lg border border-amber-200 px-3 py-1.5 text-sm bg-white"
            />
          </div>
          <p className="text-[11px] text-amber-700">
            Saved to the admin inbox — nothing is sent automatically.
          </p>
        </div>
      )}

      {isQualifiedOutcome && (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <button
            type="button"
            onClick={() => setShowQualification(!showQualification)}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-700"
          >
            <span>Qualification details</span>
            {showQualification ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showQualification && (
            <div className="mt-3 space-y-2">
              <QualField label="Need" value={qualification.need} onChange={(v) => setQual("need", v)} placeholder="What do they need?" />
              <QualField label="Pain point" value={qualification.pain} onChange={(v) => setQual("pain", v)} placeholder="What problem are they solving?" />
              <QualField label="Current solution" value={qualification.current_solution} onChange={(v) => setQual("current_solution", v)} placeholder="What do they use today?" />
              <div className="grid grid-cols-2 gap-2">
                <QualField label="Timing" value={qualification.timing} onChange={(v) => setQual("timing", v)} placeholder="When?" />
                <QualField label="Budget" value={qualification.budget} onChange={(v) => setQual("budget", v)} placeholder="Budget?" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <QualField label="Decision maker" value={qualification.decision_maker} onChange={(v) => setQual("decision_maker", v)} placeholder="Who decides?" />
                <QualField label="Decision process" value={qualification.decision_process} onChange={(v) => setQual("decision_process", v)} placeholder="How?" />
              </div>
              <QualField label="Next step" value={qualification.next_step} onChange={(v) => setQual("next_step", v)} placeholder="Agreed next action" />
              <QualField label="Est. value (£)" value={qualification.estimated_value} onChange={(v) => setQual("estimated_value", v)} placeholder="0" type="number" />
              <p className="text-xs text-slate-400">
                {qualification.need && qualification.next_step
                  ? "Minimum fields complete — will be saved as 'qualified'."
                  : "Need and Next step are required to qualify."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Client-facing notes — go into reports / drafts */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-600">Client notes</label>
          <DictateButton value={clientNotes} onChange={(v) => setNote("client_notes", v)} />
        </div>
        {restored && (
          <p className="text-[11px] text-emerald-600 mb-1.5">Draft restored — still saving as you type.</p>
        )}
        <Textarea
          value={clientNotes}
          onChange={(e) => setNote("client_notes", e.target.value)}
          placeholder={
            isInfoRequest
              ? "What the client should see — facts only, no AI scratch…"
              : needsNotes
                ? "Client-facing notes (required)…"
                : "Client-facing call notes…"
          }
          className="rounded-2xl bg-white border-slate-200 min-h-20"
        />
      </div>

      {/* Internal / AI scratch — never in client exports */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-500">Internal notes (not for clients)</label>
          <DictateButton value={internalNotes} onChange={(v) => setNote("internal_notes", v)} />
        </div>
        <Textarea
          value={internalNotes}
          onChange={(e) => setNote("internal_notes", e.target.value)}
          placeholder="AI research, coaching reminders, internal context…"
          className="rounded-2xl bg-slate-50 border-slate-200 min-h-16"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={!canSave() || saving}
        className="rounded-full w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {saving ? (
          <span className="flex items-center"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Saving…</span>
        ) : (
          <><CheckCircle2 className="w-4 h-4 mr-2" /> Save & next</>
        )}
      </Button>

      {needsNotes && !clientNotes.trim() && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Notes are required for this outcome.
        </p>
      )}
    </div>
  );

  function setQual(field, value) {
    setQualification((prev) => ({ ...prev, [field]: value }));
  }
}

function QualField({ label, value, onChange, placeholder, type }) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type={type || "text"}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white"
      />
    </div>
  );
}