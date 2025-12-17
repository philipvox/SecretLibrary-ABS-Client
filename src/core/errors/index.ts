/**
 * src/core/errors/index.ts
 *
 * Error handling module exports
 */

// Types
export {
  type AppError,
  type ErrorCategory,
  type ErrorSeverity,
  type RecoveryStrategy,
  type ErrorCode,
  type ErrorHandler,
  type ErrorFilter,
  type CreateErrorOptions,
  isAppError,
  isNetworkError,
  isAuthError,
  isRecoverableError,
  NetworkErrorCode,
  AuthErrorCode,
  SyncErrorCode,
  DownloadErrorCode,
  PlaybackErrorCode,
  DatabaseErrorCode,
} from './types';

// Messages
export {
  errorMessages,
  getUserMessage,
  getRecoveryMessage,
  getCategoryMessage,
} from './errorMessages';

// Service
export {
  errorService,
  createError,
  wrapError,
  handleError,
  withRetry,
} from './errorService';

// Components
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';

// UI Components
export {
  ErrorToast,
  ErrorSheet,
  ErrorProvider,
  useErrorDisplay,
  useShowError,
} from './components';
