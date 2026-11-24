import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function StepGuidance({ guidance, setGuidance }) {
  const update = (k, v) => setGuidance({ ...guidance, [k]: v });
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Call opener</Label>
        <Textarea value={guidance.call_opener} onChange={(e) => update("call_opener", e.target.value)} rows={2} placeholder="Hi [name], I'm calling from [company] about..." />
      </div>
      <div className="space-y-1.5">
        <Label>Talking points</Label>
        <Textarea value={guidance.talking_points} onChange={(e) => update("talking_points", e.target.value)} rows={4} placeholder="Key points to cover during the call..." />
      </div>
      <div className="space-y-1.5">
        <Label>Qualification questions</Label>
        <Textarea value={guidance.qualification_questions} onChange={(e) => update("qualification_questions", e.target.value)} rows={3} placeholder="Discovery questions to qualify the prospect..." />
      </div>
      <div className="space-y-1.5">
        <Label>Objection guidance</Label>
        <Textarea value={guidance.objection_guidance} onChange={(e) => update("objection_guidance", e.target.value)} rows={3} placeholder="How to handle likely objections..." />
      </div>
      <div className="space-y-1.5">
        <Label>Client-visible summary</Label>
        <Textarea value={guidance.client_visible_summary} onChange={(e) => update("client_visible_summary", e.target.value)} rows={2} placeholder="Short proposition safe to include in client reports..." />
      </div>
    </div>
  );
}