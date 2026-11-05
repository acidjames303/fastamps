import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Calendar, Loader2, Mail, MessageSquare, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl } from '@/lib/utils';

const ICONS = {
  meeting: Calendar,
  email: Mail,
  async_message: MessageSquare,
};

export default function History() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('list-decisions', {});
      const decisions = result?.decisions || result?.data?.decisions || [];
      setRows(Array.isArray(decisions) ? decisions : []);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const meetings = rows.filter((r) => r.recommendation === 'meeting').length;
    const emails = rows.filter((r) => r.recommendation === 'email').length;
    const asyncCount = rows.filter((r) => r.recommendation === 'async_message').length;
    const meetingsAvoided = emails + asyncCount;
    return { total: rows.length, meetings, emails, asyncCount, meetingsAvoided };
  }, [rows]);

  const archive = async (id) => {
    try {
      await base44.functions.invoke('archive-decision', { id });
      toast.success('Decision archived');
      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Failed to archive decision');
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">History</h1>
          <p className="mt-2 text-slate-600">Review your past communication recommendations</p>
        </div>
        <Link to={createPageUrl('NewDecision')}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Find Your Cadence
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-slate-600">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading history…
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">Total</p><p className="text-2xl font-bold text-slate-900">{stats.total}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">Meetings</p><p className="text-2xl font-bold text-slate-900">{stats.meetings}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">Emails</p><p className="text-2xl font-bold text-slate-900">{stats.emails}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">Async</p><p className="text-2xl font-bold text-slate-900">{stats.asyncCount}</p></CardContent></Card>
          </div>

          {stats.total >= 3 && (
            <Card className="mb-8 border-emerald-200 bg-emerald-50">
              <CardContent className="flex items-center gap-3 pt-6 text-emerald-900">
                <Sparkles className="h-5 w-5" />
                <p>
                  Your communication efficiency: you have steered {stats.meetingsAvoided} decisions away from meetings so far.
                </p>
              </CardContent>
            </Card>
          )}

          {rows.length === 0 ? (
            <Card>
              <CardContent className="space-y-4 py-12 text-center">
                <p className="text-slate-600">No saved decisions yet.</p>
                <Link to={createPageUrl('NewDecision')}>
                  <Button className="bg-blue-600 hover:bg-blue-700">Start your first cadence</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => {
                const Icon = ICONS[row.recommendation] || Calendar;
                return (
                  <Card key={row.id}>
                    <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
                      <div className="flex gap-3">
                        <div className="rounded-lg bg-slate-100 p-3 text-slate-700">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{row.title}</h3>
                          <p className="mt-1 text-sm text-slate-600">{row.rationale}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-slate-100 px-2 py-1">{row.recommendation}</span>
                            {row.confidence_score ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                                {row.confidence_score}% confidence
                              </span>
                            ) : null}
                            {Array.isArray(row.decision_type) && row.decision_type.length > 0 ? (
                              <span className="rounded-full bg-slate-100 px-2 py-1">{row.decision_type.join(', ')}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => archive(row.id)}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
