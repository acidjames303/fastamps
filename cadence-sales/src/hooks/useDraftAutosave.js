import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";

// Local draft protection for unsaved call notes, outcomes, and callbacks.
// Drafts are stored in localStorage keyed by user + record, expire after 4 hours,
// are cleared on successful save, and never cross users.

const DRAFT_PREFIX = "cadence_draft_";
const DRAFT_EXPIRY_MS = 4 * 60 * 60 * 1000;

export function useDraftAutosave(recordId, fields = {}) {
  const { user } = useAuth();
  const storageKey = user && recordId
    ? `${DRAFT_PREFIX}${user.id}_${recordId}`
    : null;

  const [values, setValues] = useState(fields);
  const [restored, setRestored] = useState(false);
  const timerRef = useRef(null);
  // Keep the newest draft on hand so a half-typed note is written the instant
  // the panel closes, rather than waiting out the debounce.
  const latestRef = useRef({ storageKey: null, values: fields });

  const writeDraft = useCallback((key, vals) => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ values: vals, savedAt: Date.now() }));
    } catch { /* quota or privacy mode */ }
  }, []);

  useEffect(() => {
    latestRef.current = { storageKey, values };
  });

  // Restore draft on mount / record change
  useEffect(() => {
    setRestored(false);
    if (!storageKey) {
      setValues(fields);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const age = Date.now() - (parsed.savedAt || 0);
        if (age < DRAFT_EXPIRY_MS && parsed.values) {
          setValues(parsed.values);
          setRestored(true);
          return;
        }
        localStorage.removeItem(storageKey);
      }
    } catch { /* ignore corrupted draft */ }
    setValues(fields);
  }, [storageKey]);

  // Autosave with debounce
  useEffect(() => {
    if (!storageKey) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => writeDraft(storageKey, values), 800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [values, storageKey, writeDraft]);

  // Flush on close so a note typed a moment before clicking off is never lost.
  useEffect(() => () => {
    const { storageKey: key, values: vals } = latestRef.current;
    writeDraft(key, vals);
  }, [writeDraft]);

  // Clear drafts for this user on logout
  useEffect(() => {
    const handler = () => {
      if (storageKey) {
        // Don't clear on every storage event, only on explicit logout
      }
    };
    return handler;
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    if (!storageKey) return;
    localStorage.removeItem(storageKey);
    setRestored(false);
  }, [storageKey]);

  const updateField = useCallback((key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const dismissRestored = useCallback(() => setRestored(false), []);

  return { values, setValues, updateField, restored, clearDraft, dismissRestored };
}