/**
 * src/shared/utils/logger.ts
 *
 * Centralized logging utility for consistent, environment-aware logging.
 *
 * Features:
 * - Log levels: debug, info, warn, error
 * - Module prefixes for easy filtering
 * - Environment-aware (debug/info only in __DEV__)
 * - Consistent timestamp formatting
 * - Easy replacement with production logging service later
 *
 * Usage:
 *   import { logger, createLogger } from '@/shared/utils/logger';
 *
 *   // Use default logger
 *   logger.debug('Something happened');
 *   logger.error('Something failed', error);
 *
 *   // Create module-specific logger
 *   const log = createLogger('MyComponent');
 *   log.debug('Component mounted');
 *   log.error('Failed to load data', err);
 */

// Environment check
const IS_DEV = __DEV__;

// Timestamp tracking
let lastLogTime = Date.now();
const _appStartTime = Date.now();

/**
 * Get formatted timestamp showing:
 * - Time since app start (total)
 * - Delta since last log (for identifying slow operations)
 */
function getTimestamp(): string {
  const now = Date.now();
  const delta = now - lastLogTime;
  lastLogTime = now;
  return `+${delta}ms`;
}

/**
 * Format log message with module prefix and timestamp
 */
function formatMessage(level: string, module: string | null, message: string): string {
  const timestamp = getTimestamp();
  const prefix = module ? `[${module}]` : '';
  return `${prefix}[${level} ${timestamp}] ${message}`;
}

/**
 * Log levels enum for filtering
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Current minimum log level (configurable)
 * In production, only WARN and ERROR are logged by default
 */
let currentLogLevel: LogLevel = IS_DEV ? LogLevel.DEBUG : LogLevel.WARN;

/**
 * Set the minimum log level
 * Logs below this level will be silenced
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Logger interface
 */
export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  /** Log with timing information */
  time: (label: string, startTime: number) => void;
  /** Create a child logger with additional prefix */
  child: (subModule: string) => Logger;
}

/**
 * Create a logger instance for a specific module
 *
 * @param module - Module name shown in log prefix (e.g., 'Auth', 'Player', 'API')
 * @returns Logger instance with debug, info, warn, error methods
 *
 * @example
 * const log = createLogger('AuthService');
 * log.debug('Checking session...'); // [AuthService][debug +10ms] Checking session...
 * log.error('Login failed', error); // [AuthService][error +5ms] Login failed { ... }
 */
export function createLogger(module: string): Logger {
  return {
    debug: (message: string, ...args: unknown[]) => {
      if (currentLogLevel <= LogLevel.DEBUG) {
        console.log(formatMessage('debug', module, message), ...args);
      }
    },

    info: (message: string, ...args: unknown[]) => {
      if (currentLogLevel <= LogLevel.INFO) {
        console.log(formatMessage('info', module, message), ...args);
      }
    },

    warn: (message: string, ...args: unknown[]) => {
      if (currentLogLevel <= LogLevel.WARN) {
        console.warn(formatMessage('warn', module, message), ...args);
      }
    },

    error: (message: string, ...args: unknown[]) => {
      if (currentLogLevel <= LogLevel.ERROR) {
        console.error(formatMessage('error', module, message), ...args);
      }
    },

    time: (label: string, startTime: number) => {
      if (currentLogLevel <= LogLevel.DEBUG) {
        const duration = Date.now() - startTime;
        console.log(`[${module}][timing] ${label}: ${duration}ms`);
      }
    },

    child: (subModule: string) => {
      return createLogger(`${module}:${subModule}`);
    },
  };
}

/**
 * Default application logger (no module prefix)
 * Use createLogger() for module-specific logging
 */
export const logger: Logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(formatMessage('debug', null, message), ...args);
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(formatMessage('info', null, message), ...args);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(formatMessage('warn', null, message), ...args);
    }
  },

  error: (message: string, ...args: unknown[]) => {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(formatMessage('error', null, message), ...args);
    }
  },

  time: (label: string, startTime: number) => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      const duration = Date.now() - startTime;
      console.log(`[timing] ${label}: ${duration}ms`);
    }
  },

  child: (subModule: string) => {
    return createLogger(subModule);
  },
};

// =============================================================================
// CONVENIENCE LOGGERS FOR COMMON MODULES
// =============================================================================

/** Logger for API/network operations */
export const apiLogger = createLogger('API');

/** Logger for authentication */
export const authLogger = createLogger('Auth');

/** Logger for player/audio operations */
export const playerLogger = createLogger('Player');

/** Logger for download operations */
export const downloadLogger = createLogger('Download');

/** Logger for cache operations */
export const cacheLogger = createLogger('Cache');

/** Logger for navigation */
export const navLogger = createLogger('Nav');

/** Logger for sync operations */
export const syncLogger = createLogger('Sync');

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Measure and log execution time of an async function
 *
 * @example
 * const result = await logTiming('fetchBooks', async () => {
 *   return await api.getBooks();
 * });
 */
export async function logTiming<T>(
  label: string,
  fn: () => Promise<T>,
  log: Logger = logger
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    log.time(label, startTime);
    return result;
  } catch (error) {
    log.error(`${label} failed after ${Date.now() - startTime}ms`, error);
    throw error;
  }
}

/**
 * Create a debug group that can be collapsed in console
 * Only executes in development
 */
export function logGroup(label: string, fn: () => void): void {
  if (IS_DEV && currentLogLevel <= LogLevel.DEBUG) {
    console.group(label);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }
}

/**
 * Log object with proper formatting
 */
export function logObject(label: string, obj: unknown, log: Logger = logger): void {
  if (currentLogLevel <= LogLevel.DEBUG) {
    log.debug(`${label}:`);
    console.dir(obj, { depth: 3 });
  }
}

export default logger;
