// Voice dictation helpers.
// Audio is recorded in the browser only while the user is recording, sent over
// HTTPS to our own backend function for transcription by OpenAI, and is never
// stored by Cadence. Browser dictation (Web Speech API) is the free fallback.

export const DICTATION_MAX_SECONDS = 180;

export function isRecordingSupported() {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    window.MediaRecorder
  );
}

export function isBrowserSpeechSupported() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function pickAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((type) => {
    try { return MediaRecorder.isTypeSupported(type); } catch { return false; }
  }) || "";
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("The recording could not be read."));
    reader.readAsDataURL(blob);
  });
}

// Sends one recording to the authenticated backend function.
export async function transcribeRecording(base44, blob, mimeType) {
  if (!blob || blob.size < 1200) {
    throw new Error("That recording was too short. Hold on a moment longer and try again.");
  }
  const audio_base64 = await blobToBase64(blob);
  const response = await base44.functions.invoke("transcribeDictation", {
    audio_base64,
    mime_type: String(mimeType || blob.type || "audio/webm").split(";")[0],
  });
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  const text = String(data.text || "").trim();
  if (!text) throw new Error("No speech was detected. Try again, or use browser dictation.");
  return text;
}