import { useCallback, useEffect, useRef, useState } from "react";
import { Device } from "@twilio/voice-sdk";
import { base44 } from "@/api/base44Client";
import { DEFAULT_AUDIO_SETTINGS } from "@/lib/dialerSettings";

// Leave headroom on both legs. Driving the mic input and the playback element at
// full scale is what produces the clipping distortion on loud speech, so pull
// both back slightly and let the caller hear a clean, unclipped signal.
const applyAudioLevels = (device, levels) => {
  const audio = device?.audio;
  if (!audio || !levels) return;
  const safely = (call) => {
    try {
      const result = call();
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch {}
  };
  safely(() => audio.setInputVolume(levels.inputVolume));
  safely(() => audio.setOutputVolume(levels.outputVolume));
};

// Codes the Voice SDK reports when the signalling/media connection to Twilio
// fails rather than the call itself being rejected: 31000 transport, 31003 no
// response, 31005 connection error, 31009 no transport. These recover on a
// fresh registration, so they are worth one automatic redial.
const CONNECTION_CODES = [31000, 31003, 31005, 31009];

const isConnectionError = (e) => {
  const code = Number(e?.code);
  if (CONNECTION_CODES.includes(code)) return true;
  return /connection error|transport|no transport/i.test(e?.message || "");
};

const errorText = (e) =>
  isConnectionError(e)
    ? "The voice line dropped. Reconnecting…"
    : e?.message || "Voice device error";

// Shown when the call could not even be set up (rather than dropping mid-call).
export const CONNECT_FAILED =
  "Could not connect the voice line. Check your internet connection, then press Dial again.";

// Manages a Twilio browser Voice SDK device so the Dialer can place calls
// using the computer's mic and speaker (no phone agent leg). Lazily registers
// the device when enabled, then exposes connect/disconnect + call status.
export default function useTwilioDevice(enabled, audioSettings) {
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const attemptRef = useRef(0);
  const connectRef = useRef(null);
  // Caller-editable levels, held in a ref so a live call can be re-levelled.
  const levelsRef = useRef({ ...DEFAULT_AUDIO_SETTINGS, ...(audioSettings || {}) });
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  // Every call needs its own short-lived authorisation token, so fetch a fresh
  // pair each time rather than reusing the one minted when the device registered.
  const fetchTokens = useCallback(async () => {
    const res = await base44.functions.invoke("twilioVoiceToken", {});
    const data = res.data || res;
    if (data.error) throw new Error(data.error);
    return data;
  }, []);

  // Apply new levels from the dialer settings without restarting the call.
  const applyLevels = useCallback((next) => {
    levelsRef.current = { ...levelsRef.current, ...next };
    if (deviceRef.current) applyAudioLevels(deviceRef.current, levelsRef.current);
  }, []);

  const ensureDevice = useCallback(async () => {
    if (deviceRef.current) return deviceRef.current;
    const data = await fetchTokens();
    const device = new Device(data.token, {
      // The ringing tone arrives as media from the carrier leg, and Opus at the
      // browser-leg bitrate mangles a pure tone — that is the clicking, warbling
      // ring rather than clipping. G.711 (PCMU) is bit-exact and is the codec the
      // UK PSTN leg uses anyway, so the tone stays clean with no quality loss.
      codecPreferences: ["pcmu", "opus"],
      enableRingingState: true,
      // Explicit browser processing stops the raw mic signal being over-driven
      // before it is encoded, which is the other source of clipping.
      audioConstraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });
    device.on("registered", () => {
      applyAudioLevels(device, levelsRef.current);
      setReady(true);
    });
    // A dropped connection leaves the device unregistered. Re-register with a
    // fresh token straight away so the next Dial is not met with a failure.
    let recovering = false;
    device.on("unregistered", async () => {
      setReady(false);
      if (recovering || deviceRef.current !== device) return;
      recovering = true;
      try {
        const fresh = await fetchTokens();
        await device.updateToken(fresh.token);
        await device.register();
      } catch {
        // Stays unregistered — connect() registers again before dialling.
      } finally {
        recovering = false;
      }
    });
    device.on("error", (e) => setError(errorText(e)));
    await device.register();
    deviceRef.current = device;
    return device;
  }, [fetchTokens]);

  useEffect(() => {
    if (!enabled) return;
    ensureDevice().catch((e) => setError(e.message || "Could not start voice device"));
  }, [enabled]);

  const connect = useCallback(async (destination) => {
    const attempt = ++attemptRef.current;
    setError("");
    setStatus("connecting");
    try {
      const [device, tokens] = await Promise.all([ensureDevice(), fetchTokens()]);
      if (attempt !== attemptRef.current) return;
      // Keep the device's long-lived registration current too.
      try { await device.updateToken(tokens.token); } catch {}
      // A dropped connection leaves the device unregistered, which fails the
      // next call ("the call was not completed"). Register again first so the
      // caller can just press Dial and get through.
      if (device.state !== "registered") {
        setReady(false);
        await device.register();
        setReady(true);
      }
      const vt = tokens.voiceToken;
      if (!vt) throw new Error("Voice token missing");
      const call = await device.connect({ params: { To: destination, vt } });
      if (attempt !== attemptRef.current) { call.disconnect(); return; }
      callRef.current = call;
      const updateStatus = (next) => {
        if (callRef.current === call) setStatus(next);
      };
      const finish = () => {
        if (callRef.current !== call) return;
        callRef.current = null;
        setStatus("ended");
      };
      // Voice SDK v2 opens calls on "accept" and closes them on "disconnect".
      // There are no "connected" or "disconnected" Call events.
      call.on("accept", () => {
        applyAudioLevels(device, levelsRef.current);
        updateStatus("in_call");
      });
      call.on("ringing", () => updateStatus("ringing"));
      ["disconnect", "reject", "cancel"].forEach((event) => call.on(event, finish));
      let retried = false;
      call.on("error", (e) => {
        if (callRef.current !== call) return;
        callRef.current = null;
        try { call.disconnect(); } catch {}
        // A dropped signalling socket is the usual cause of a connection error
        // such as 31005, and it clears on a fresh registration — so redial once
        // automatically instead of making the caller press Dial again.
        if (isConnectionError(e) && !retried) {
          retried = true;
          setError("");
          setStatus("connecting");
          Promise.resolve(connectRef.current?.(destination)).catch(() => {});
          return;
        }
        setStatus("ended");
        setError(
          isConnectionError(e)
            ? "The voice line dropped. Press Dial to start the call again."
            : e.message || "The call could not continue."
        );
      });
      // Reconcile if the call opened before listeners were attached.
      const current = call.status();
      if (current === "closed") finish();
      else updateStatus(current === "open" ? "in_call" : current === "ringing" ? "ringing" : "connecting");
    } catch (e) {
      if (attempt !== attemptRef.current) return;
      setStatus("ended");
      throw new Error(isConnectionError(e) ? CONNECT_FAILED : e.message || CONNECT_FAILED);
    }
  }, [ensureDevice, fetchTokens]);

  // Lets the call's error handler redial without depending on itself.
  useEffect(() => { connectRef.current = connect; }, [connect]);

  // Send DTMF tones to the live call so IVR menus can be answered.
  const sendDigits = useCallback((digits) => {
    const call = callRef.current;
    if (!call || call.status() !== "open") {
      setError("The call must be connected before sending keypad numbers.");
      return false;
    }
    try {
      call.sendDigits(String(digits));
      setError("");
      return true;
    } catch (e) {
      setError(e.message || "Could not send that keypad number. Please press it again.");
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    attemptRef.current += 1;
    const call = callRef.current;
    callRef.current = null;
    setStatus("ended");
    try { if (call) call.disconnect(); } catch {}
    try { if (deviceRef.current) deviceRef.current.disconnectAll(); } catch {}
  }, []);

  useEffect(() => () => {
    attemptRef.current += 1;
    callRef.current = null;
    if (deviceRef.current) { try { deviceRef.current.destroy(); } catch {} deviceRef.current = null; }
  }, []);

  return { ready, status, error, connect, disconnect, sendDigits, applyLevels };
}