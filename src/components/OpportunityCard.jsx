import { MapPin, Building2, Store, Briefcase, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const meta = {
  development: { icon: Building2, label: 'Development' },
  distribution: { icon: Store, label: 'Distribution' },
  commercial: { icon: Briefcase, label: 'Commercial' },
  lead: { icon: Users, label: 'Lead' },
  referral: { icon: Users, label: 'Referral' },
};

export default function OpportunityCard({ opportunity, onAccept, busy, mine }) {
  const { icon: Icon, label } = meta[opportunity.type] || meta.lead;
  const accepted = opportunity.status !== 'open';

  return (
    <div className="rounded-2xl border border-border bg-muted/60 p-5 flex flex-col hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <Icon className="w-4 h-4 text-accent" /> {label}
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-accent leading-none">£{opportunity.reward}</div>
          <div className="text-[10px] text-muted-foreground/80 mt-1">reward</div>
        </div>
      </div>

      <h3 className="mt-4 text-lg font-semibold tracking-tight">{opportunity.title}</h3>
      {opportunity.description && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{opportunity.description}</p>}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground/80">
        {opportunity.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{opportunity.location}</span>}
        {opportunity.distance_miles != null && <span>{opportunity.distance_miles} miles</span>}
        {opportunity.potential_value ? <span>Potential value £{opportunity.potential_value.toLocaleString()}</span> : null}
      </div>

      <div className="mt-5 pt-4 border-t border-border">
        {accepted ? (
          <div className="text-xs text-muted-foreground/80">{mine ? 'Accepted by you — sales team following up' : 'Claimed'}</div>
        ) : (
          <Button disabled={busy} onClick={() => onAccept(opportunity)} className="w-full bg-primary text-white hover:bg-primary/80 font-semibold">
            Accept opportunity
          </Button>
        )}
      </div>
    </div>
  );
}