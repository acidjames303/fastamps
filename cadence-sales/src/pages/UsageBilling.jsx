import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Sparkles, Database, AlertTriangle, CheckCircle2, Plug, ShieldCheck, List } from 'lucide-react';

const USAGE_LABELS = {
  included_smart_actions: { label: 'Smart Actions', icon: Sparkles },
  included_storage_mb: { label: 'Storage (MB)', icon: Database },
};

function Meter({ label, used, limit, icon: Icon }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-slate-700';
  const barTone = pct >= 90 ? '[&>div]:bg-red-500' : pct >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-600">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </span>
        <span className={tone + ' font-medium'}>
          {used.toLocaleString()} / {limit > 0 ? limit.toLocaleString() : '∞'}
        </span>
      </div>
      {limit > 0 && <Progress value={pct} className={'h-2 ' + barTone} />}
    </div>
  );
}

export default function UsageBilling() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [smartSaving, setSmartSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getUsageAndBilling', {});
      setData(res.data || res);
    } catch (err) {
      setError(err.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleBackgroundResearch = async () => {
    if (!organisation) return;
    setSmartSaving(true);
    setError(null);
    try {
      await base44.functions.invoke('manageSmartActionSettings', {
        automatic_company_research: !organisation.automatic_company_research,
      });
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not update background research.');
    } finally {
      setSmartSaving(false);
    }
  };

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

  const { subscription, usage, seats, organisation, data_capacity: dataCapacity } = data || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Usage</h1>
          <p className="text-sm text-slate-500 mt-1">{organisation?.name}</p>
        </div>
      </div>

      {seats && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="w-4 h-4" /> Seats</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-600">{seats.used} active of {seats.included} included ({seats.maximum} max)</span>
              <span className={`text-sm font-medium ${seats.used >= seats.maximum ? 'text-red-600' : 'text-slate-700'}`}>
                {seats.used >= seats.maximum ? 'At limit' : `${seats.maximum - seats.used} remaining`}
              </span>
            </div>
            <Progress value={seats.included > 0 ? (seats.used / seats.included) * 100 : 0} className="h-2 [&>div]:bg-slate-800" />
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-slate-500">
              <span>Operations Admins: {seats.admins_used}/{seats.admins_included}</span>
              <span>SDRs: {seats.sdrs_used}/{seats.sdrs_included}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {dataCapacity && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><List className="w-4 h-4" /> Lists &amp; data capacity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Meter label="Contacts" used={dataCapacity.contacts_used} limit={dataCapacity.contacts_limit} icon={Users} />
            <Meter label="Active lists" used={dataCapacity.active_lists_used} limit={dataCapacity.active_lists_limit} icon={List} />
            <p className="text-xs text-slate-500">
              Saving, opening and editing lists uses database capacity—not Smart Actions. Your workspace includes {dataCapacity.storage_limit_mb.toLocaleString()} MB storage.
              {dataCapacity.retention_days ? ` The recommended retention review is every ${dataCapacity.retention_days} days.` : ''}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-sky-200 bg-sky-50/60">
        <CardContent className="py-5 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-sky-700 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sky-950">Organisation-isolated customer data</p>
            <p className="text-sm text-sky-800 mt-1">
              Contacts and prospect lists are restricted to your organisation. Cadence staff do not have routine in-app access to their contents. Operational support uses usage metadata and diagnostics, not prospect notes or credentials.
            </p>
            <p className="text-xs text-sky-700 mt-2">
              Base44 hosts the application database and authorised backend services may process data to provide requested features. This is zero routine access, not customer-held zero-knowledge encryption.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="py-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-emerald-950">Unlimited core workflow, subject to fair use</p>
              <p className="text-sm text-emerald-800 mt-1">
                Manage lists, record calls and outcomes, save notes, create callbacks, assign work and export your data without using Smart Actions.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 mt-4 pt-4 border-t border-emerald-200">
            <Plug className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-emerald-950">Your providers, your billing</p>
              <p className="text-sm text-emerald-800 mt-1">
                Calling, enrichment and CRM services use your organisation's connected accounts. Their charges are billed directly by those providers and are not deducted from your Cadence allowance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4 text-base">
            <span>Background company research</span>
            <Badge className={organisation?.automatic_company_research ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}>
              {organisation?.automatic_company_research ? 'Enabled' : 'Off'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            When enabled, Cadence researches missing company intelligence overnight and deducts one Smart Action per company.
            It is off by default, so an organisation can never consume AI allowance silently.
          </p>
          <Button
            onClick={toggleBackgroundResearch}
            disabled={smartSaving}
            variant={organisation?.automatic_company_research ? 'outline' : 'default'}
            className="mt-4"
          >
            {smartSaving ? 'Saving…' : organisation?.automatic_company_research ? 'Turn off background research' : 'Enable background research'}
          </Button>
        </CardContent>
      </Card>

      {usage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Platform-powered usage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(USAGE_LABELS).map(([key, { label, icon }]) => {
              const u = usage[key];
              if (!u) return null;
              return <Meter key={key} label={label} used={u.used} limit={u.limit} icon={icon} />;
            })}
          </CardContent>
        </Card>
      )}

      {subscription?.last_payment_status === 'failed' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Payment needs attention</p>
              <p className="text-sm text-amber-700 mt-1">{subscription.last_payment_error || 'A recent payment failed. Please update your billing details.'}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}