/**
 * src/shared/utils/loadingDebug.ts
 *
 * Debug utilities for the loading system.
 * Enable with __DEV__ or LOADING_DEBUG flag.
 *
 * Features:
 * - State transition logging with timestamps
 * - Performance mark tracking
 * - Elapsed time tracking since app start
 */

// Enable debug logging in development or when explicitly enabled
const LOADING_DEBUG = __DEV__;

// Track app start time for elapsed calculations
const appStartTime = Date.now();

/**
 * Get elapsed time since app started (formatted).
 */
function getElapsed(): string {
  const elapsed = Date.now() - appStartTime;
  return `+${elapsed}ms`;
}

/**
 * Log a loading state transition.
 */
export function logLoadingTransition(
  source: string,
  event: 'show' | 'hide' | 'timeout' | 'complete',
  details?: Record<string, unknown>
): void {
  if (!LOADING_DEBUG) return;

  const timestamp = getElapsed();
  const prefix = `[Loading] [${timestamp}] [${source}]`;

  switch (event) {
    case 'show':
      console.log(`${prefix} SHOW`, details || '');
      break;
    case 'hide':
      console.log(`${prefix} HIDE`, details || '');
      break;
    case 'timeout':
      console.warn(`${prefix} TIMEOUT`, details || '');
      break;
    case 'complete':
      console.log(`${prefix} COMPLETE`, details || '');
      break;
  }
}

/**
 * Performance mark utilities.
 * Uses Performance API when available (React Native Hermes supports it).
 */
export const perfMarks = {
  /**
   * Mark the start of a phase.
   */
  start(name: string): void {
    if (!LOADING_DEBUG) return;
    try {
      performance.mark(`loading:${name}:start`);
    } catch {
      // Performance API not available
    }
  },

  /**
   * Mark the end of a phase and measure duration.
   */
  end(name: string): number | null {
    if (!LOADING_DEBUG) return null;
    try {
      performance.mark(`loading:${name}:end`);
      const measure = performance.measure(
        `loading:${name}`,
        `loading:${name}:start`,
        `loading:${name}:end`
      );
      console.log(`[Perf] ${name}: ${Math.round(measure.duration)}ms`);
      return measure.duration;
    } catch {
      return null;
    }
  },

  /**
   * Clear all loading marks.
   */
  clear(): void {
    if (!LOADING_DEBUG) return;
    try {
      performance.clearMarks();
      performance.clearMeasures();
    } catch {
      // Performance API not available
    }
  },
};

/**
 * Create a scoped logger for a specific component/screen.
 */
export function createLoadingLogger(scope: string) {
  return {
    show: (details?: Record<string, unknown>) =>
      logLoadingTransition(scope, 'show', details),
    hide: (details?: Record<string, unknown>) =>
      logLoadingTransition(scope, 'hide', details),
    timeout: (details?: Record<string, unknown>) =>
      logLoadingTransition(scope, 'timeout', details),
    complete: (details?: Record<string, unknown>) =>
      logLoadingTransition(scope, 'complete', details),
  };
}

/**
 * Debug summary of init step timings.
 * Call after initialization to print a formatted table.
 */
export function logInitTimings(
  stepTimings: Array<{ step: string; duration: number; status: string }>,
  totalTime: number
): void {
  if (!LOADING_DEBUG) return;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║     INITIALIZATION TIMING REPORT     ║');
  console.log('╠══════════════════════════════════════╣');

  for (const timing of stepTimings) {
    const icon = timing.status === 'success' ? '✓' : timing.status === 'timeout' ? '⏱' : '✗';
    const padded = timing.step.padEnd(15);
    const duration = `${timing.duration}ms`.padStart(8);
    console.log(`║  ${icon} ${padded} ${duration}        ║`);
  }

  console.log('╠══════════════════════════════════════╣');
  console.log(`║  TOTAL: ${`${totalTime}ms`.padStart(8)}                    ║`);
  console.log('╚══════════════════════════════════════╝\n');
}
