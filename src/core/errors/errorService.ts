/**
 * src/core/errors/errorService.ts
 *
 * Central error handling service. Provides:
 * - Error creation and classification
 * - Error logging and reporting
 * - Retry logic with exponential backoff
 * - Error notification management
 */

import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  ErrorHandler,
  ErrorFilter,
  CreateErrorOptions,
  ErrorContext,
  isAppError,
  NetworkErrorCode,
  AuthErrorCode,
  SyncErrorCode,
  DownloadErrorCode,
  PlaybackErrorCode,
  DatabaseErrorCode,
} from './types';
import { getUserMessage, getCategoryMessage } from './errorMessages';
import { captureError } from '../monitoring';
import { logger } from '@/shared/utils/logger';

/**
 * Default retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};

/**
 * Error history for deduplication
 */
interface ErrorHistoryEntry {
  code: string;
  timestamp: number;
  count: number;
}

/**
 * Central error service class
 */
class ErrorService {
  private handlers: Set<ErrorHandler> = new Set();
  private errorHistory: Map<string, ErrorHistoryEntry> = new Map();
  private readonly DEDUP_WINDOW = 5000; // 5 seconds
  private readonly MAX_HISTORY_SIZE = 100;

  /**
   * Create an AppError from options
   */
  createError(options: CreateErrorOptions): AppError {
    const {
      code,
      message,
      category = this.categorizeByCode(code),
      severity = this.getSeverityByCategory(category),
      recovery = this.getRecoveryByCategory(category),
      userMessage = getUserMessage(code) || getCategoryMessage(category),
      details,
      cause,
      context,
    } = options;

    const error = new Error(message) as AppError;
    error.name = 'AppError';
    error.code = code;
    error.category = category;
    error.severity = severity;
    error.recovery = recovery;
    error.userMessage = userMessage;
    error.details = details;
    error.cause = cause;
    error.context = context;
    error.timestamp = Date.now();
    error.retryCount = 0;
    error.notified = false;

    return error;
  }

  /**
   * Wrap any error into an AppError
   */
  wrap(error: unknown, options?: Partial<CreateErrorOptions>): AppError {
    // Already an AppError
    if (isAppError(error)) {
      return error;
    }

    // Standard Error
    if (error instanceof Error) {
      const classified = this.classifyError(error);
      return this.createError({
        code: options?.code || classified.code,
        message: error.message,
        category: options?.category || classified.category,
        severity: options?.severity,
        recovery: options?.recovery,
        userMessage: options?.userMessage,
        details: options?.details,
        cause: error,
        context: options?.context,
      });
    }

    // Unknown error type
    const message = typeof error === 'string' ? error : 'Unknown error';
    return this.createError({
      code: options?.code || 'UNKNOWN_ERROR',
      message,
      category: options?.category || 'unknown',
      ...options,
    });
  }

  /**
   * Handle an error - log, notify handlers, and optionally show to user
   * @param error - The error to handle
   * @param options.silent - If true, don't notify handlers
   * @param options.context - Error context (string for backwards compat, or structured ErrorContext)
   */
  handle(error: unknown, options?: { silent?: boolean; context?: string | ErrorContext }): AppError {
    const appError = isAppError(error) ? error : this.wrap(error, { context: options?.context });

    // Update context if provided
    if (options?.context && !appError.context) {
      appError.context = options.context;
    }

    // Log the error
    this.logError(appError);

    // Check for deduplication
    if (this.isDuplicate(appError)) {
      return appError;
    }

    // Record in history
    this.recordError(appError);

    // Notify handlers (unless silent)
    if (!options?.silent) {
      this.notifyHandlers(appError);
    }

    return appError;
  }

  /**
   * Subscribe to errors
   */
  subscribe(handler: ErrorHandler, filter?: ErrorFilter): () => void {
    const wrappedHandler: ErrorHandler = (error) => {
      if (filter && !this.matchesFilter(error, filter)) {
        return;
      }
      handler(error);
    };

    this.handlers.add(wrappedHandler);
    return () => this.handlers.delete(wrappedHandler);
  }

