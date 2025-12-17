/**
 * src/core/hooks/useScreenLoadTime.ts
 *
 * Hook to measure and log screen mount/render times.
 * Helps identify slow screens during development.
 */

import { useEffect, useRef } from 'react';
import { PERFORMANCE_BUDGETS } from '../constants/performanceBudgets';

// Only log in development
const isDev = __DEV__;

/**
 * Measure screen load time and log warnings if over budget.
 *
 * @param screenName - Name of the screen for logging
 * @param options - Optional configuration
 *
 * @example
 * ```tsx
 * function HomeScreen() {
 *   useScreenLoadTime('HomeScreen');
 *   return <View>...</View>;
 * }
 * ```
 */
export function useScreenLoadTime(
  screenName: string,
  options?: {
    /** Custom warn threshold in ms (default: from budgets) */
    warnThreshold?: number;
    /** Custom error threshold in ms (default: from budgets) */
    errorThreshold?: number;
    /** Always log, even if within budget */
    verbose?: boolean;
  }
) {
  const startTime = useRef(performance.now());
  const hasLogged = useRef(false);

  useEffect(() => {
    if (!isDev || hasLogged.current) return;
    hasLogged.current = true;

    const duration = performance.now() - startTime.current;
    const warnThreshold = options?.warnThreshold ?? PERFORMANCE_BUDGETS.screenLoad.warn;
    const errorThreshold = options?.errorThreshold ?? PERFORMANCE_BUDGETS.screenLoad.error;

    if (duration >= errorThreshold) {
      console.error(
        `[PERF] ${screenName} mounted in ${duration.toFixed(0)}ms (exceeds ${errorThreshold}ms budget)`
      );
    } else if (duration >= warnThreshold) {
      console.warn(
        `[PERF] ${screenName} mounted in ${duration.toFixed(0)}ms (exceeds ${warnThreshold}ms budget)`
      );
    } else if (options?.verbose) {
      console.log(`[PERF] ${screenName} mounted in ${duration.toFixed(0)}ms`);
    }
  }, [screenName, options?.warnThreshold, options?.errorThreshold, options?.verbose]);
}

/**
 * Measure time for an async operation.
 *
 * @param operationName - Name of the operation for logging
 * @param operation - Async function to measure
 * @returns Result of the operation
 *
 * @example
 * ```tsx
 * const data = await measureAsync('fetchBooks', () => api.getBooks());
 * ```
 */
export async function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>,
  options?: {
    warnThreshold?: number;
    errorThreshold?: number;
  }
): Promise<T> {
  if (!isDev) {
    return operation();
  }

  const startTime = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - startTime;

    const warnThreshold = options?.warnThreshold ?? 500;
    const errorThreshold = options?.errorThreshold ?? 1000;

    if (duration >= errorThreshold) {
      console.error(`[PERF] ${operationName} took ${duration.toFixed(0)}ms`);
    } else if (duration >= warnThreshold) {
      console.warn(`[PERF] ${operationName} took ${duration.toFixed(0)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[PERF] ${operationName} failed after ${duration.toFixed(0)}ms`);
    throw error;
  }
}

/**
 * Create a performance marker for manual timing.
 *
 * @example
 * ```tsx
 * const marker = createPerfMarker('dataProcessing');
 * // ... do work ...
 * marker.end(); // Logs: [PERF] dataProcessing: 123ms
 * ```
 */
export function createPerfMarker(name: string) {
  const startTime = performance.now();

  return {
    end: () => {
      if (!isDev) return 0;
      const duration = performance.now() - startTime;
      console.log(`[PERF] ${name}: ${duration.toFixed(0)}ms`);
      return duration;
    },
    elapsed: () => performance.now() - startTime,
  };
}
