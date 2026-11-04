import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, CircleDashed, CircleX, LockKeyhole, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { Button } from '@/components/ui/button';
import SheetSelect from '@/components/ui/sheet-select';
import { QA_TESTS, QA_GROUPS, QA_CREATED } from '@/lib/qaScenarios';

const STATUS = {
  not_tested: { label: 'Not tested', Icon: CircleDashed, css: 'text-muted-foreground' },
  passed: { label: 'Passed', Icon: CheckCircle2, css: 'text-emerald-600 dark:text-emerald-300' },
  failed: { label: 'Failed', Icon: CircleX, css: 'text-red-600 dark:text-red-300' },
  blocked: { label: 'Blocked', Icon: LockKeyhole, css: 'text-amber-700 dark:text-amber-300' },
};

const defaultStatus = 'not_tested';

function TestRow({ scenario, saved, userEmail, onSaved }) {
  const [status, setStatus] = useState(saved?.status || defaultStatus);
  const [notes, setNotes] = useState(saved?.tester_notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setStatus(saved?.status || defaultStatus);
    setNotes(saved?.tester_notes || '');
  }, [saved?.status, saved?.tester_notes, saved?.id]);
  const current = STATUS[saved?.status || 'not_tested'];
  const Icon = current.Icon;
  const dirty = status !== (saved?.status || defaultStatus) || notes !== (saved?.tester_notes || '');
  const save = async (event) => {
    event.preventDefault();
    if (status === 'passed' && notes.trim().length < 6) {
      setError('Add brief evidence before marking this test as passed.');
      return;
    }
    if (['failed', 'blocked'].includes(status) && notes.trim().length < 6) {
      setError('Record the issue or blocker so it can be followed up.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Resolve the most recent record before an update, avoiding a stale cached id.
      const matches = await base44.entities.QaTestResult.filter({ scenario_id: scenario.id });
      const data = {
        scenario_id: scenario.id, status,
        tester_notes: notes.trim(),
        last_tested_by: userEmail,
        last_tested_at: new Date().toISOString(),
      };
      if (matches.length) await base44.entities.QaTestResult.update(matches[0].id, data);
      else await base44.entities.QaTestResult.create(data);
      await onSaved();
      toast.success(`${scenario.id} saved as ${STATUS[status].label.toLowerCase()}.`);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Test result could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="group rounded-xl border border-border bg-background/70 p-4">
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${current.css}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{scenario.id}</span>
            {scenario.priority === 'critical' && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Critical</span>}
          </div>
          <div className="mt-1 text-sm font-semibold">{scenario.title}</div>
          <div className={`mt-1 text-xs ${current.css}`}>{current.label}{saved?.last_tested_at ? ` · updated ${new Date(saved.last_tested_at).toLocaleDateString('en-GB')}` : ''}</div>
        </div>
        <span className="mt-0.5 text-xs text-muted-foreground group-open:rotate-180">▼</span>
      </summary>
      <form onSubmit={save} className="mt-4 space-y-3 border-t border-border/70 pt-4">
        <div className="rounded-lg bg-muted/60 p-3 text-xs leading-5">
          <strong>Test:</strong> {scenario.steps}
          <div className="mt-2"><strong>Pass criteria:</strong> {scenario.expected}</div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="w-full shrink-0 sm:w-44">
            <SheetSelect
              label="Test result"
              value={status}
              onChange={(next) => { setStatus(next); setError(''); }}
              options={Object.entries(STATUS).map(([value, valueMeta]) => ({ value, label: valueMeta.label }))}
            />
          </div>
          <label className="min-w-0 flex-1 text-xs font-medium">Tester notes / evidence
            <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setError(''); }}
              rows={3} maxLength={2500}
              placeholder="Device, date, tester, pass evidence or bug details. For fails, describe how to reproduce…"
              className="mt-1 block w-full rounded-lg border border-border bg-background p-3 text-sm"/>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{saved?.last_tested_by ? `Last reviewed by ${saved.last_tested_by}` : 'No test evidence recorded yet'}</span>
          <Button size="sm" type="submit" disabled={saving || !dirty}>
            <Save className="mr-1.5 h-4 w-4"/>{saving ? 'Saving…' : 'Save result'}
          </Button>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </form>
    </details>
  );
}

