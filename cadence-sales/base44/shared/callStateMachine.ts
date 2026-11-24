// Formal call state machine for the Dialer.
// Prevents impossible transitions, duplicate calls, and invalid outcome saves.

export type CallState =
  | 'ready'
  | 'connecting'
  | 'ringing'
  | 'connected'
  | 'ending'
  | 'ended'
  | 'outcome_required'
  | 'saving'
  | 'completed'
  | 'failed';

const VALID_TRANSITIONS: Record<CallState, CallState[]> = {
  ready: ['connecting'],
  connecting: ['ringing', 'failed', 'ended'],
  ringing: ['connected', 'ended', 'failed'],
  connected: ['ending', 'ended', 'outcome_required'],
  ending: ['ended'],
  ended: ['outcome_required'],
  outcome_required: ['saving', 'completed'],
  saving: ['completed', 'failed'],
  completed: ['ready'],
  failed: ['outcome_required', 'ready'],
};

export function canTransition(from: CallState, to: CallState): boolean {
  const allowed = VALID_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function assertTransition(from: CallState, to: CallState): CallState {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid call state transition: ${from} -> ${to}`);
  }
  return to;
}

// Guard: prevent starting two calls simultaneously
export function canStartCall(currentState: CallState): boolean {
  return currentState === 'ready';
}

// Guard: cannot call without a selected contact
export function canCallContact(contact: { do_not_call?: boolean; marketing_status?: string } | null): boolean {
  if (!contact) return false;
  if (contact.do_not_call) return false;
  if (contact.marketing_status === 'suppressed') return false;
  return true;
}

// Guard: prevent saving outcome before call has ended or failed
export function canSaveOutcome(currentState: CallState): boolean {
  return ['outcome_required', 'failed', 'ended'].includes(currentState);
}

// Guard: prevent hanging up a call that never started
export function canHangup(currentState: CallState): boolean {
  return ['connecting', 'ringing', 'connected', 'ending'].includes(currentState);
}

// Guard: prevent duplicate outcome submission
export function isOutcomeComplete(currentState: CallState): boolean {
  return ['completed', 'saving'].includes(currentState);
}

export const CALL_STATE_LABELS: Record<CallState, string> = {
  ready: 'Ready',
  connecting: 'Connecting…',
  ringing: 'Ringing…',
  connected: 'Connected',
  ending: 'Ending call…',
  ended: 'Call ended',
  outcome_required: 'Record an outcome',
  saving: 'Saving…',
  completed: 'Saved',
  failed: 'Call failed',
};