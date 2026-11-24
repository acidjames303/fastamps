import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { getQualificationState, canSubmitForReview, getMissingRequiredFields } from "@/lib/qualificationRules";

const AUTHORITY_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "influencer", label: "Influencer" },
  { value: "decision_maker", label: "Decision maker" },
  { value: "economic_buyer", label: "Economic buyer" },
  { value: "technical_buyer", label: "Technical buyer" },
  { value: "end_user", label: "End user" },
  { value: "gatekeeper", label: "Gatekeeper" },
  { value: "champion", label: "Champion" },
];

export default function QualificationPanel({ opportunity, onSaved }) {
  const [form, setForm] = useState({
    need_summary: opportunity.need_summary || "",
    pain_points: opportunity.pain_points || "",
    current_solution: opportunity.current_solution || "",
    business_impact: opportunity.business_impact || "",
    timing: opportunity.timing || "",
    budget_status: opportunity.budget_status || "",
    authority_status: opportunity.authority_status || "unknown",
    decision_process: opportunity.decision_process || "",
    decision_makers: opportunity.decision_makers || "",
    next_step: opportunity.next_step || "",
    estimated_value: opportunity.estimated_value || 0,
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (k, v) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true); setError("");
    try {
      const state = getQualificationState({ ...opportunity, ...form });
      await base44.entities.Opportunity.update(opportunity.id, {
        ...form,
        qualification_status: state,
        updated_at: new Date().toISOString(),
      });
      onSaved?.();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const submitForReview = async () => {
    setSubmitting(true); setError("");
    try {
      await base44.functions.invoke("manageOpportunityReview", {
        opportunity_id: opportunity.id,
        action: "submit",
      });
      onSaved?.();
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  };

  const state = getQualificationState({ ...opportunity, ...form });
  const canSubmit = canSubmitForReview({ ...opportunity, ...form });
  const missing = getMissingRequiredFields({ ...opportunity, ...form });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          state === "qualified" ? "bg-emerald-50 text-emerald-600" :
          state === "qualifying" ? "bg-amber-50 text-amber-600" :
          "bg-slate-100 text-slate-500"
        }`}>
          {state === "incomplete" ? "Incomplete" : state === "qualifying" ? "Qualifying" : state === "qualified" ? "Qualified" : "Disqualified"}
        </span>
        {state !== "qualified" && missing.length > 0 && (
          <span className="text-xs text-slate-400">
            Missing: {missing.join(", ").replace(/_/g, " ")}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>What do they need?</Label>
        <Textarea value={form.need_summary} onChange={(e) => update("need_summary", e.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label>Current problem / pain points</Label>
        <Textarea value={form.pain_points} onChange={(e) => update("pain_points", e.target.value)} rows={2} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Current solution</Label>
          <Input value={form.current_solution} onChange={(e) => update("current_solution", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Business impact</Label>
          <Input value={form.business_impact} onChange={(e) => update("business_impact", e.target.value)} />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Timing / urgency</Label>
          <Input value={form.timing} onChange={(e) => update("timing", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Budget status</Label>
          <Input value={form.budget_status} onChange={(e) => update("budget_status", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Authority status</Label>
          <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.authority_status} onChange={(e) => update("authority_status", e.target.value)}>
            {AUTHORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Decision process</Label>
          <Textarea value={form.decision_process} onChange={(e) => update("decision_process", e.target.value)} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Decision makers / stakeholders</Label>
          <Textarea value={form.decision_makers} onChange={(e) => update("decision_makers", e.target.value)} rows={2} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Agreed next step</Label>
          <Input value={form.next_step} onChange={(e) => update("next_step", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Estimated value (GBP)</Label>
          <Input type="number" value={form.estimated_value} onChange={(e) => update("estimated_value", Number(e.target.value))} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save
        </Button>
        {opportunity.manager_review_status === "not_submitted" && (
          <Button onClick={submitForReview} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Submit for review
          </Button>
        )}
        {opportunity.manager_review_status === "awaiting_review" && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Awaiting manager review
          </span>
        )}
      </div>
    </div>
  );
}