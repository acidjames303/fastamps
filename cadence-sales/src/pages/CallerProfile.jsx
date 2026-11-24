import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, CheckCircle2, User, Bell, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import EmailMailboxConnect from "@/components/email/EmailMailboxConnect";

const DEFAULT_NOTIFS = { email_call_summary: true, callback_reminders: true, daily_digest: false };
const DEFAULT_BRIEFING = { focus_areas: "", tone: "concise", include_signals: true };

export default function CallerProfile() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [dailyTarget, setDailyTarget] = useState(0);
  const [agentNumber, setAgentNumber] = useState("");
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFS);
  const [briefing, setBriefing] = useState(DEFAULT_BRIEFING);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (user?.full_name) setFullName(user.full_name);
      if (!user?.id) return;
      try {
        const p = await base44.entities.UserProfile.filter({ user_id: user.id });
        if (p && p[0]) {
          setProfile(p[0]);
          setJobTitle(p[0].job_title || "");
          setDailyTarget(p[0].daily_call_target || 0);
          setAgentNumber(p[0].telephony_identity || "");
          setNotifications({ ...DEFAULT_NOTIFS, ...(p[0].notification_preferences || {}) });
          setBriefing({ ...DEFAULT_BRIEFING, ...(p[0].briefing_customization || {}) });
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      if (fullName !== user.full_name) {
        await base44.auth.updateMe({ full_name: fullName });
        if (updateUser) updateUser({ full_name: fullName });
      }
      const payload = {
        job_title: jobTitle,
        daily_call_target: Number(dailyTarget) || 0,
        telephony_identity: agentNumber,
        notification_preferences: notifications,
        briefing_customization: briefing,
      };
      if (profile) {
        await base44.entities.UserProfile.update(profile.id, payload);
      } else {
        await base44.functions.invoke('provisionUser', {});
        const restored = await base44.entities.UserProfile.filter({ user_id: user.id });
        if (!restored[0]) throw new Error('Your profile is not provisioned. Ask the platform owner to review it.');
        await base44.entities.UserProfile.update(restored[0].id, payload);
        setProfile(restored[0]);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {} finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">Caller Profile</h1>
        <p className="text-slate-500 mt-2">Your personal info, notifications and AI briefing preferences.</p>
      </div>

      {/* Personal information */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold"><User className="w-4 h-4" /> Personal information</div>
        <div className="space-y-2">
          <Label htmlFor="full_name">Display name</Label>
          <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job_title">Job title</Label>
          <Input id="job_title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior BDM" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="daily_target">Daily call target</Label>
            <Input id="daily_target" type="number" min="0" value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent_number">Your phone number (for click-to-dial)</Label>
            <Input id="agent_number" type="tel" value={agentNumber} onChange={(e) => setAgentNumber(e.target.value)} placeholder="e.g. 01923 729132" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <EmailMailboxConnect />
      </div>

      {/* Notification preferences */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold"><Bell className="w-4 h-4" /> Notification preferences</div>
        <ToggleRow
          label="Email call summaries"
          description="Receive a summary of your calls after each session."
          checked={notifications.email_call_summary}
          onChange={(v) => setNotifications((n) => ({ ...n, email_call_summary: v }))}
        />
        <ToggleRow
          label="Callback reminders"
          description="Get reminded about scheduled callbacks before they're due."
          checked={notifications.callback_reminders}
          onChange={(v) => setNotifications((n) => ({ ...n, callback_reminders: v }))}
        />
        <ToggleRow
          label="Daily digest"
          description="A single end-of-day summary instead of individual alerts."
          checked={notifications.daily_digest}
          onChange={(v) => setNotifications((n) => ({ ...n, daily_digest: v }))}
        />
      </div>

      {/* AI briefing customization */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold"><Sparkles className="w-4 h-4" /> AI briefing customization</div>
        <div className="space-y-2">
          <Label htmlFor="focus_areas">Focus areas</Label>
          <Textarea
            id="focus_areas"
            value={briefing.focus_areas}
            onChange={(e) => setBriefing((b) => ({ ...b, focus_areas: e.target.value }))}
            placeholder="What should briefings emphasise? e.g. recent funding, tech stack, buying signals…"
            className="min-h-20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tone">Briefing tone</Label>
          <select
            id="tone"
            value={briefing.tone}
            onChange={(e) => setBriefing((b) => ({ ...b, tone: e.target.value }))}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="concise">Concise — quick scan</option>
            <option value="detailed">Detailed — full context</option>
            <option value="conversational">Conversational — talk-track ready</option>
          </select>
        </div>
        <ToggleRow
          label="Include buying signals"
          description="Surface triggers like news, hires and funding in briefings."
          checked={briefing.include_signals}
          onChange={(v) => setBriefing((b) => ({ ...b, include_signals: v }))}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !fullName.trim()} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}