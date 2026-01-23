/**
 * src/core/constants/performanceBudgets.ts
 *
 * Performance budget thresholds for the app.
 * Used by performance monitoring hooks to log warnings.
 */

export const PERFORMANCE_BUDGETS = {
  /**
   * Default screen mount/render time budgets
   * - warn: Log warning if exceeded
   * - error: Log error if exceeded
   */
  screenLoad: {
    warn: 250,  // ms
    error: 400, // ms
  },

  /**
   * Per-screen budgets (ms) - override defaults for specific screens
   * Some screens are expected to take longer due to complexity
   */
  screens: {
    // Simple screens - should be fast
    HomeScreen: { warn: 200, error: 350 },
    ProfileScreen: { warn: 200, error: 350 },
    SettingsScreen: { warn: 150, error: 300 },

    // Medium complexity - data fetching
    MyLibraryScreen: { warn: 300, error: 500 },
    SearchScreen: { warn: 250, error: 400 },
    BrowseScreen: { warn: 300, error: 500 },

    // Complex screens - lots of data/rendering
    BookDetailScreen: { warn: 350, error: 600 },
    SecretLibraryBookDetailScreen: { warn: 400, error: 700 },
    SecretLibraryPlayerScreen: { warn: 400, error: 700 },
    CDPlayerScreen: { warn: 350, error: 600 },

    // List screens - may have many items
    SeriesListScreen: { warn: 300, error: 500 },
    AuthorsListScreen: { warn: 300, error: 500 },
    NarratorsListScreen: { warn: 300, error: 500 },
    GenresListScreen: { warn: 250, error: 450 },
    CollectionDetailScreen: { warn: 350, error: 600 },

    // Feature screens
    MoodDiscoveryScreen: { warn: 300, error: 500 },
    MoodResultsScreen: { warn: 350, error: 600 },
    DownloadsScreen: { warn: 250, error: 450 },
    QueueScreen: { warn: 250, error: 400 },
  } as Record<string, { warn: number; error: number }>,

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
