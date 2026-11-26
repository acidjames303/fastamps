import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Check, X, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  DICTATION_MAX_SECONDS,
  formatDuration,
  isBrowserSpeechSupported,
  isRecordingSupported,
  pickAudioMimeType,
  transcribeRecording,
} from "@/lib/dictation";

// Voice dictation for any text field.
// Manual start/stop → secure server-side transcription (OpenAI, British English)
// → editable transcript the user inserts or discards. Browser dictation is the
// free fallback and is used automatically when recording is unavailable.
export default function DictateButton({ value, onChange, label = "Dictate", className = "", prominent = false, direct = false }) {
  const [phase, setPhase] = useState("idle"); // idle | recording | working | review
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [browserListening, setBrowserListening] = useState(false);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);
  const speechRef = useRef(null);
  const valueRef = useRef(value || "");
  const stopRef = useRef(() => {});

  const recordingSupported = isRecordingSupported();
  const speechSupported = isBrowserSpeechSupported();

  useEffect(() => { valueRef.current = value || ""; }, [value]);

  const releaseMic = () => {
    try { streamRef.current?.getTracks?.().forEach((track) => track.stop()); } catch { /* noop */ }
    streamRef.current = null;
  };

  useEffect(() => () => {
    clearInterval(timerRef.current);
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    try { speechRef.current?.stop(); } catch { /* noop */ }
    releaseMic();
  }, []);

  const appendText = (chunk) => {
    const clean = String(chunk || "").trim();
    if (!clean) return;
    const base = valueRef.current || "";
    const separator = base && !/\s$/.test(base) ? " " : "";
    const next = base + separator + clean;
    valueRef.current = next;
    onChange(next);
  };

  const stop = () => {
    clearInterval(timerRef.current);
    try { recorderRef.current?.stop(); } catch { /* noop */ }
  };
  stopRef.current = stop;

  const start = async () => {
    setError("");
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickAudioMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32000,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        releaseMic();
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        chunksRef.current = [];
        setPhase("working");
        try {
          const text = await transcribeRecording(base44, blob, mimeType);
          // direct: the transcript goes straight into the field, with no second box.
          if (direct) {
            appendText(text);
            setPhase("idle");
          } else {
            setTranscript(text);
            setPhase("review");
          }
        } catch (e) {
          setError(e?.message || "Transcription failed. You can use browser dictation instead.");
          setPhase("idle");
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setPhase("recording");
      setSeconds(0);
      secondsRef.current = 0;
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= DICTATION_MAX_SECONDS) stopRef.current();
      }, 1000);
    } catch {
      setError("Microphone access was blocked. Allow the microphone, or use browser dictation.");
      setPhase("idle");
      releaseMic();
    }
  };

  const startBrowser = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setError("");
    const recognition = new SR();
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) chunk += event.results[i][0].transcript;
      }
      if (chunk) appendText(chunk);
    };
    recognition.onend = () => setBrowserListening(false);
    recognition.onerror = () => setBrowserListening(false);
    recognition.start();
    speechRef.current = recognition;
    setBrowserListening(true);
  };

  const stopBrowser = () => {
    try { speechRef.current?.stop(); } catch { /* noop */ }
    setBrowserListening(false);
  };

  if (phase === "review") {
    return (
      <div className={`rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2 ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Review before inserting</p>
          <button
            type="button"
            onClick={() => { setPhase("idle"); setTranscript(""); }}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Discard transcript"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-emerald-200 bg-white p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!transcript.trim()}
            onClick={() => { appendText(transcript); setPhase("idle"); setTranscript(""); }}
            className="rounded-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Insert
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { setPhase("idle"); setTranscript(""); }}
            className="rounded-full h-8 text-xs text-slate-500"
          >
            Discard
          </Button>
          <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Transcribed by OpenAI · audio not stored
          </span>
        </div>
      </div>
    );
  }

  const showBrowserFallback = speechSupported && (!recordingSupported || !!error);

  // No microphone in this browser: say so plainly instead of silently dropping
  // the control, so nobody has to guess whether dictation exists here.
  if (!recordingSupported && !speechSupported) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span
          role="status"
          aria-live="polite"
          title="This browser does not offer microphone dictation. Type your text instead, or open Cadence in Chrome, Edge or Safari."
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 text-xs text-slate-400"
        >
          <MicOff className="w-3.5 h-3.5" /> Microphone not available here
        </span>
        <span className="text-[10px] text-slate-400">Type instead — nothing is lost.</span>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {phase === "recording" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={stop}
            className="rounded-full h-8 px-3 text-xs text-rose-600 border-rose-300 bg-rose-50 hover:bg-rose-100"
          >
            <MicOff className="w-3.5 h-3.5 mr-1.5" /> Stop · {formatDuration(seconds)}
          </Button>
        ) : phase === "working" ? (
          <Button type="button" variant="outline" size="sm" disabled className="rounded-full h-8 px-3 text-xs">
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Transcribing…
          </Button>
        ) : recordingSupported ? (
          prominent ? (
            <button
              type="button"
              onClick={start}
              aria-label={`${label} — start recording`}
              title={`${label} — speak instead of typing`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <Mic className="w-4 h-4" />
            </button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={start}
              aria-label={`${label} — start recording`}
              className="rounded-full h-8 px-3 text-xs text-slate-600 border-slate-300 hover:bg-slate-50"
            >
              <Mic className="w-3.5 h-3.5 mr-1.5" /> {label}
            </Button>
          )
        ) : null}

        {showBrowserFallback && phase !== "working" && (
          <button
            type="button"
            onClick={browserListening ? stopBrowser : startBrowser}
            className={`rounded-full border px-3 h-8 text-xs ${
              browserListening
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {browserListening ? "Stop browser dictation" : "Browser dictation"}
          </button>
        )}
      </div>
      {phase === "recording" && (
        <p role="status" aria-live="polite" className="text-[10px] text-slate-400">
          Recording — press Stop when you have finished (up to {Math.round(DICTATION_MAX_SECONDS / 60)} minutes).
        </p>
      )}
      {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}