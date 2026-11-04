import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, FileCheck2, Loader2, Link2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SheetSelect from '@/components/ui/sheet-select';
import { normaliseName } from '@/lib/distributionCsv';

function fullLabel(branch) {
  return [branch.wholesaler_name, branch.branch_name].filter(Boolean).join(' · ');
}

export default function DistributionManager({ chargers, onGenerated, onRecordChanged }) {
  const queryClient = useQueryClient();
  const [newWholesaler, setNewWholesaler] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [mappingChoices, setMappingChoices] = useState({});
  const [rememberAliases, setRememberAliases] = useState({});
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const { data: directory = [] } = useQuery({
    queryKey: ['wholesaler-branch-directory'],
    queryFn: () => base44.entities.WholesalerBranch.list('-created_date', 500),
  });
  const unresolved = chargers.filter((c) => c.supplied_to_name_raw && c.distribution_match_status === 'needs_review');
  const supplied = chargers.filter((c) => c.supplied_to_name_raw);
  const pendingQr = chargers.filter((c) => c.qr_generated === false && (c.claim_status || 'available') === 'available');
  const pendingBatches = useMemo(() => {
    const groups = new Map();
    for (const c of pendingQr) {
      const key = c.batch_reference || 'No batch reference';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    return [...groups];
  }, [pendingQr]);

  const refresh = async (updated) => {
    await queryClient.invalidateQueries({ queryKey: ['admin-chargers'] });
    onRecordChanged?.(updated);
  };

  const createBranch = async (event) => {
    event.preventDefault();
    const company = newWholesaler.trim();
    const branch = newBranch.trim();
    if (!company || !branch) return;
    if (directory.some((entry) =>
      normaliseName(entry.wholesaler_name) === normaliseName(company)
      && normaliseName(entry.branch_name) === normaliseName(branch))) {
      toast.error('That wholesaler branch is already in the approved directory.');
      return;
    }
    setBusy('create');
    try {
      await base44.entities.WholesalerBranch.create({
        wholesaler_name: company, branch_name: branch, approved_aliases: [],
      });
      setNewWholesaler('');
      setNewBranch('');
      await queryClient.invalidateQueries({ queryKey: ['wholesaler-branch-directory'] });
      toast.success('Approved wholesaler branch saved. You can now link unmatched charger records to it.');
    } catch (error) {
      toast.error(error.message || 'Could not save this branch.');
    } finally {
      setBusy('');
    }
  };

  const mapCharger = async (charger) => {
    const branchId = mappingChoices[charger.id];
    const target = directory.find((entry) => entry.id === branchId);
    if (!target) { toast.error('Choose a branch from the approved directory first.'); return; }
    setBusy(charger.id);
    try {
      const alias = [charger.supplied_to_name_raw, charger.supplied_to_branch_raw].filter(Boolean).join(' ').trim();
      if (rememberAliases[charger.id] && alias) {
        const aliasKey = normaliseName(alias);
        const conflict = directory.some((entry) => entry.id !== target.id &&
          (normaliseName(`${entry.wholesaler_name} ${entry.branch_name}`) === aliasKey
          || (entry.approved_aliases || []).some((value) => normaliseName(value) === aliasKey)));
        if (conflict) throw new Error('This alias already belongs to another approved branch. Do not reassign it silently.');
        const aliases = target.approved_aliases || [];
        if (!aliases.some((value) => normaliseName(value) === aliasKey)) {
          await base44.entities.WholesalerBranch.update(target.id, {
            approved_aliases: [...aliases, alias],
          });
          await queryClient.invalidateQueries({ queryKey: ['wholesaler-branch-directory'] });
        }
      }
      const updatedFields = {
        distribution_branch_id: target.id,
        distribution_wholesaler_name: target.wholesaler_name,
        distribution_branch_name: target.branch_name,
        distribution_match_status: 'confirmed',
      };
      await base44.entities.Charger.update(charger.id, updatedFields);
      await refresh({ id: charger.id, ...updatedFields });
      toast.success(`${charger.serial_number}: mapped to ${fullLabel(target)}.`);
    } catch (error) {
      toast.error(error.message || 'Could not save this mapping.');
    } finally {
      setBusy('');
    }
  };

  const generateSavedBatch = async (batchName, items) => {
    setBusy(`generate:${batchName}`);
    setProgress({ current: 0, total: items.length });
    const completed = [];
    try {
      for (let offset = 0; offset < items.length; offset += 10) {
        const slice = items.slice(offset, offset + 10);
        const results = await Promise.all(slice.map(async (item) => {
          await base44.entities.Charger.update(item.id, { qr_generated: true });
          return { ...item, qr_generated: true };
        }));
        completed.push(...results);
        setProgress({ current: completed.length, total: items.length });
      }
      await refresh();
      onGenerated?.(batchName, completed);
      toast.success(`${completed.length} saved charger records are now ready for QR label printing.`);
    } catch (error) {
      await refresh();
      toast.error(`Some records may already be activated (${completed.length} completed). ${error.message || 'Try again after refreshing.'}`);
    } finally {
      setBusy('');
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <section className="space-y-5 rounded-3xl border border-border bg-muted/40 p-5 md:p-7">
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-accent" />
        <div>
          <h2 className="text-xl font-semibold">Optional distribution tracking</h2>
          <p className="mt-1 text-sm text-muted-foreground">Supply data is only recorded when provided. Original wholesaler and branch spellings are preserved. Uncertain matches need approval.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-2xl font-semibold">{supplied.length}</div>
          <div className="text-xs text-muted-foreground">Chargers with supplied-to details</div>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-2xl font-semibold">{unresolved.length}</div>
          <div className="text-xs text-muted-foreground">Wholesaler records needing review</div>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-2xl font-semibold">{pendingQr.length}</div>
          <div className="text-xs text-muted-foreground">Saved chargers awaiting QR labels</div>
        </div>
      </div>

      {pendingBatches.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-accent/25 bg-background p-4">
          <div className="flex items-center gap-2"><QrCode className="h-4 w-4 text-accent" /><h3 className="font-semibold">Generate labels from saved records</h3></div>
          <p className="text-xs text-muted-foreground">These chargers are saved in the register but haven't been activated for QR label printing or installer claims.</p>
          {pendingBatches.map(([name, items]) => (
            <div key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
              <div><div className="text-sm font-semibold">{name}</div><div className="text-xs text-muted-foreground">{items.length} awaiting labels</div></div>
              <Button size="sm" disabled={Boolean(busy)} onClick={() => generateSavedBatch(name, items)}>
                {busy === `generate:${name}` ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{progress.current}/{progress.total}</> : <><QrCode className="mr-2 h-4 w-4" />Activate QR labels</>}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(230px,0.85fr)_minmax(320px,1.15fr)]">
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-accent" /><h3 className="font-semibold">Approved branch directory</h3></div>
          <p className="mt-1 text-xs text-muted-foreground">Add exact company/branch names. Only exact spelling matches or explicitly approved aliases link automatically.</p>
          <form onSubmit={createBranch} className="mt-4 space-y-3">
            <Input aria-label="Canonical wholesaler" placeholder="Wholesaler, e.g. CEF" value={newWholesaler} onChange={(event) => setNewWholesaler(event.target.value)} required />
            <Input aria-label="Canonical branch" placeholder="Branch, e.g. Bedford" value={newBranch} onChange={(event) => setNewBranch(event.target.value)} required />
            <Button size="sm" disabled={Boolean(busy) || !newWholesaler.trim() || !newBranch.trim()}>
              {busy === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Add approved branch
            </Button>
          </form>
          <div className="mt-4 space-y-1">
            {directory.length === 0 ? <p className="text-xs text-muted-foreground">No directory entries yet. Imported names will remain unmatched until approved.</p>
              : directory.slice(0, 20).map((entry) => (
                <div key={entry.id} className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
                  <strong>{fullLabel(entry)}</strong>
                  {(entry.approved_aliases || []).length > 0 && <span className="ml-1 text-muted-foreground">· {(entry.approved_aliases || []).length} approved aliases</span>}
                </div>
              ))}
            {directory.length > 20 && <p className="text-xs text-muted-foreground">Showing 20 of {directory.length} approved branches.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-accent" /><h3 className="font-semibold">Review unmatched charger destinations</h3></div>
          <p className="mt-1 text-xs text-muted-foreground">CEF Bedford and CEF Bedfordshire are not assumed to be the same branch. Choose a verified branch only when you know the correct destination.</p>
          {unresolved.length === 0 ? <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" />No unresolved imports.</div>
            : <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto">
              {unresolved.slice(0, 100).map((charger) => (
                <div key={charger.id} className="rounded-xl border border-border p-3">
                  <div className="text-sm font-semibold">{charger.serial_number}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Imported: {charger.supplied_to_name_raw}{charger.supplied_to_branch_raw ? ` · ${charger.supplied_to_branch_raw}` : ''}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SheetSelect
                      className="min-w-0 flex-1"
                      aria-label={`Approved destination for ${charger.serial_number}`}
                      value={mappingChoices[charger.id] || ''}
                      onChange={(next) => setMappingChoices((state) => ({ ...state, [charger.id]: next }))}
                      placeholder="Choose correct branch"
                      options={[
                        { value: '', label: 'Choose correct branch' },
                        ...directory.map((entry) => ({ value: entry.id, label: fullLabel(entry) })),
                      ]}
                    />
                    <Button size="sm" disabled={Boolean(busy) || !mappingChoices[charger.id]} onClick={() => mapCharger(charger)}>
                      {busy === charger.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Confirm
                    </Button>
                  </div>
                  <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={Boolean(rememberAliases[charger.id])} onChange={(event) => setRememberAliases((state) => ({ ...state, [charger.id]: event.target.checked }))} />
                    Remember this exact imported spelling as an approved alias for future imports
                  </label>
                </div>
              ))}
              {unresolved.length > 100 && <p className="text-xs text-muted-foreground">Showing first 100 unmatched records. Resolve these to show the next records.</p>}
            </div>}
        </div>
      </div>
    </section>
  );
}
