// Theme preference: 'auto' follows the time of day, 'light'/'dark' are manual locks.
const PREF_KEY = "cadence-theme-pref";

// Day = 06:00–18:59, night otherwise (user local time).
export function timeBasedTheme() {
  const h = new Date().getHours();
  return h >= 6 && h < 19 ? "light" : "dark";
}

export function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) || "auto";
  } catch {
    return "auto";
  }
}

export function writePref(p) {
  try {
    localStorage.setItem(PREF_KEY, p);
  } catch {
    /* ignore */
  }
}

// The actual theme to apply, honouring a manual override when one exists.
export function resolvedTheme() {
  const p = readPref();
  return p === "auto" ? timeBasedTheme() : p;
}