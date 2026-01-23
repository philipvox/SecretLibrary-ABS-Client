/**
 * src/core/analytics/useAnalytics.ts
 *
 * React hooks for analytics tracking.
 * Provides convenient access to analytics in components.
 */

import { useEffect, useRef } from 'react';
import { analyticsService, type EventCategory } from './analyticsService';
import { PERFORMANCE_BUDGETS } from '../constants/performanceBudgets';

/**
 * Track screen view and load time.
 * Call this at the top of your screen component.
 *
 * @example
 * ```tsx
 * function HomeScreen() {
 *   useScreenAnalytics('HomeScreen');
 *   return <View>...</View>;
 * }
 * ```
 */
export function useScreenAnalytics(
  screenName: string,
  params?: Record<string, unknown>
): void {
  const startTime = useRef(performance.now());
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;

    const loadTime = performance.now() - startTime.current;

    // Track screen view
    analyticsService.trackScreen(screenName, params);

    // Track screen load time
    analyticsService.trackScreenLoad(screenName, loadTime);
  }, [screenName, params]);
}

/**
 * Hook for tracking custom events.
 * Returns a track function that can be called on user actions.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { track, trackPlayback, trackSearch } = useAnalytics();
 *
 *   const handlePress = () => {
 *     track('button_press', { buttonId: 'play' });
 *   };
 *
 *   return <Button onPress={handlePress} />;
 * }
 * ```
 */
export function useAnalytics() {
  return {
    track: (name: string, properties?: Record<string, unknown>, category?: EventCategory) =>
      analyticsService.track(name, properties, category),

    // Playback
    trackPlayStart: analyticsService.trackPlayStart.bind(analyticsService),
    trackPlayPause: analyticsService.trackPlayPause.bind(analyticsService),
    trackPlayComplete: analyticsService.trackPlayComplete.bind(analyticsService),
    trackSeek: analyticsService.trackSeek.bind(analyticsService),
    trackSpeedChange: analyticsService.trackSpeedChange.bind(analyticsService),
    trackChapterChange: analyticsService.trackChapterChange.bind(analyticsService),
    trackSleepTimer: analyticsService.trackSleepTimer.bind(analyticsService),

    // Downloads
    trackDownloadStart: analyticsService.trackDownloadStart.bind(analyticsService),
    trackDownloadComplete: analyticsService.trackDownloadComplete.bind(analyticsService),
    trackDownloadError: analyticsService.trackDownloadError.bind(analyticsService),
    trackDownloadDelete: analyticsService.trackDownloadDelete.bind(analyticsService),

    // Search
    trackSearch: analyticsService.trackSearch.bind(analyticsService),
    trackSearchResultClick: analyticsService.trackSearchResultClick.bind(analyticsService),

    // Library
    trackBookOpen: analyticsService.trackBookOpen.bind(analyticsService),
    trackSeriesOpen: analyticsService.trackSeriesOpen.bind(analyticsService),
    trackAuthorOpen: analyticsService.trackAuthorOpen.bind(analyticsService),
    trackLibraryFilter: analyticsService.trackLibraryFilter.bind(analyticsService),
    trackLibrarySort: analyticsService.trackLibrarySort.bind(analyticsService),

    // Performance
    trackPerformance: analyticsService.trackPerformance.bind(analyticsService),
  };
}

/**
 * Track timing for an async operation.
 * Automatically logs if the operation exceeds its budget.
 *
 * @example
 * ```tsx
 * const { time } = useTimingAnalytics();
 *
 * const data = await time('fetchBooks', async () => {
 *   return await api.getBooks();
 * });
 * ```
 */
export function useTimingAnalytics() {
  const time = async <T>(
    name: string,
    operation: () => Promise<T>,
    options?: {
      warnThreshold?: number;
      errorThreshold?: number;
      tags?: Record<string, string>;
    }
  ): Promise<T> => {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      analyticsService.trackPerformance(name, duration, options?.tags);

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      analyticsService.track(`${name}_error`, { duration, error: String(error) }, 'error');
      throw error;
    }
  };

  return { time };
}

/**
 * Track playback session duration.
 * Returns functions to start/end tracking.
 *
 * @example
 * ```tsx
 * const { startSession, endSession } = usePlaybackSessionAnalytics('book-123');
 *
 * useEffect(() => {
 *   if (isPlaying) startSession();
 *   else endSession();
 * }, [isPlaying]);
 * ```
 */
export function usePlaybackSessionAnalytics(bookId: string) {
  const sessionStart = useRef<number | null>(null);

  const startSession = () => {
    sessionStart.current = Date.now();
    analyticsService.trackPlayStart(bookId, 0, 'session');
  };

  const endSession = () => {
    if (sessionStart.current) {
      const duration = Date.now() - sessionStart.current;
      analyticsService.trackPlayPause(bookId, 0, duration);
      sessionStart.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionStart.current) {
        const duration = Date.now() - sessionStart.current;
        analyticsService.trackPlayPause(bookId, 0, duration);
      }
    };
  }, [bookId]);

  return { startSession, endSession };
}

/**
 * Track cold start time from app launch.
 * Call this once when the app first becomes interactive.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * function App() {
 *   useColdStartAnalytics();
 *   return <RootNavigator />;
 * }
 * ```
 */
export function useColdStartAnalytics() {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;

    // Get launch time from global (set in index.js or App.tsx)
    // @ts-ignore
    const launchTime = global.__APP_LAUNCH_TIME__;
    if (launchTime) {
      const coldStartDuration = performance.now() + (Date.now() - launchTime);
      analyticsService.trackColdStart(coldStartDuration);
    }
  }, []);
}
