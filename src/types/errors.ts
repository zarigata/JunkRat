export class AIError extends Error {
  public readonly name: string = 'AIError';
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly provider: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    provider: string,
    statusCode?: number,
    retryable: boolean = false,
    cause?: Error
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.provider = provider;
    this.cause = cause;
  }
}

export class NetworkError extends AIError {
  public override readonly name = 'NetworkError';
  constructor(message: string, provider: string, cause?: Error) {
    super(message, 'NETWORK_ERROR', provider, undefined, true, cause);
  }
}

export class TimeoutError extends AIError {
  public override readonly name = 'TimeoutError';
  constructor(message: string, provider: string, cause?: Error) {
    super(message, 'TIMEOUT', provider, undefined, true, cause);
  }
}

export class RateLimitError extends AIError {
  public override readonly name = 'RateLimitError';
  constructor(message: string, provider: string, statusCode: number = 429, cause?: Error) {
    super(message, 'RATE_LIMIT', provider, statusCode, true, cause);
  }
}

export class InvalidRequestError extends AIError {
  public override readonly name = 'InvalidRequestError';
  constructor(message: string, provider: string, statusCode?: number, cause?: Error) {
    super(message, 'INVALID_REQUEST', provider, statusCode, false, cause);
  }
}

export class APIError extends AIError {
  public override readonly name = 'APIError';
  constructor(message: string, provider: string, statusCode: number = 500, cause?: Error) {
    super(message, 'API_ERROR', provider, statusCode, true, cause);
  }
}

export class CancellationError extends AIError {
  public override readonly name = 'CancellationError';
  constructor(message: string, provider: string, cause?: Error) {
    super(message, 'CANCELLED', provider, undefined, false, cause);
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AIError) {
    return error.retryable;
  }

  // Handle non-AIError cases
  if (error instanceof Error) {
    // Network errors are typically retryable
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }
    // AbortError is not retryable
    if (error.name === 'AbortError') {
      return false;
    }
  }

  return false;
}

export function createAIError(error: unknown, provider: string, context?: string): AIError {
  if (error instanceof AIError) {
    return error;
  }

  const errorMessage = context ? `${context}: ${error instanceof Error ? error.message : String(error)}` : (error instanceof Error ? error.message : String(error));

  if (error instanceof Error) {
    // Handle AbortError
    if (error.name === 'AbortError') {
      return new CancellationError(errorMessage, provider, error);
    }

    // Handle fetch network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new NetworkError(errorMessage, provider, error);
    }

    // Handle timeout
    if (error.name === 'TimeoutError') {
      return new TimeoutError(errorMessage, provider, error);
    }
  }

  // Handle HTTP status codes if available
  if (error && typeof error === 'object' && 'status' in error) {
    const statusCode = (error as any).status as number;
    if (statusCode >= 400 && statusCode < 500) {
      if (statusCode === 429) {
        return new RateLimitError(errorMessage, provider, statusCode, error instanceof Error ? error : undefined);
      }
      return new InvalidRequestError(errorMessage, provider, statusCode, error instanceof Error ? error : undefined);
    }
    if (statusCode >= 500) {
      return new APIError(errorMessage, provider, statusCode, error instanceof Error ? error : undefined);
    }
  }

  // Default to API error for unknown cases
  return new APIError(errorMessage, provider, undefined, error instanceof Error ? error : undefined);
}
