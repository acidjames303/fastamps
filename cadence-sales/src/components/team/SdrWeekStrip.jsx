import React from "react";

// Seven days of this caller's dialling, in the same shape as the rest of the
// manager views: calls as the bar, conversations as the filled part.
export default function SdrWeekStrip({ daily = [] }) {
  const peak = Math.max(1, ...daily.map((d) => d.calls || 0));
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-slate-900">Last 7 days</h2>
        <p className="text-[11px] text-slate-400">Calls · conversations</p>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {daily.map((d) => {
          const height = Math.round(((d.calls || 0) / peak) * 64);
          const filled = d.calls ? Math.round((d.conversations / d.calls) * height) : 0;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <div className="flex h-16 w-full items-end justify-center">
                <div
                  className="relative w-6 rounded-t-md bg-slate-200"
                  style={{ height: `${Math.max(height, d.calls ? 6 : 2)}px` }}
                  title={`${d.calls} calls, ${d.conversations} conversations`}
                >
                  <div className="absolute bottom-0 left-0 w-full rounded-t-md bg-emerald-500" style={{ height: `${filled}px` }} />
                </div>
              </div>
              <span className="text-[10px] text-slate-400">{d.label}</span>
              <span className="text-[11px] font-medium text-slate-600">{d.calls}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}