  /**
   * Execute with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryConfig> & { context?: string }
  ): Promise<T> {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options };
    let lastError: AppError | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.wrap(error, { context: options?.context });
        lastError.retryCount = attempt;

        // Don't retry non-recoverable errors
        if (lastError.recovery === 'none' || lastError.recovery === 'manual') {
          throw lastError;
        }

        // Don't retry auth errors (need reauth)
        if (lastError.category === 'auth') {
          throw lastError;
        }

        // Last attempt - throw
        if (attempt === config.maxRetries) {
          this.handle(lastError, { context: options?.context });
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt),
          config.maxDelay
        );

        // Log retry
        if (__DEV__) {
          logger.debug(
            `[ErrorService] Retry ${attempt + 1}/${config.maxRetries} after ${delay}ms:`,
            lastError.code
          );
        }

        await this.sleep(delay);
      }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError || new Error('Retry failed');
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory.clear();
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(): ErrorHistoryEntry[] {
    return Array.from(this.errorHistory.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }

  // =========================================================================
  // Private methods
  // =========================================================================

  private classifyError(error: Error): { code: string; category: ErrorCategory } {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      name.includes('network')
    ) {
      if (message.includes('timeout')) {
        return { code: NetworkErrorCode.TIMEOUT, category: 'network' };
      }
      if (message.includes('offline') || message.includes('no internet')) {
        return { code: NetworkErrorCode.OFFLINE, category: 'network' };
      }
      return { code: NetworkErrorCode.SERVER_ERROR, category: 'network' };
    }

    // Auth errors
    if (
      message.includes('unauthorized') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('token')
    ) {
      if (message.includes('expired')) {
        return { code: AuthErrorCode.TOKEN_EXPIRED, category: 'auth' };
      }
      return { code: AuthErrorCode.UNAUTHORIZED, category: 'auth' };
    }

    // Storage errors
    if (
      message.includes('storage') ||
      message.includes('disk') ||
      message.includes('space') ||
      message.includes('quota')
    ) {
      return { code: DownloadErrorCode.STORAGE_FULL, category: 'download' };
    }

    // Database errors
    if (
      message.includes('sqlite') ||
      message.includes('database') ||
      message.includes('sql')
    ) {
      return { code: DatabaseErrorCode.QUERY_FAILED, category: 'database' };
    }

    // Default
    return { code: 'UNKNOWN_ERROR', category: 'unknown' };
  }

  private categorizeByCode(code: string): ErrorCategory {
    if (code.startsWith('NETWORK_')) return 'network';
    if (code.startsWith('AUTH_')) return 'auth';
    if (code.startsWith('SYNC_')) return 'sync';
    if (code.startsWith('DOWNLOAD_')) return 'download';
    if (code.startsWith('PLAYBACK_')) return 'playback';
    if (code.startsWith('DB_')) return 'database';
    return 'unknown';
  }

  private getSeverityByCategory(category: ErrorCategory): ErrorSeverity {
    switch (category) {
      case 'auth':
        return 'high';
      case 'database':
        return 'high';
      case 'network':
        return 'medium';
      case 'sync':
        return 'low';
      case 'download':
        return 'medium';
      case 'playback':
        return 'medium';
      default:
        return 'medium';
    }
  }

  private getRecoveryByCategory(category: ErrorCategory): RecoveryStrategy {
    switch (category) {
      case 'network':
        return 'retry';
      case 'auth':
        return 'reauth';
      case 'sync':
        return 'retry';
      case 'download':
        return 'retry';
      case 'playback':
        return 'retry';
      case 'database':
        return 'manual';
      default:
        return 'retry';
    }
  }

  private logError(error: AppError): void {
    const prefix = `[Error:${error.category}]`;

    // Format context - supports both string and structured ErrorContext
    let contextStr = '';
    if (error.context) {
      if (typeof error.context === 'string') {
        contextStr = ` (${error.context})`;
      } else {
        // Structured context: format as "source:action@screen"
        const ctx = error.context as ErrorContext;
        const parts = [ctx.source];
        if (ctx.action) parts.push(ctx.action);
        if (ctx.screen) parts.push(`@${ctx.screen}`);
        contextStr = ` (${parts.join(':')})`;
      }
    }

    if (__DEV__) {
      logger.error(`${prefix}${contextStr} ${error.code}: ${error.message}`);
      if (error.details) {
        logger.error('Details:', error.details);
      }
      if (error.cause) {
        logger.error('Cause:', error.cause);
      }
    }

    // Build Sentry details including structured context
    const sentryDetails: Record<string, unknown> = {
      ...error.details,
    };
    if (error.context && typeof error.context === 'object') {
      sentryDetails.errorContext = error.context;
    }

    // Send to Sentry in production (gracefully degrades if not configured)
    captureError(error.cause instanceof Error ? error.cause : new Error(error.message), {
      category: error.category,
      code: error.code,
      details: sentryDetails,
      level: error.severity === 'critical' ? 'fatal' : error.severity === 'high' ? 'error' : 'warning',
    });
  }

  private getContextKey(context: string | ErrorContext | undefined): string {
    if (!context) return '';
    if (typeof context === 'string') return context;
    // Structured context: use source as primary key component
    return context.source + (context.action ? `:${context.action}` : '');
  }

  private isDuplicate(error: AppError): boolean {
    const key = `${error.code}:${this.getContextKey(error.context)}`;
    const entry = this.errorHistory.get(key);

    if (!entry) return false;

    const timeSinceFirst = error.timestamp - entry.timestamp;
    return timeSinceFirst < this.DEDUP_WINDOW;
  }

  private recordError(error: AppError): void {
    const key = `${error.code}:${this.getContextKey(error.context)}`;
    const existing = this.errorHistory.get(key);

    if (existing) {
      existing.count++;
      existing.timestamp = error.timestamp;
    } else {
      this.errorHistory.set(key, {
        code: error.code,
        timestamp: error.timestamp,
        count: 1,
      });
    }

    // Prune old entries
    if (this.errorHistory.size > this.MAX_HISTORY_SIZE) {
      const entries = Array.from(this.errorHistory.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      const toRemove = entries.slice(0, this.errorHistory.size - this.MAX_HISTORY_SIZE);
      toRemove.forEach(([key]) => this.errorHistory.delete(key));
    }
  }

  private notifyHandlers(error: AppError): void {
    this.handlers.forEach((handler) => {
      try {
        handler(error);
      } catch (e) {
        if (__DEV__) {
          logger.error('[ErrorService] Handler threw:', e);
        }
      }
    });
    error.notified = true;
  }

  private matchesFilter(error: AppError, filter: ErrorFilter): boolean {
    if (filter.categories && !filter.categories.includes(error.category)) {
      return false;
    }
    if (filter.severities && !filter.severities.includes(error.severity)) {
      return false;
    }
    if (filter.codes && !filter.codes.includes(error.code)) {
      return false;
    }
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorService = new ErrorService();

// Export convenience functions
export const createError = errorService.createError.bind(errorService);
export const wrapError = errorService.wrap.bind(errorService);
export const handleError = errorService.handle.bind(errorService);
export const withRetry = errorService.withRetry.bind(errorService);
