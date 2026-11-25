import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus } from "lucide-react";

// Weekly review section for Pilot Console.
// Platform owners record: review date, health, feedback, actions, next review.
// Uses PilotAction for actions — does not put pilot admin into caller Today Tasks.
export default function WeeklyReviewSection({ organisationId, onSaved }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    review_date: new Date().toISOString().split("T")[0],
    pilot_health: "healthy",
    customer_feedback: "",
    usage_concerns: "",
    product_commitments: "",
    next_review_date: "",
    actions: [{ title: "", action_type: "follow_up", owner_type: "platform", priority: "normal", due_at: "" }],
  });

  const save = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("recordPilotReview", {
        organisation_id: organisationId,
        ...form,
        actions: form.actions.filter(a => a.title),
      });
      onSaved();
      setOpen(false);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  if (!open) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-slate-900">Weekly Review</h2>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <CalendarPlus className="w-4 h-4 mr-2" /> Record review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-slate-900">Record Weekly Review</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Review date</Label>
          <Input type="date" value={form.review_date} onChange={e => setForm({ ...form, review_date: e.target.value })} />
        </div>
        <div>
          <Label>Pilot health</Label>
          <Select value={form.pilot_health} onValueChange={v => setForm({ ...form, pilot_health: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["healthy", "needs_attention", "at_risk", "paused"].map(v => <SelectItem key={v} value={v}>{v.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Customer feedback</Label>
        <Textarea value={form.customer_feedback} onChange={e => setForm({ ...form, customer_feedback: e.target.value })} rows={2} />
      </div>
      <div>
        <Label>Usage concerns</Label>
        <Textarea value={form.usage_concerns} onChange={e => setForm({ ...form, usage_concerns: e.target.value })} rows={2} />
      </div>
      <div>
        <Label>Product commitments</Label>
        <Textarea value={form.product_commitments} onChange={e => setForm({ ...form, product_commitments: e.target.value })} rows={2} />
      </div>
      <div>
        <Label>Next review date</Label>
        <Input type="date" value={form.next_review_date} onChange={e => setForm({ ...form, next_review_date: e.target.value })} />
      </div>
      <div className="border-t border-slate-100 pt-3">
        <Label className="mb-2 block">Agreed actions</Label>
        {form.actions.map((a, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input placeholder="Action title" value={a.title} onChange={e => { const arr = [...form.actions]; arr[i].title = e.target.value; setForm({ ...form, actions: arr }); }} />
            <Select value={a.priority} onValueChange={v => { const arr = [...form.actions]; arr[i].priority = v; setForm({ ...form, actions: arr }); }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["urgent", "high", "normal", "low"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={a.due_at?.split("T")[0] || ""} onChange={e => { const arr = [...form.actions]; arr[i].due_at = e.target.value; setForm({ ...form, actions: arr }); }} />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setForm({ ...form, actions: [...form.actions, { title: "", action_type: "follow_up", owner_type: "platform", priority: "normal", due_at: "" }] })}>
          + Add action
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save review"}</Button>
      </div>
    </div>
  );
}