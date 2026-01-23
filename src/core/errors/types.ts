/**
 * src/core/errors/types.ts
 *
 * Core error types and interfaces for the error handling system.
 * Provides a unified structure for categorizing and handling errors.
 */

/**
 * Error severity levels - determines UI treatment
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'network'      // Network/connectivity issues
  | 'auth'         // Authentication/authorization failures
  | 'sync'         // Progress sync errors
  | 'download'     // Download failures
  | 'playback'     // Audio playback errors
  | 'database'     // SQLite/storage errors
  | 'validation'   // Data validation errors
  | 'unknown';     // Unclassified errors

/**
 * Whether the error can be recovered from automatically
 */
export type RecoveryStrategy =
  | 'retry'        // Can retry the operation
  | 'offline'      // Can work offline
  | 'reauth'       // Needs re-authentication
  | 'manual'       // Requires user action
  | 'none';        // No recovery possible

/**
 * Core error interface - extends Error with additional metadata
 */
export interface AppError extends Error {
  /** Unique error code for identification */
  code: string;

  /** Error category for grouping */
  category: ErrorCategory;

  /** Severity level */
  severity: ErrorSeverity;

  /** Recovery strategy */
  recovery: RecoveryStrategy;

  /** User-friendly message */
  userMessage: string;

  /** Technical details for debugging */
  details?: Record<string, unknown>;

  /** Original error that caused this */
  cause?: Error;

  /** Timestamp when error occurred */
  timestamp: number;

  /** Whether user has been notified */
  notified?: boolean;

  /** Number of retry attempts made */
  retryCount?: number;

  /** Context where error occurred (supports both string and structured) */
  context?: string | ErrorContext;
}

/**
 * Network error codes
 */
export const NetworkErrorCode = {
  OFFLINE: 'NETWORK_OFFLINE',
  TIMEOUT: 'NETWORK_TIMEOUT',
  SERVER_ERROR: 'NETWORK_SERVER_ERROR',
  DNS_FAILURE: 'NETWORK_DNS_FAILURE',
  CONNECTION_REFUSED: 'NETWORK_CONNECTION_REFUSED',
  SSL_ERROR: 'NETWORK_SSL_ERROR',
} as const;

/**
 * Auth error codes
 */
export const AuthErrorCode = {
  TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
} as const;

/**
 * Sync error codes
 */
export const SyncErrorCode = {
  CONFLICT: 'SYNC_CONFLICT',
  FAILED: 'SYNC_FAILED',
  PARTIAL: 'SYNC_PARTIAL',
  QUEUE_FULL: 'SYNC_QUEUE_FULL',
} as const;

/**
 * Download error codes
 */
export const DownloadErrorCode = {
  STORAGE_FULL: 'DOWNLOAD_STORAGE_FULL',
  FILE_NOT_FOUND: 'DOWNLOAD_FILE_NOT_FOUND',
  INTERRUPTED: 'DOWNLOAD_INTERRUPTED',
  CORRUPTED: 'DOWNLOAD_CORRUPTED',
  PERMISSION_DENIED: 'DOWNLOAD_PERMISSION_DENIED',
} as const;

/**
 * Playback error codes
 */
export const PlaybackErrorCode = {
  FILE_NOT_FOUND: 'PLAYBACK_FILE_NOT_FOUND',
  UNSUPPORTED_FORMAT: 'PLAYBACK_UNSUPPORTED_FORMAT',
  DECODE_ERROR: 'PLAYBACK_DECODE_ERROR',
  STREAM_ERROR: 'PLAYBACK_STREAM_ERROR',
  AUDIO_SESSION: 'PLAYBACK_AUDIO_SESSION',
} as const;

/**
 * Database error codes
 */
export const DatabaseErrorCode = {
  OPEN_FAILED: 'DB_OPEN_FAILED',
  QUERY_FAILED: 'DB_QUERY_FAILED',
  WRITE_FAILED: 'DB_WRITE_FAILED',
  MIGRATION_FAILED: 'DB_MIGRATION_FAILED',
  CORRUPTED: 'DB_CORRUPTED',
} as const;

/**
 * All error codes combined
 */
export type ErrorCode =
  | (typeof NetworkErrorCode)[keyof typeof NetworkErrorCode]
  | (typeof AuthErrorCode)[keyof typeof AuthErrorCode]
  | (typeof SyncErrorCode)[keyof typeof SyncErrorCode]
  | (typeof DownloadErrorCode)[keyof typeof DownloadErrorCode]
  | (typeof PlaybackErrorCode)[keyof typeof PlaybackErrorCode]
  | (typeof DatabaseErrorCode)[keyof typeof DatabaseErrorCode];

/**
 * Error handler callback type
 */
export type ErrorHandler = (error: AppError) => void;

/**
 * Error filter for selective handling
 */
export interface ErrorFilter {
  categories?: ErrorCategory[];
  severities?: ErrorSeverity[];
  codes?: string[];
}

/**
 * Standardized error context structure
 * Ensures consistent context across all error handling
 */
export interface ErrorContext {
  /** Required: component/service/store name where error originated */
  source: string;
  /** Optional: current screen name for UI errors */
  screen?: string;
  /** Optional: what action was being attempted */
  action?: string;
  /** Optional: additional context-specific data */
  data?: Record<string, unknown>;
}

/**
 * Helper to create error context consistently
 */
export function createErrorContext(
  source: string,
  options?: Omit<ErrorContext, 'source'>
): ErrorContext {
  return { source, ...options };
}

/**
 * Options for creating an AppError
 */
export interface CreateErrorOptions {
  code: string;
  message: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  recovery?: RecoveryStrategy;
  userMessage?: string;
  details?: Record<string, unknown>;
  cause?: Error;
  /** @deprecated Use ErrorContext object instead of string */
  context?: string | ErrorContext;
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'category' in error &&
    'severity' in error &&
    'recovery' in error &&
    'userMessage' in error &&
    'timestamp' in error
  );
}

/**
 * Type guard for network errors
 */
export function isNetworkError(error: AppError): boolean {
  return error.category === 'network';
}

/**
 * Type guard for auth errors
 */
export function isAuthError(error: AppError): boolean {
  return error.category === 'auth';
}

/**
 * Type guard for recoverable errors
 */
export function isRecoverableError(error: AppError): boolean {
  return error.recovery !== 'none' && error.recovery !== 'manual';
}
