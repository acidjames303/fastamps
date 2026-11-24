import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

// Manager/platform-owner control to reschedule overdue new_call Tasks
// across working days. Shows a preview before applying.
export default function RescheduleOverdue({ overdueCount, onApplied }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [dailyLimit, setDailyLimit] = useState(10);

  const generatePreview = async () => {
    setLoading(true);
    setError("");
    setPreview(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke("rescheduleCallQueue", {
        action: "preview",
        daily_limit: dailyLimit,
      });
      setPreview(res.data || res);
    } catch (e) {
      setError(e.message || "Could not generate preview.");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    setError("");
    try {
      const res = await base44.functions.invoke("rescheduleCallQueue", {
        action: "apply",
        daily_limit: dailyLimit,
      });
      const r = res.data || res;
      setResult(r);
      setPreview(null);
      if (onApplied) onApplied();
    } catch (e) {
      setError(e.message || "Could not apply rescheduling.");
    } finally {
      setApplying(false);
    }
  };

  if (overdueCount === 0) return null;

  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Reschedule overdue calls
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {overdueCount} overdue new-call task{overdueCount !== 1 ? "s" : ""} can be redistributed across upcoming working days.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-600 mt-3 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-sm text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Rescheduled {result.updated} task{result.updated !== 1 ? "s" : ""}{result.failed > 0 ? ` (${result.failed} failed)` : ""}.
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-slate-600">Tasks per day:</label>
        <input
          type="number"
          min="1"
          max="50"
          value={dailyLimit}
          onChange={(e) => setDailyLimit(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
          className="w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        />
        <Button
          onClick={generatePreview}
          disabled={loading}
          variant="outline"
          className="rounded-full"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
          Preview schedule
        </Button>
      </div>

      {preview && (
        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div className="flex flex-wrap gap-4 text-sm mb-3">
            <div>
              <span className="text-slate-400">Tasks: </span>
              <span className="font-semibold text-slate-900">{preview.task_count}</span>
            </div>
            <div>
              <span className="text-slate-400">Start: </span>
              <span className="font-semibold text-slate-900">{preview.start_date}</span>
            </div>
            <div>
              <span className="text-slate-400">Per day: </span>
              <span className="font-semibold text-slate-900">{preview.daily_limit}</span>
            </div>
            <div>
              <span className="text-slate-400">Days: </span>
              <span className="font-semibold text-slate-900">{preview.working_days.join(", ")}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {preview.distribution.map((d) => (
              <div key={d.date} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{d.date}</span>
                <span className="font-medium text-slate-900">{d.count} task{d.count !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={apply}
            disabled={applying}
            className="rounded-full mt-4 bg-emerald-600 hover:bg-emerald-700"
          >
            {applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirm and apply
          </Button>
        </div>
      )}
    </div>
  );
}