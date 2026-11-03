import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy } from 'lucide-react';

const boards = [
  { title: 'Top Installers', key: 'installs', suffix: ' installs' },
  { title: 'Top Referrers', key: 'referrals', suffix: ' referrals' },
  { title: 'Distribution Champions', key: 'distribution_wins', suffix: ' wins' },
];

export default function Leaderboard() {
  const { data: installers = [] } = useQuery({
    queryKey: ['installers'],
    queryFn: () => base44.entities.Installer.list('-installs', 100),
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Recognition</h1>
        <p className="mt-2 text-muted-foreground">People stay for recognition as much as money.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {boards.map((b) => {
          const top = [...installers].sort((a, x) => (x[b.key] || 0) - (a[b.key] || 0)).slice(0, 5);
          return (
            <div key={b.key} className="rounded-2xl border border-border bg-muted/60 p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <Trophy className="w-4 h-4 text-accent" /> {b.title}
              </div>
              <div className="mt-4 space-y-3">
                {top.map((i, idx) => (
                  <div key={i.id} className="flex items-center gap-3">
                    <span className={`w-6 text-sm ${idx === 0 ? 'text-accent' : 'text-muted-foreground/40'}`}>{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{i.full_name}</div>
                      <div className="text-xs text-muted-foreground/80">{i.region || 'Coverage area not supplied'}</div>
                    </div>
                    <div className="text-sm text-foreground">{i[b.key] || 0}<span className="text-muted-foreground/60 text-xs">{b.suffix}</span></div>
                  </div>
                ))}
                {top.length === 0 && <div className="text-sm text-muted-foreground">No installers yet.</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}