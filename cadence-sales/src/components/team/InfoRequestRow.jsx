import React from "react";
import { Button } from "@/components/ui/button";
import { Mail, CalendarDays } from "lucide-react";

const formatDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export default function InfoRequestRow({ item, onDraft, onDone }) {
  const raised = formatDate(item.created_date);
  const due = formatDate(item.due_at || item.next_action_at);

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-start gap-3 hover:bg-slate-50/70 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium text-slate-900 truncate">
            {item.company_name || "Company"} · {item.contact_name || "Contact"}
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            <CalendarDays className="w-3 h-3" />
            {raised || "No date"}
          </span>
          {due && <span className="text-[11px] text-amber-700">Due {due}</span>}
        </div>

        <p className="text-xs text-slate-500 mt-1 truncate">
          {item.caller_name}
          {item.campaign_name ? ` · ${item.campaign_name}` : ""}
          {item.info_request_topic ? ` · ${item.info_request_topic}` : ""}
        </p>

        {item.client_notes && (
          <p className="text-sm text-slate-600 mt-2 line-clamp-3 whitespace-pre-wrap">{item.client_notes}</p>
        )}
      </div>

      <div className="flex gap-2 shrink-0">
        <Button type="button" size="sm" className="rounded-full" onClick={() => onDraft(item)}>
          <Mail className="w-3.5 h-3.5 mr-1" /> Draft email
        </Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => onDone(item.task_id)}>
          Done
        </Button>
      </div>
    </div>
  );
}