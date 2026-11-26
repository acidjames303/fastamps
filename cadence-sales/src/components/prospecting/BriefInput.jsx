import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";
import DictateButton from "@/components/dialer/DictateButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, FileText, Plus } from "lucide-react";

export default function BriefInput({ brief, setBrief, onStart, starting, name = "", onNameChange }) {
  const fileRef = useRef(null);
  const [extracting, setExtracting] = useState(false);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setExtracting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      const response = await base44.functions.invoke("runSmartAction", {
        action_type: "brief_extraction",
        prompt:
          "Extract the full campaign brief / ideal customer profile from this document as plain text. Preserve the key points: target companies and sectors, target roles/seniority, regions, the offer or product being pitched, and any qualification criteria.",
        file_urls: [file_url],
      });
      const res = response.data?.result ?? response.result;
      setBrief(typeof res === "string" ? res : JSON.stringify(res));
    } catch {
      setBrief("");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {onNameChange && (
        <div>
          <label htmlFor="new-prospect-list-name" className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">
            Campaign or list name
          </label>
          <Input
            id="new-prospect-list-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Oxi-Tech — plant managers"
            className="rounded-xl bg-white border-slate-200"
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-slate-400">Campaign brief</p>
        {brief && <FileText className="w-3.5 h-3.5 text-slate-400" />}
      </div>
      <Textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder="Describe the campaign: what you're pitching, who you want to reach (industry, role, region, company size), and any qualification criteria. Or upload a brief document."
        className="rounded-2xl bg-white border-slate-200 min-h-36"
      />
      <DictateButton value={brief} onChange={setBrief} label="Dictate brief" />
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={onFile} className="hidden" />
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={extracting} className="rounded-full border-slate-300 text-slate-700">
          {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {extracting ? "Reading brief…" : "Upload brief"}
        </Button>
        {onStart && (
          <Button onClick={onStart} disabled={(!brief.trim() && !name.trim()) || starting || extracting} className="rounded-full bg-emerald-600 hover:bg-emerald-700 ml-auto">
            {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Start list
          </Button>
        )}
      </div>
    </div>
  );
}