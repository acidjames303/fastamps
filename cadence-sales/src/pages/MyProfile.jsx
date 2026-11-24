import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Save, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function MyProfile() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
    base44.entities.UserProfile.filter({ user_id: user?.id }).then(p => {
      if (p && p[0]) setProfile(p[0]);
    }).catch(() => {});
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await base44.auth.updateMe({ full_name: fullName });
      if (updateUser) updateUser({ full_name: fullName });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      // error bubbles up
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (role) => {
    const map = {
      platform_owner: "Platform Owner",
      organisation_admin: "Organisation Admin",
      sales_manager: "Sales Manager",
      bdm: "Business Development Manager",
      reporting_user: "Reporting User",
    };
    return map[role] || role || "User";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">My Profile</h1>
        <p className="text-slate-500 mt-2">Your personal settings and calling identity.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <User className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{user?.full_name || user?.email}</p>
            <p className="text-sm text-slate-500">{roleLabel(profile?.app_role)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="full_name">Display name</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />
          <p className="text-xs text-slate-400">This is the name shown to your team and on call records.</p>
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled className="bg-slate-50" />
          <p className="text-xs text-slate-400">Contact your administrator to change your email.</p>
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Input value={roleLabel(profile?.app_role)} disabled className="bg-slate-50" />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving || !fullName.trim()} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}