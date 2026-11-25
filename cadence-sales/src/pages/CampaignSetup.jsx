import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import StepClient from "@/components/campaign/StepClient";
import StepCompanies from "@/components/campaign/StepCompanies";
import StepGuidance from "@/components/campaign/StepGuidance";
import StepAssign from "@/components/campaign/StepAssign";
import StepReview from "@/components/campaign/StepReview";

const STEPS = [
  { id: 1, label: "Client & Campaign" },
  { id: 2, label: "Target Companies" },
  { id: 3, label: "Call Guidance" },
  { id: 4, label: "Assign Team" },
  { id: 5, label: "Review & Activate" },
];

export default function CampaignSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [campaignId, setCampaignId] = useState(null);
  const [companyCount, setCompanyCount] = useState(0);

  const [form, setForm] = useState({
    name: "", client_name: "", client_reference: "", objective: "", offer: "",
    start_date: "", end_date: "", reporting_frequency: "weekly",
  });
  const [guidance, setGuidance] = useState({
    call_opener: "", talking_points: "", qualification_questions: "",
    objection_guidance: "", client_visible_summary: "",
  });

  const next = async () => {
    setError("");
    if (step === 1) {
      if (!form.name || !form.client_name || !form.start_date) {
        setError("Campaign name, client name and start date are required.");
        return;
      }
      setLoading(true);
      try {
        const payload = {
          ...form,
          status: "draft",
          organisation_id: user.organisation_id,
          owner_user_id: user.id,
          timezone: "Europe/London",
          calling_days: ["mon", "tue", "wed", "thu", "fri"],
          calling_hours: { start: "09:00", end: "17:00" },
        };
        const res = await base44.entities.Campaign.create(payload);
        setCampaignId(res.id);
        setStep(2);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    } else if (step === 2) {
      if (companyCount === 0) { setError("Add at least one company before continuing."); return; }
      setStep(3);
    } else if (step === 3) {
      if (!campaignId) return;
      setLoading(true);
      try {
        await base44.entities.Campaign.update(campaignId, guidance);
        setStep(4);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    } else if (step === 4) {
      setStep(5);
    }
  };

  const activate = async () => {
    if (!campaignId) return;
    setLoading(true); setError("");
    try {
      await base44.functions.invoke("activateCampaign", { campaign_id: campaignId });
      navigate(`/campaign-delivery/${campaignId}`);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-slate-900">New Campaign</h1>
        <p className="text-slate-500 mt-1">Set up a client campaign in five quick steps.</p>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition ${step >= s.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>{s.id}</div>
            <span className={`text-xs hidden sm:inline ${step >= s.id ? "text-slate-900 font-medium" : "text-slate-400"}`}>{s.label}</span>
            {s.id < STEPS.length && <div className={`h-px flex-1 ${step > s.id ? "bg-slate-900" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {step === 1 && <StepClient form={form} setForm={setForm} />}
        {step === 2 && <StepCompanies campaignId={campaignId} onCountChange={setCompanyCount} />}
        {step === 3 && <StepGuidance guidance={guidance} setGuidance={setGuidance} />}
        {step === 4 && <StepAssign campaignId={campaignId} />}
        {step === 5 && <StepReview campaignId={campaignId} form={form} onActivate={activate} activating={loading} />}

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-rose-600 bg-rose-50 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {step < 5 && (
          <div className="flex justify-between mt-6 pt-6 border-t border-slate-100">
            <Button variant="ghost" onClick={back} disabled={step === 1}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={next} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
        {step === 5 && (
          <div className="flex justify-between mt-6 pt-6 border-t border-slate-100">
            <Button variant="ghost" onClick={back}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}