import { isRetryableError } from '../types/errors';

const createAbortError = () => {
  try {
    return new DOMException('The operation was aborted.', 'AbortError');
  } catch {
    const error = new Error('The operation was aborted.');
    (error as any).name = 'AbortError';
    return error;
  }
};

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitter: boolean;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
  signal?: AbortSignal;
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    factor: 2,
    jitter: true,
    shouldRetry: (error: unknown) => isRetryableError(error),
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Check if operation was cancelled
      if (opts.signal?.aborted) {
        throw createAbortError();
      }

      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt or if not retryable
      if (attempt === opts.maxRetries || !opts.shouldRetry!(error, attempt)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.factor, attempt),
        opts.maxDelayMs
      );

      // Apply jitter if enabled
      const actualDelay = opts.jitter ? Math.random() * delay : delay;

      // Call retry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, actualDelay, error);
      }

      // Wait before retrying
      await sleep(actualDelay, opts.signal);
    }
  }

  throw lastError;
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timeout = setTimeout(() => {
      resolve();
    }, ms);

    // Listen for abort signal
    const abortHandler = () => {
      clearTimeout(timeout);
      reject(createAbortError());
    };

    signal?.addEventListener('abort', abortHandler, { once: true });

    // Clean up listener if timeout completes
    timeout.unref?.();
  });
}
