import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLocation } from "react-router-dom";

const CATEGORIES = [
  { value: "calling", label: "Calling" },
  { value: "callbacks", label: "Callbacks" },
  { value: "data_import", label: "Data / Import" },
  { value: "campaign", label: "Campaign" },
  { value: "reporting", label: "Reporting" },
  { value: "integration", label: "Integration" },
  { value: "billing", label: "Billing" },
  { value: "user_access", label: "User Access" },
  { value: "privacy", label: "Privacy" },
  { value: "performance", label: "Performance" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
];

const CRITICAL_CRITERIA = [
  "Tenant-data exposure", "Credentials exposed", "Widespread authentication failure",
  "Calls cannot be ended", "Outcomes or notes being lost", "Callbacks missing across users",
  "Incorrect external handoffs", "Billing affecting multiple customers",
];

export default function ReportProblemDialog({ open, onOpenChange }) {
  const location = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("normal");
  const [impact, setImpact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handlePriorityChange = (v) => {
    setPriority(v);
    if (v === "critical") {
      // Show criteria warning — user must confirm
    }
  };

  const handleSubmit = async () => {
    if (!title || !category) return;
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke("submitSupportRequest", {
        title, description, category, priority,
        page: location.pathname,
        browser: navigator.userAgent.split(" ").slice(-2).join(" "),
        app_version: "13.0.0",
        customer_impact: impact,
      });
      setSubmitted(true);
      setTitle(""); setDescription(""); setCategory(""); setPriority("normal"); setImpact("");
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
            <p className="font-medium text-slate-900">Report submitted</p>
            <p className="text-sm text-slate-500">We'll acknowledge it within the target response time for its priority.</p>
            <Button onClick={reset} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report a problem</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>What happened? *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief title" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what you were doing and what went wrong" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {priority === "critical" && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-2">
                  <p className="text-xs font-medium text-rose-700 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Critical is for severe issues only:</p>
                  <ul className="text-xs text-rose-600 space-y-0.5 ml-4 list-disc">
                    {CRITICAL_CRITERIA.map(c => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Impact on your work</Label>
                <Input value={impact} onChange={e => setImpact(e.target.value)} placeholder="e.g. Cannot complete calls" />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <p className="text-xs text-slate-400">Safe diagnostics (page, browser, timestamp) are included automatically. No credentials or private notes are sent.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!title || !category || submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}