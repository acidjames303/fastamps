import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Plug, ExternalLink } from "lucide-react";

export default function ProviderCard({ provider, connected, onConnect }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <provider.Icon className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{provider.name}</h3>
            <p className="text-xs text-slate-400">{provider.group}</p>
          </div>
        </div>
        {connected ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
          </span>
        ) : (
          <span className="text-xs text-slate-400 font-medium">Not connected</span>
        )}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed flex-1">{provider.blurb}</p>
      <div className="flex items-center gap-3">
        <Button onClick={onConnect} variant={connected ? "outline" : "default"} className="rounded-full h-8 px-4 text-xs">
          <Plug className="w-3.5 h-3.5 mr-1.5" />
          {connected ? "Manage" : "Connect"}
        </Button>
        {provider.accountUrl && (
          <a href={provider.accountUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
            Get key <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}