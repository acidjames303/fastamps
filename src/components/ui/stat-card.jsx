export default function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-primary/40 transition-colors">
      <div className="text-[11px] uppercase tracking-[0.18em] text-blue-300/60">{label}</div>
      <div className={`mt-3 text-3xl font-semibold tracking-tight ${accent ? 'text-accent' : 'text-white'}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-blue-300/50">{sub}</div>}
    </div>
  );
}