import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, AlertTriangle, PhoneOff, FileSearch, Clock, Mic, CheckCircle2 } from 'lucide-react';

const STATUS_TONES = {
  normal: 'bg-emerald-100 text-emerald-700',
  review: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

function StatCard({ label, value, icon: Icon, tone = 'text-slate-700' }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{label}</span>
          <Icon className={'w-4 h-4 ' + tone} />
        </div>
        <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function ComplianceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getComplianceDashboard', {});
      setData(res.data || res);
    } catch (err) {
      setError(err.message || 'Failed to load compliance data');
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

  const { stats = {}, suppression = {}, privacy = {}, recordings = {}, compliance_notice, recording_enabled } = data || {};

  const overallStatus = privacy.overdue > 0 || recordings.failed_deletion > 0
    ? 'overdue'
    : stats.review_required > 0 || privacy.approaching_due > 0 || recordings.approaching_deletion > 0
    ? 'review'
    : 'normal';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Compliance Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">UK calling compliance and data governance overview</p>
        </div>
        <Badge className={STATUS_TONES[overallStatus] || STATUS_TONES.normal}>
          {overallStatus === 'normal' ? 'No immediate action' : overallStatus === 'review' ? 'Review required' : 'Overdue action'}
        </Badge>
      </div>

      {/* Compliance notice */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="py-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-600">{compliance_notice || 'Cadence provides controls to support your compliance process. Your organisation remains responsible for determining its lawful basis and calling policies.'}</p>
        </CardContent>
      </Card>

      {/* Contact compliance stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Ready for Calling" value={stats.ready_for_calling || 0} icon={CheckCircle2} tone="text-emerald-600" />
        <StatCard label="Review Required" value={stats.review_required || 0} icon={FileSearch} tone="text-amber-600" />
        <StatCard label="Suppressed" value={stats.suppressed || 0} icon={PhoneOff} tone="text-red-600" />
        <StatCard label="Not Checked" value={stats.not_checked || 0} icon={Clock} tone="text-slate-400" />
      </div>

      {/* Privacy requests */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSearch className="w-4 h-4" /> Privacy Requests</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-slate-500">Active</p>
              <p className="text-xl font-semibold text-slate-900">{privacy.active || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Approaching Due</p>
              <p className="text-xl font-semibold text-amber-600">{privacy.approaching_due || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Overdue</p>
              <p className="text-xl font-semibold text-red-600">{privacy.overdue || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-xl font-semibold text-slate-900">{privacy.total || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppression summary */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PhoneOff className="w-4 h-4" /> Suppression Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div>
              <p className="text-sm text-slate-500">Active Suppressions</p>
              <p className="text-xl font-semibold text-slate-900">{suppression.active || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Overridden</p>
              <p className="text-xl font-semibold text-slate-600">{suppression.overridden || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-xl font-semibold text-slate-900">{suppression.total || 0}</p>
            </div>
          </div>
          {suppression.recent_overrides?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-500 mb-2">Recent Overrides</p>
              <div className="space-y-2">
                {suppression.recent_overrides.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
                    <span className="text-slate-700">{o.reason || 'No reason given'}</span>
                    <span className="text-xs text-slate-400">{o.overridden_at ? new Date(o.overridden_at).toLocaleDateString('en-GB') : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recording and retention */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mic className="w-4 h-4" /> Call Recordings</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Badge className={recording_enabled ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                {recording_enabled ? 'Recording enabled' : 'Recording disabled'}
              </Badge>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total recordings</span><span className="font-medium">{recordings.total || 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Approaching deletion</span><span className="font-medium text-amber-600">{recordings.approaching_deletion || 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Pending deletion</span><span className="font-medium">{recordings.pending_deletion || 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Failed deletion</span><span className="font-medium text-red-600">{recordings.failed_deletion || 0}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="w-4 h-4" /> Retention & Screening</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Expired screening checks</span><span className="font-medium text-amber-600">{data?.expired_screening || 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Records due for retention review</span><span className="font-medium text-amber-600">{data?.retention_due || 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total contacts (active)</span><span className="font-medium">{stats.total_contacts || 0}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}