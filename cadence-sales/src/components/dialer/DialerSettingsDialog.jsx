import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, Volume2 } from "lucide-react";
import { DEFAULT_AUDIO_SETTINGS } from "@/lib/dialerSettings";

// Caller-editable dialer audio. Microphone controls how loud you sound to the
// person you called; speaker controls how loud they sound to you.
export default function DialerSettingsDialog({ open, onOpenChange, settings, onSave }) {
  const [input, setInput] = useState(settings.inputVolume);
  const [output, setOutput] = useState(settings.outputVolume);

  useEffect(() => {
    if (!open) return;
    setInput(settings.inputVolume);
    setOutput(settings.outputVolume);
  }, [open, settings.inputVolume, settings.outputVolume]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Dialer settings</DialogTitle>
          <DialogDescription>
            Tune the in-app call audio for this device. Changes apply to your next call and are saved for this browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          <LevelField
            icon={Mic}
            label="Microphone"
            hint="How loud you sound to the person you called."
            value={input}
            onChange={setInput}
          />
          <LevelField
            icon={Volume2}
            label="Speaker"
            hint="How loud the person you called sounds to you."
            value={output}
            onChange={setOutput}
          />
          <button
            type="button"
            onClick={() => {
              setInput(DEFAULT_AUDIO_SETTINGS.inputVolume);
              setOutput(DEFAULT_AUDIO_SETTINGS.outputVolume);
            }}
            className="text-xs text-slate-500 underline hover:text-slate-800"
          >
            Reset to defaults
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => onSave({ inputVolume: input, outputVolume: output })}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LevelField({ icon: Icon, label, hint, value, onChange }) {
  const percent = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-slate-700 inline-flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-slate-400" /> {label}
        </label>
        <span className="text-xs font-medium text-slate-500 tabular-nums">{percent}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={percent}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-emerald-600"
        aria-label={`${label} level`}
      />
      <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
    </div>
  );
}