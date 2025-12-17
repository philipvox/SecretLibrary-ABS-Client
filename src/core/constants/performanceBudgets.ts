/**
 * src/core/constants/performanceBudgets.ts
 *
 * Performance budget thresholds for the app.
 * Used by performance monitoring hooks to log warnings.
 */

export const PERFORMANCE_BUDGETS = {
  /**
   * Screen mount/render time budgets
   * - warn: Log warning if exceeded
   * - error: Log error if exceeded
   */
  screenLoad: {
    warn: 250,  // ms
    error: 400, // ms
  },

  /**
   * App cold start budget (time to interactive)
   */
  coldStart: {
    warn: 2500,  // ms
    error: 3500, // ms
  },

  /**
   * Time from pressing play to audio starting
   */
  playbackStart: {
    warn: 400,  // ms
    error: 750, // ms
  },

  /**
   * Target frame rate during list scrolling
   */
  listScroll: {
    minFps: 55, // Target 60fps, warn below 55
  },

  /**
   * Network request timeouts
   */
  network: {
    api: 5000,      // Regular API calls
    download: 30000, // File downloads
    image: 3000,    // Image loading
  },

  /**
   * Cache operation budgets
   */
  cache: {
    read: 50,   // ms
    write: 100, // ms
  },

  /**
   * Animation/transition durations
   */
  animation: {
    micro: 150,   // Button press, etc.
    short: 250,   // Screen transitions
    medium: 350,  // Complex animations
    long: 500,    // Full-screen transitions
  },
} as const;

export type PerformanceBudgets = typeof PERFORMANCE_BUDGETS;
