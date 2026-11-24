// Caller-editable audio levels for the in-app (browser) dialer.
// Stored per browser so a caller's tuning survives navigation and refresh.
const KEY = "dialer_audio_settings";

export const DEFAULT_AUDIO_SETTINGS = {
  inputVolume: 0.85,
  outputVolume: 0.5,
};

const clamp = (value, fallback) => {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(1, Math.max(0, num));
};

export function readAudioSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    const parsed = JSON.parse(raw) || {};
    return {
      inputVolume: clamp(parsed.inputVolume, DEFAULT_AUDIO_SETTINGS.inputVolume),
      outputVolume: clamp(parsed.outputVolume, DEFAULT_AUDIO_SETTINGS.outputVolume),
    };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(settings) {
  const clean = {
    inputVolume: clamp(settings?.inputVolume, DEFAULT_AUDIO_SETTINGS.inputVolume),
    outputVolume: clamp(settings?.outputVolume, DEFAULT_AUDIO_SETTINGS.outputVolume),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    // private mode / storage blocked — levels still apply for this session
  }
  return clean;
}