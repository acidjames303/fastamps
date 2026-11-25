import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarPlus, AlertCircle } from "lucide-react";

const MEETING_TYPES = [
  { value: "discovery_call", label: "Discovery call" },
  { value: "demo", label: "Demo" },
  { value: "consultation", label: "Consultation" },
  { value: "site_visit", label: "Site visit" },
  { value: "proposal_discussion", label: "Proposal discussion" },
  { value: "other", label: "Other" },
];

const DURATIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

export default function MeetingBookingPanel({ opportunity, onBooked }) {
  const [form, setForm] = useState({
    meeting_type: "discovery_call",
    title: "",
    starts_at: "",
    duration: 60,
    location_type: "online",
    meeting_url: "",
    location: "",
    attendee_names: "",
    attendee_emails: "",
    preparation_notes: "",
    client_visible_notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (k, v) => setForm({ ...form, [k]: v });

  const book = async () => {
    if (!form.starts_at) { setError("Date and time are required."); return; }
    setLoading(true); setError("");
    try {
      const startsAt = new Date(form.starts_at).toISOString();
      const endsAt = new Date(new Date(startsAt).getTime() + form.duration * 60 * 1000).toISOString();
      await base44.functions.invoke("bookMeeting", {
        opportunity_id: opportunity.id,
        meeting_type: form.meeting_type,
        title: form.title || `Meeting: ${opportunity.name}`,
        starts_at: startsAt,
        ends_at: endsAt,
        timezone: "Europe/London",
        location_type: form.location_type,
        location: form.location,
        meeting_url: form.meeting_url,
        attendee_names: form.attendee_names ? form.attendee_names.split(",").map((s) => s.trim()).filter(Boolean) : [],
        attendee_emails: form.attendee_emails ? form.attendee_emails.split(",").map((s) => s.trim()).filter(Boolean) : [],
        preparation_notes: form.preparation_notes,
        client_visible_notes: form.client_visible_notes,
      });
      onBooked?.();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Meeting type</Label>
          <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.meeting_type} onChange={(e) => update("meeting_type", e.target.value)}>
            {MEETING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Duration</Label>
          <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.duration} onChange={(e) => update("duration", Number(e.target.value))}>
            {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder={`Meeting: ${opportunity.name}`} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Date & time *</Label>
          <Input type="datetime-local" value={form.starts_at} onChange={(e) => update("starts_at", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Location type</Label>
          <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.location_type} onChange={(e) => update("location_type", e.target.value)}>
            <option value="online">Online</option>
            <option value="phone">Phone</option>
            <option value="physical">In person</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
      </div>
      {form.location_type === "online" && (
        <div className="space-y-1.5">
          <Label>Meeting URL</Label>
          <Input value={form.meeting_url} onChange={(e) => update("meeting_url", e.target.value)} placeholder="https://meet.google.com/..." />
        </div>
      )}
      {form.location_type === "physical" && (
        <div className="space-y-1.5">
          <Label>Location</Label>
          <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="123 Main St, London" />
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Attendee names (comma-separated)</Label>
          <Input value={form.attendee_names} onChange={(e) => update("attendee_names", e.target.value)} placeholder="John Smith, Jane Doe" />
        </div>
        <div className="space-y-1.5">
          <Label>Attendee emails (comma-separated)</Label>
          <Input value={form.attendee_emails} onChange={(e) => update("attendee_emails", e.target.value)} placeholder="john@example.com, jane@example.com" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Preparation notes (internal)</Label>
        <Textarea value={form.preparation_notes} onChange={(e) => update("preparation_notes", e.target.value)} rows={2} placeholder="Notes for the caller — not shown in calendar..." />
      </div>
      <div className="space-y-1.5">
        <Label>Client-visible notes (shown in calendar)</Label>
        <Textarea value={form.client_visible_notes} onChange={(e) => update("client_visible_notes", e.target.value)} rows={2} placeholder="Safe summary for the calendar invite..." />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <Button onClick={book} disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CalendarPlus className="w-4 h-4 mr-1" />}
        Book meeting
      </Button>
    </div>
  );
}