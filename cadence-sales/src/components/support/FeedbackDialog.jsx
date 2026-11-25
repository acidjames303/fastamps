import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLocation } from "react-router-dom";

const FEEDBACK_TYPES = [
  { value: "confusion", label: "I was confused" },
  { value: "friction", label: "Something was slow or hard" },
  { value: "missing_capability", label: "Missing a feature" },
  { value: "improvement", label: "I have an idea" },
  { value: "positive_feedback", label: "This works well" },
  { value: "bug", label: "Something is broken" },
  { value: "other", label: "Other" },
];

export default function FeedbackDialog({ open, onOpenChange }) {
  const location = useLocation();
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!title || !type) return;
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke("submitFeedback", {
        feedback_type: type,
        title,
        description,
        page: location.pathname,
        expected_behaviour: expected,
        current_behaviour: actual,
      });
      setSubmitted(true);
      setType(""); setTitle(""); setDescription(""); setExpected(""); setActual("");
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => { setSubmitted(false); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="font-medium text-slate-900">Feedback recorded</p>
            <p className="text-sm text-slate-500">Thank you — this will be reviewed during product planning.</p>
            <Button onClick={reset} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Give feedback</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>What kind of feedback? *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{FEEDBACK_TYPES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief summary" />
              </div>
              <div className="space-y-1.5">
                <Label>What were you trying to do?</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>What did you expect?</Label>
                  <Textarea value={expected} onChange={e => setExpected(e.target.value)} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>What happened instead?</Label>
                  <Textarea value={actual} onChange={e => setActual(e.target.value)} rows={2} />
                </div>
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!title || !type || submitting}>{submitting ? "Submitting…" : "Submit feedback"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}