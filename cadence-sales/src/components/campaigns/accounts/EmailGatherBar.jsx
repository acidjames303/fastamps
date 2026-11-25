import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Gathers the email addresses of the accounts currently on screen, so they can be
// pasted into an email or handed over as a list.
export default function EmailGatherBar({ accounts, campaignName }) {
  const { toast } = useToast();

  const emails = useMemo(() => {
    const seen = new Map();
    for (const account of accounts || []) {
      for (const contact of account.contacts || []) {
        const email = (contact.email || "").trim();
        if (!email) continue;
        const key = email.toLowerCase();
        if (!seen.has(key)) seen.set(key, { email, name: contact.name || "", company: account.name || "" });
      }
    }
    return [...seen.values()];
  }, [accounts]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(emails.map((e) => e.email).join(", "));
      toast({ title: `${emails.length} email address${emails.length === 1 ? "" : "es"} copied` });
    } catch (e) {
      toast({ title: "Could not copy — your browser blocked it", variant: "destructive" });
    }
  };

  const download = () => {
    const escape = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
    const lines = ["Email,Name,Company", ...emails.map((e) => [e.email, e.name, e.company].map(escape).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(campaignName || "campaign").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-emails.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex items-center gap-2 text-sm text-slate-600">
        <Mail className="w-4 h-4 text-slate-400" />
        <span>
          <span className="font-medium text-slate-900">{emails.length}</span> email address
          {emails.length === 1 ? "" : "es"} across {accounts?.length || 0} account{(accounts?.length || 0) === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="rounded-full" onClick={copy} disabled={!emails.length}>
          <Copy className="w-4 h-4 mr-1.5" /> Copy emails
        </Button>
        <Button variant="outline" size="sm" className="rounded-full" onClick={download} disabled={!emails.length}>
          <Download className="w-4 h-4 mr-1.5" /> Email list CSV
        </Button>
      </div>
    </div>
  );
}