export default function AdminQaChecklist() {
  const { data: identity, isLoading: checking } = useInstaller();
  const admin = identity?.user?.role === 'admin';
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [priority, setPriority] = useState('all');
  const { data: results = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['fastamps-v1-qa-results'], enabled: admin,
    queryFn: async () => {
      const all = [];
      for (let offset = 0; offset < 5000; offset += 500) {
        const batch = await base44.entities.QaTestResult.list('-created_date', 500, offset);
        all.push(...batch);
        if (batch.length < 500) break;
      }
      return all;
    },
  });
  const resultsById = useMemo(() => new Map(results.map(row => [row.scenario_id, row])), [results]);
  const counts = Object.fromEntries(Object.keys(STATUS).map(status =>
    [status, QA_TESTS.filter(t => (resultsById.get(t.id)?.status || defaultStatus) === status).length]));
  const relevant = QA_TESTS.filter(t => (filter === 'all' || (resultsById.get(t.id)?.status || defaultStatus) === filter) &&
    (priority === 'all' || t.priority === priority));
  const passed = counts.passed || 0;
  const passRate = Math.round((passed / QA_TESTS.length) * 100);

  if (checking) return <p className="text-sm text-muted-foreground">Loading QA checklist…</p>;
  if (!admin) return <div className="rounded-xl border border-border p-6">Only FastAmps admins can view or update the test register.</div>;
  return (
    <main className="space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">FastAmps Connect · V1 quality assurance</div>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold"><ClipboardCheck className="h-7 w-7 text-accent"/>Feature testing checklist</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Persistent testing register created {QA_CREATED}. Test results, evidence and blockers are saved for the FastAmps admin team. All newly added tests begin as Not tested; a successful build alone is not proof they passed.
        </p>
      </header>
      <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm">
        <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"/>
          <p><strong>Testing safety:</strong> Use dedicated beta installers, demo chargers and Giftbit testbed/manual simulations. Do not send production rewards or mark live vouchers as issued. Before enabling live payouts, have FastAmps approve programme terms and run an end-to-end fraud check.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[['Total', QA_TESTS.length, 'text-foreground'], ['Passed', counts.passed, 'text-emerald-600 dark:text-emerald-300'],
          ['Not tested', counts.not_tested, 'text-muted-foreground'], ['Failed', counts.failed, 'text-red-600 dark:text-red-300'],
          ['Blocked', counts.blocked, 'text-amber-700 dark:text-amber-300']].map(([label,value,color]) =>
          <div key={label} className="rounded-xl border border-border bg-muted/50 p-3">
            <div className={`text-2xl font-semibold ${color}`}>{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
          </div>)}
      </div>
      <div className="rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm">V1 test completion</strong>
          <span className="text-sm font-semibold tabular-nums">{passed}/{QA_TESTS.length} passed · {passRate}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="V1 tests passed" aria-valuenow={passed} aria-valuemax={QA_TESTS.length} aria-valuemin={0}>
          <div className="h-full rounded-full bg-emerald-600" style={{width:`${passRate}%`}} />
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <Button variant="outline" size="sm" asChild><Link to="/admin/beta-test">Open home beta test</Link></Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}/>Refresh results</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <SheetSelect
          className="w-44"
          label="Status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All statuses' },
            ...Object.entries(STATUS).map(([key, data]) => ({ value: key, label: data.label })),
          ]}
        />
        <SheetSelect
          className="w-44"
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={[
            { value: 'all', label: 'All priorities' },
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
          ]}
        />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading saved results…</p> : QA_GROUPS.map(group => {
        const scenarios = relevant.filter(test => test.group === group.id);
        if (!scenarios.length) return null;
        const done = QA_TESTS.filter(test => test.group === group.id && resultsById.get(test.id)?.status === 'passed').length;
        const total = QA_TESTS.filter(test => test.group === group.id).length;
        return (
          <section key={group.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2">
              <div><h2 className="text-lg font-semibold">{group.title}</h2><p className="mt-1 text-xs text-muted-foreground">{group.detail}</p></div>
              <div className="text-xs text-muted-foreground">{done}/{total} passed</div>
            </div>
            {scenarios.map(scenario => <TestRow key={scenario.id} scenario={scenario} saved={resultsById.get(scenario.id)}
              userEmail={identity.user.email} onSaved={() => qc.invalidateQueries({ queryKey: ['fastamps-v1-qa-results'] })} />)}
          </section>
        );
      })}
      <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
        Need to record a new bug or an additional test? Use the closest scenario’s notes, or add a new scenario to this register in Base44. The checklist is separate from production rewards and does not create real charges, referral credits or vouchers.
      </p>
    </main>
  );
}
