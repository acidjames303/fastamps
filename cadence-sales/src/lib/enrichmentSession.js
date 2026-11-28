import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// One tracker for the whole app. Every surface that shows enrichment progress
// (the header indicator and the banner in Prospecting) reads this same session,
// so the counts and the clock can never drift apart, and the background job is
// only polled once.
const ACTIVE = ["queued", "processing"];

let session = null;
let timer = null;
const listeners = new Set();

const isActive = (s) => !!s && ACTIVE.includes(s.status);

const notify = () => listeners.forEach((listener) => listener(session));

export function getEnrichmentSession() {
  return session;
}

function schedule() {
  clearTimeout(timer);
  if (!listeners.size) return;
  const delay = isActive(session) ? 3000 : 10000;
  timer = setTimeout(async () => {
    await tick();
    schedule();
  }, delay);
}

async function tick() {
  try {
    if (isActive(session)) {
      const res = await base44.functions.invoke("pollEnrichmentJob", { session_id: session.id });
      const data = res.data || res;
      if (data?.error) return;
      session = data;
      notify();
      return;
    }
    const active = await base44.entities.EnrichmentSession.filter(
      { status: { $in: ACTIVE } }, "-created_date", 1
    );
    if (active[0] && active[0].id !== session?.id) {
      session = active[0];
      notify();
    }
  } catch {
    /* transient poll failure — the next tick tries again */
  }
}

export function subscribeEnrichmentSession(listener) {
  listeners.add(listener);
  listener(session);
  if (listeners.size === 1) tick().then(schedule);
  else schedule();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) clearTimeout(timer);
  };
}

// A session started from the page is tracked immediately, without waiting for
// the next discovery poll.
export function trackEnrichmentSession(next) {
  if (!next?.id) return;
  session = { ...next, status: next.status || "processing" };
  notify();
  schedule();
}

export function clearEnrichmentSession(id) {
  if (id && session?.id !== id) return;
  session = null;
  notify();
  schedule();
}

export function useEnrichmentSession() {
  const [current, setCurrent] = useState(getEnrichmentSession());
  useEffect(() => subscribeEnrichmentSession(setCurrent), []);
  return current;
}