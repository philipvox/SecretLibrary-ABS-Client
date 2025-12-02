/**
 * src/features/player/utils/seekLogger.ts
 *
 * Debug logging for seek operations.
 * Provides structured logging to help diagnose seek-related issues.
 */

const SEEK_DEBUG = __DEV__;

interface LogData {
  [key: string]: unknown;
}

/**
 * Format a timestamp for logging
 */
function formatTimestamp(): string {
  return new Date().toISOString().split('T')[1].slice(0, -1);
}

/**
 * Format position in seconds to mm:ss format
 */
function formatPosition(seconds: number): string {
  const mins = Math.floor(Math.abs(seconds) / 60);
  const secs = Math.floor(Math.abs(seconds) % 60);
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Structured logging for seek operations
 */
export const seekLog = {
  /**
   * Log the start of a seek operation
   */
  start: (type: string, params: LogData = {}) => {
    if (!SEEK_DEBUG) return;
    console.log(`[SEEK:START] ${type}`, {
      timestamp: formatTimestamp(),
      ...params,
    });
  },

  /**
   * Log a step within a seek operation
   */
  step: (step: string, data?: LogData) => {
    if (!SEEK_DEBUG) return;
    console.log(`[SEEK:STEP] ${step}`, data || '');
  },

  /**
   * Log the end of a seek operation
   */
  end: (type: string, result: LogData = {}) => {
    if (!SEEK_DEBUG) return;
    console.log(`[SEEK:END] ${type}`, {
      timestamp: formatTimestamp(),
      ...result,
    });
  },

  /**
   * Log a seek error
   */
  error: (type: string, error: Error | string) => {
    console.error(`[SEEK:ERROR] ${type}`, error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(`[SEEK:ERROR] Stack:`, error.stack);
    }
  },

  /**
   * Log a warning
   */
  warn: (message: string, data?: LogData) => {
    if (!SEEK_DEBUG) return;
    console.warn(`[SEEK:WARN] ${message}`, data || '');
  },

  /**
   * Log lock acquisition/release
   */
  lock: (action: 'acquire' | 'release' | 'blocked', data?: LogData) => {
    if (!SEEK_DEBUG) return;
    console.log(`[SEEK:LOCK] ${action}`, data || '');
  },

  /**
   * Log chapter boundary crossing
   */
  chapterCrossing: (from: number, to: number, data?: LogData) => {
    if (!SEEK_DEBUG) return;
    console.log(`[SEEK:CHAPTER] Crossing from chapter ${from} to ${to}`, data || '');
  },

  /**
   * Log position confirmation
   */
  positionConfirm: (target: number, actual: number, confirmed: boolean) => {
    if (!SEEK_DEBUG) return;
    const status = confirmed ? 'CONFIRMED' : 'FAILED';
    console.log(
      `[SEEK:POSITION] ${status} target=${formatPosition(target)} actual=${formatPosition(actual)} diff=${Math.abs(target - actual).toFixed(2)}s`
    );
  },

  /**
   * Log animation state changes
   */
  animation: (action: 'suspend' | 'resume', reason?: string) => {
    if (!SEEK_DEBUG) return;
    console.log(`[SEEK:ANIM] ${action}`, reason ? { reason } : '');
  },

  /**
   * Log continuous seek state
   */
  continuous: (action: 'start' | 'tick' | 'stop', data?: LogData) => {
    if (!SEEK_DEBUG) return;
    // Don't log every tick in production, too noisy
    if (action === 'tick' && !SEEK_DEBUG) return;
    console.log(`[SEEK:CONTINUOUS] ${action}`, data || '');
  },

  /**
   * Create a timer for measuring operation duration
   */
  timer: (operation: string) => {
    const startTime = Date.now();
    return {
      /**
       * Log elapsed time for a step
       */
      step: (step: string) => {
        if (!SEEK_DEBUG) return;
        const elapsed = Date.now() - startTime;
        console.log(`[SEEK:TIMER] ${operation}:${step} +${elapsed}ms`);
      },
      /**
       * Log total elapsed time
       */
      end: () => {
        if (!SEEK_DEBUG) return;
        const elapsed = Date.now() - startTime;
        console.log(`[SEEK:TIMER] ${operation} completed in ${elapsed}ms`);
      },
    };
  },
};

/**
 * Utility to format position for display
 */
export { formatPosition };
