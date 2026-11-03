import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import OpportunityCard from '@/components/OpportunityCard';

const filters = ['all', 'development', 'distribution', 'commercial', 'lead'];

export default function Opportunities() {
  const qc = useQueryClient();
  const { data } = useInstaller();
  const installer = data?.installer;
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opps'],
    queryFn: () => base44.entities.Opportunity.list('-created_date', 60),
  });

  const accept = async (o) => {
    if (!installer) return;
    setBusy(true);
    setError('');
    try {
      const response = await base44.functions.invoke('accept-opportunity', { opportunity_id: o.id });
      if (response?.data?.error) throw new Error(response.data.error);
      await qc.invalidateQueries({ queryKey: ['opps'] });
    } catch (err) {
      setError(err?.message || 'Could not accept this opportunity.');
    } finally {
      setBusy(false);
    }
  };

  const list = opportunities.filter((o) => filter === 'all' || o.type === filter);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Opportunity marketplace</h1>
        <p className="mt-2 text-muted-foreground">Developments, merchants and commercial sites — every opportunity has a value attached.</p>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs uppercase tracking-[0.15em] border transition-colors ${filter === f ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Loading…</div> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} onAccept={accept} busy={busy} mine={o.accepted_by === installer?.mobile} />
          ))}
        </div>
      )}
      {!isLoading && list.length === 0 && <div className="text-sm text-muted-foreground">Nothing here yet.</div>}
    </div>
  );
}
