/**
 * src/core/api/errors.ts
 *
 * Custom error classes for better API error handling and type safety.
 */

/**
 * Base API error class
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;
  readonly isApiError = true;

  constructor(
    message: string,
    code: string,
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      details: this.details,
    };
  }
}

/**
 * Network connectivity error
 */
export class NetworkError extends ApiError {
  readonly isNetworkError = true;

  constructor(message: string = 'Network error - please check your connection') {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends ApiError {
  readonly isAuthError = true;

  constructor(message: string = 'Authentication required - please login again') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access denied - insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * Resource not found error (404)
 */
export class NotFoundError extends ApiError {
  constructor(resource?: string) {
    const message = resource
      ? `${resource} not found`
      : 'Resource not found';
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends ApiError {
  readonly validationErrors?: Record<string, string[]>;

  constructor(
    message: string = 'Validation failed',
    validationErrors?: Record<string, string[]>
  ) {
    super(message, 'VALIDATION_ERROR', 400, validationErrors);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Server error (5xx)
 */
export class ServerError extends ApiError {
  constructor(message: string = 'Server error - please try again later', status: number = 500) {
    super(message, 'SERVER_ERROR', status);
    this.name = 'ServerError';
  }
}

/**
 * Request timeout error
 */
export class TimeoutError extends ApiError {
  readonly isTimeoutError = true;

  constructor(message: string = 'Request timed out - please try again') {
    super(message, 'TIMEOUT_ERROR', 408);
    this.name = 'TimeoutError';
  }
}

/**
 * Request cancelled error
 */
export class CancelledError extends ApiError {
  readonly isCancelledError = true;

  constructor(message: string = 'Request was cancelled') {
    super(message, 'CANCELLED_ERROR');
    this.name = 'CancelledError';
  }
}

/**
 * Offline error - device has no network connectivity
 */
export class OfflineError extends ApiError {
  readonly isOfflineError = true;

  constructor(message: string = 'You are offline - this action requires an internet connection') {
    super(message, 'OFFLINE_ERROR');
    this.name = 'OfflineError';
  }
}

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError || (error as any)?.isApiError === true;
}

/**
 * Type guard for network errors
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError || (error as any)?.isNetworkError === true;
}

/**
 * Type guard for auth errors
 */
export function isAuthError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError || (error as any)?.isAuthError === true;
}

/**
 * Type guard for timeout errors
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError || (error as any)?.isTimeoutError === true;
}

/**
 * Type guard for offline errors
 */
export function isOfflineError(error: unknown): error is OfflineError {
  return error instanceof OfflineError || (error as any)?.isOfflineError === true;
}

/**
 * Error code constants
 */
export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CANCELLED_ERROR: 'CANCELLED_ERROR',
  OFFLINE_ERROR: 'OFFLINE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
