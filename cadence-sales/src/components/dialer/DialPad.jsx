import React, { useState } from "react";
import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

// Keypad for in-browser calls. Every press is sent to the live call so phone
// menus ("press 1 for sales") can be navigated mid-call.
export default function DialPad({ onSend, disabled = false }) {
  const [entered, setEntered] = useState("");

  const press = (key) => {
    if (disabled || onSend(key) !== true) return;
    setEntered((value) => `${value}${key}`.slice(-30));
  };

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-widest text-slate-400">Keypad</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-emerald-300 min-h-5">{entered || "\u00a0"}</span>
          {entered && (
            <button
              onClick={() => setEntered("")}
              aria-label="Clear pressed numbers"
              className="text-slate-500 hover:text-white"
            >
              <Delete className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={`Send ${key}`}
            onClick={() => press(key)}
            className="h-11 rounded-xl bg-white/10 text-white font-medium text-lg hover:bg-white/20 active:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}