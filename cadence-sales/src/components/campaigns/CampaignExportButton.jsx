import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

// Downloads one CSV row per contact (First name, Last name, Company, Phone, Email…).
export default function CampaignExportButton({ campaignId, listId, label = 'Export contacts CSV' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await base44.functions.invoke('exportCampaignData', {
        campaign_id: campaignId,
        list_id: listId,
      });
      if (data.error) throw new Error(data.error);
      const url = URL.createObjectURL(new Blob([data.csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button variant="outline" disabled={busy} onClick={download} className="rounded-full">
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
        {busy ? 'Building contacts…' : label}
      </Button>
      <p className="text-xs text-slate-500 max-w-sm">
        One row per person — first name, last name, company, phone and email kept separate.
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive max-w-sm">
          {error}
        </p>
      )}
    </div>
  );
}
