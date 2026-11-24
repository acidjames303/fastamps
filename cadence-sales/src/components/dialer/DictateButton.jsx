import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

// Browser-native voice dictation (Web Speech API). Appends transcribed speech
// to the notes field. No package needed; works in Chrome/Edge.
export default function DictateButton({ value, onChange }) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const recRef = useRef(null);
  const valueRef = useRef(value || "");

  useEffect(() => { valueRef.current = value || ""; }, [value]);

  useEffect(() => () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
  }, []);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-GB";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
      }
      if (chunk) {
        const base = valueRef.current || "";
        const sep = base && !base.endsWith(" ") ? " " : "";
        const next = base + sep + chunk.trimStart();
        valueRef.current = next;
        onChange(next);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={listening ? stop : start}
      className={`rounded-full h-8 px-3 text-xs ${
        listening
          ? "text-rose-600 border-rose-300 bg-rose-50 hover:bg-rose-100"
          : "text-slate-600 border-slate-300 hover:bg-slate-50"
      }`}
    >
      {listening ? (
        <><MicOff className="w-3.5 h-3.5 mr-1.5" /> Stop</>
      ) : (
        <><Mic className="w-3.5 h-3.5 mr-1.5" /> Dictate</>
      )}
    </Button>
  );
}