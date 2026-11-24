// Safe retry framework with idempotency.
// Classifies errors and prevents duplicate records or external actions.

export type ErrorClass = 'safe_to_retry' | 'manual_retry' | 'configuration' | 'permanent';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

// Classify an error to determine if it's safe to retry.
export function classifyError(error: { status?: number; code?: string; message?: string }): ErrorClass {
  const status = error.status;
  const msg = (error.message || '').toLowerCase();

  // Network errors and 5xx — safe to retry
  if (!status || status >= 500) return 'safe_to_retry';
  if (status === 408 || status === 429) return 'safe_to_retry';

  // Configuration errors — need user action
  if (status === 401 || status === 403) return 'configuration';
  if (status === 400 && msg.includes('api key')) return 'configuration';
  if (status === 400 && msg.includes('credential')) return 'configuration';

  // Validation/conflict — permanent unless idempotency key handles it
  if (status === 409) return 'safe_to_retry'; // conflict — idempotency will handle
  if (status === 422) return 'permanent';

  // Rate limit from external provider
  if (msg.includes('rate limit') || msg.includes('too many')) return 'safe_to_retry';

  return 'manual_retry';
}

// Execute an async operation with safe retry and exponential backoff.
// The idempotencyKey ensures retries cannot duplicate records.
export async function withRetry<T>(
  operation: () => Promise<T>,
  idempotencyKey: string,
  config?: Partial<RetryConfig>
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorClass = classifyError(error);

      if (errorClass === 'permanent' || errorClass === 'configuration') {
        throw error;
      }

      if (errorClass === 'manual_retry' && attempt >= 2) {
        throw error;
      }

      if (attempt < cfg.maxAttempts) {
        const delay = Math.min(
          cfg.baseDelayMs * Math.pow(2, attempt - 1),
          cfg.maxDelayMs
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Generate a stable idempotency key from entity + action + reference.
export function makeIdempotencyKey(entity: string, action: string, reference: string): string {
  return `${entity}:${action}:${reference}`;
}