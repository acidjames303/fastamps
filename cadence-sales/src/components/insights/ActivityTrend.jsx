import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { tickInterval, trendCaption } from "@/lib/insightsData";

export default function ActivityTrend({ trend, range, busiest }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Activity trend</h3>
          <p className="text-xs text-slate-400 mt-0.5">{trendCaption(range)}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300" /> Dialled
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Connected
          </span>
        </div>
      </div>

      {busiest && (
        <p className="mt-2 text-[11px] text-slate-400">
          Busiest day: {busiest.day} · {busiest.count} calls
        </p>
      )}

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={trend} margin={{ top: 12, left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            interval={tickInterval(range)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip />
          <Bar dataKey="calls" name="Dialled" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="connected" name="Connected" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}