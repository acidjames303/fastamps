import React from "react";
import { Phone, PhoneCall, MessageSquare, TrendingUp, Clock, Target } from "lucide-react";

// Daily performance cards for the Today workspace.
export default function TodayStats({ stats, onOpportunitiesClick, onResultsClick }) {
  if (!stats) return null;
  const cards = [
    { label: "Calls completed", value: stats.calls_completed || 0, icon: PhoneCall, accent: "text-slate-900", onClick: onResultsClick ? () => onResultsClick("completed") : null },
    { label: "Calls answered", value: stats.calls_answered || 0, icon: Phone, accent: "text-emerald-600", onClick: onResultsClick ? () => onResultsClick("answered") : null },
    { label: "Conversations", value: stats.conversations || 0, icon: MessageSquare, accent: "text-sky-600", onClick: onResultsClick ? () => onResultsClick("conversations") : null },
    { label: "Interested", value: stats.interested || 0, icon: TrendingUp, accent: "text-amber-600", onClick: onResultsClick ? () => onResultsClick("interested") : null },
    { label: "Opportunities", value: stats.opportunities || 0, icon: Target, accent: "text-violet-600", onClick: onOpportunitiesClick },
    { label: "Remaining", value: stats.remaining_tasks || 0, icon: Clock, accent: "text-slate-500" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(({ label, value, icon: Icon, accent, onClick }) => {
        const interactive = !!onClick;
        return (
          <div
            key={label}
            onClick={onClick}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            className={`rounded-2xl bg-white border border-slate-200 p-4 ${
              interactive ? "cursor-pointer hover:border-slate-400 hover:shadow-sm transition-all" : ""
            }`}
          >
            <Icon className={`w-4 h-4 ${accent} mb-2`} />
            <p className="text-2xl font-display font-semibold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        );
      })}
    </div>
  );
}