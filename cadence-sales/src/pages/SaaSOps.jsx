import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Building2, Users, Zap, MessageSquare, AlertTriangle, Activity, Shield, CheckCircle2 } from 'lucide-react';

const STATUS_TONES = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-600',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-amber-100 text-amber-700',
  grace_period: 'bg-orange-100 text-orange-700',
  none: 'bg-slate-200 text-slate-600',
};

const SEVERITY_TONES = {
  critical: 'bg-red-100 text-red-700',
  error: 'bg-amber-100 text-amber-700',
  warning: 'bg-yellow-100 text-yellow-700',
  info: 'bg-blue-100 text-blue-700',
};

function CreditMeter({ label, used, allowance, threshold, icon: Icon }) {
  const pct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  const tone = threshold === 'emergency' ? 'text-red-600' : threshold === 'critical' ? 'text-orange-600' : threshold === 'warning' ? 'text-amber-600' : 'text-slate-700';
  const barTone = threshold === 'emergency' ? '[&>div]:bg-red-500' : threshold === 'critical' ? '[&>div]:bg-orange-500' : threshold === 'warning' ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500';
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Icon className="w-4 h-4" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between mb-2">
          <span className={'text-2xl font-semibold ' + tone}>{pct}%</span>
          <span className="text-sm text-slate-500">{used.toLocaleString()} / {allowance.toLocaleString()}</span>
        </div>
        <Progress value={pct} className={'h-2 ' + barTone} />
        {threshold !== 'normal' && (
          <p className={'text-xs mt-2 ' + tone}>
            {threshold === 'emergency' && 'Emergency threshold reached — high-cost features restricted.'}
            {threshold === 'critical' && 'Critical threshold — approaching credit limit.'}
            {threshold === 'warning' && 'Warning — usage above 70% of allowance.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SaaSOps() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getSaaSOps', {});
      setData(res.data || res);
    } catch (err) {
      setError(err.message || 'Failed to load operations data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
        <p className="text-slate-600 mb-4">{error}</p>
        <Button onClick={loadData} variant="outline">Try again</Button>
      </div>
    );
  }

  const { summary, credits, organisations = [], recent_events = [] } = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">SaaS Operations</h1>
        <p className="text-sm text-slate-500 mt-1">Platform health, usage, and organisation management</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Active Orgs', value: summary?.active || 0, icon: Building2, tone: 'text-emerald-600' },
          { label: 'Trialing', value: summary?.trialing || 0, icon: Activity, tone: 'text-blue-600' },
          { label: 'Paying', value: summary?.paying || 0, icon: Shield, tone: 'text-slate-700' },
          { label: 'Active Users', value: summary?.total_active_users || 0, icon: Users, tone: 'text-slate-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{label}</span>
                <Icon className={'w-4 h-4 ' + tone} />
              </div>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform Credit Estimates */}
      <div>
        <h2 className="text-sm font-medium text-slate-500 mb-3">Platform Credit Estimates</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {credits && (
            <>
              <CreditMeter
                label="Integration Credits"
                used={credits.integration_credits.used}
                allowance={credits.integration_credits.allowance}
                threshold={credits.integration_credits.threshold}
                icon={Zap}
              />
              <CreditMeter
                label="Message Credits"
                used={credits.message_credits.used}
                allowance={credits.message_credits.allowance}
                threshold={credits.message_credits.threshold}
                icon={MessageSquare}
              />
            </>
          )}
        </div>
        {credits?.is_estimate && (
          <p className="text-xs text-slate-400 mt-2">Values are estimates based on configurable conversion factors. Actual Base44 credit consumption may vary.</p>
        )}
      </div>

      {/* Organisations */}
      <Card>
        <CardHeader><CardTitle className="text-base">Organisations</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Organisation</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Sub Status</th>
                  <th className="pb-2 font-medium text-right">Users</th>
                  <th className="pb-2 font-medium text-right">Usage</th>
                  <th className="pb-2 font-medium">Period End</th>
                </tr>
              </thead>
              <tbody>
                {organisations.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 font-medium text-slate-900">{o.name}</td>
                    <td><Badge className={STATUS_TONES[o.status] || STATUS_TONES.none}>{o.status}</Badge></td>
                    <td className="text-slate-600">{o.plan_code}</td>
                    <td><Badge className={STATUS_TONES[o.subscription_status] || STATUS_TONES.none}>{o.subscription_status.replace(/_/g, ' ')}</Badge></td>
                    <td className="text-right text-slate-600">{o.active_users}</td>
                    <td className="text-right text-slate-600">{o.total_usage}</td>
                    <td className="text-slate-500 text-xs">
                      {o.current_period_end ? new Date(o.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
                {organisations.length === 0 && (
                  <tr><td colSpan="7" className="py-8 text-center text-slate-400">No organisations found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Operational Events */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Events</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recent_events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                <Badge className={SEVERITY_TONES[e.severity] || SEVERITY_TONES.info}>{e.severity}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{e.safe_message}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {e.category} · {e.source_function || 'system'} · {e.occurred_at ? new Date(e.occurred_at).toLocaleString('en-GB') : ''}
                  </p>
                </div>
                {e.resolved_at && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
            ))}
            {recent_events.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No recent events</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}