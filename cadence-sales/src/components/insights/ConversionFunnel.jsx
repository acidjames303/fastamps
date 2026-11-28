import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export default function ConversionFunnel({ stats }) {
  const data = [
    { stage: "Attempted", value: stats.total, fill: "#64748b" },
    { stage: "Connected", value: stats.connected, fill: "#0ea5e9" },
    { stage: "Conversations", value: stats.conversations, fill: "#10b981" },
    { stage: "Decision-maker", value: stats.decisionMakers, fill: "#6366f1" },
    { stage: "Meetings", value: stats.meetings, fill: "#8b5cf6" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-900">Conversion funnel</h3>
      <p className="text-xs text-slate-400 mt-0.5">How far each dial gets.</p>

      {stats.total === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">No calls in this range yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical" margin={{ top: 12, left: 4, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="stage"
              tick={{ fontSize: 11, fill: "#475569" }}
              width={98}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
              {data.map((item) => (
                <Cell key={item.stage} fill={item.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}