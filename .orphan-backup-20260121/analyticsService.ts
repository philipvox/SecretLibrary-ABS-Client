/**
 * src/core/analytics/analyticsService.ts
 *
 * Unified analytics service for tracking user engagement, feature usage,
 * and performance metrics. Integrates with Sentry and can be extended
 * to support other analytics backends (Amplitude, Mixpanel, etc.).
 *
 * Key features:
 * - Session tracking with duration
 * - Screen view analytics
 * - Feature usage events
 * - Performance metrics collection
 * - Batched event sending (reduces network overhead)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { trackEvent, addBreadcrumb } from '../monitoring/sentry';
import { PERFORMANCE_BUDGETS } from '../constants/performanceBudgets';

// =============================================================================
// Types
// =============================================================================

export interface AnalyticsEvent {
  name: string;
  timestamp: number;
  properties?: Record<string, unknown>;
  category: EventCategory;
}

export type EventCategory =
  | 'navigation'
  | 'playback'
  | 'download'
  | 'search'
  | 'library'
  | 'user'
  | 'performance'
  | 'error';

export interface SessionInfo {
  id: string;
  startTime: number;
  endTime?: number;
  screenViews: number;
  eventsCount: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEYS = {
  SESSION: '@analytics:session',
  PENDING_EVENTS: '@analytics:pending_events',
  METRICS: '@analytics:metrics',
};

const MAX_PENDING_EVENTS = 100;
const MAX_METRICS = 500; // Bound metrics array to prevent memory leak
const BATCH_FLUSH_INTERVAL = 60000; // 1 minute

// =============================================================================
// Analytics Service
// =============================================================================

class AnalyticsService {
  private session: SessionInfo | null = null;
  private pendingEvents: AnalyticsEvent[] = [];
  private metrics: PerformanceMetric[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private isInitialized = false;

  /**
   * Initialize analytics service.
   * Call this at app startup.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Restore pending events from storage
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_EVENTS);
      if (stored) {
        this.pendingEvents = JSON.parse(stored);
      }

      // Start new session
      this.session = {
        id: this.generateSessionId(),
        startTime: Date.now(),
        screenViews: 0,
        eventsCount: 0,
      };

      // Track app state changes
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

      // Start batch flush interval
      this.flushInterval = setInterval(() => this.flush(), BATCH_FLUSH_INTERVAL);

      this.isInitialized = true;

      // Track session start
      this.track('session_start', {}, 'user');

      if (__DEV__) {
        console.log('[Analytics] Initialized with session:', this.session.id);
      }
    } catch (error) {
      // Clean up any resources that were set up before the error
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
        this.flushInterval = null;
      }
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }
      this.session = null;
      console.error('[Analytics] Failed to initialize:', error);
    }
  }

  /**
   * Track a custom event.
   */
  track(
    name: string,
    properties: Record<string, unknown> = {},
    category: EventCategory = 'user'
  ): void {
    const event: AnalyticsEvent = {
      name,
      timestamp: Date.now(),
      properties: {
        ...properties,
        sessionId: this.session?.id,
      },
      category,
    };

    this.pendingEvents.push(event);
    if (this.session) {
      this.session.eventsCount++;
    }

    // Trim if over limit
    if (this.pendingEvents.length > MAX_PENDING_EVENTS) {
      this.pendingEvents = this.pendingEvents.slice(-MAX_PENDING_EVENTS);
    }

    // Also track via Sentry for breadcrumbs
    trackEvent(name, properties);

    if (__DEV__) {
      console.log(`[Analytics] ${category}/${name}`, properties);
    }
  }

  /**
   * Track a screen view.
   */
  trackScreen(screenName: string, params?: Record<string, unknown>): void {
    if (this.session) {
      this.session.screenViews++;
    }

    this.track('screen_view', { screenName, ...params }, 'navigation');
    addBreadcrumb(`Viewed ${screenName}`, 'navigation');
  }

  /**
   * Track a performance metric.
   */
  trackPerformance(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    };

    this.metrics.push(metric);

    // Trim if over limit to prevent memory leak
    if (this.metrics.length > MAX_METRICS) {
      this.metrics = this.metrics.slice(-MAX_METRICS);
    }

    // Check against budgets and warn if exceeded
    this.checkPerformanceBudget(name, value);

    this.track('performance', { metric: name, value, ...tags }, 'performance');
  }

  /**
   * Track app cold start time.
   */
  trackColdStart(durationMs: number): void {
    this.trackPerformance('cold_start', durationMs, { type: 'startup' });
  }

  /**
   * Track screen load time.
   */
  trackScreenLoad(screenName: string, durationMs: number): void {
    this.trackPerformance('screen_load', durationMs, { screen: screenName });
  }

  /**
   * Track playback start time.
   */
  trackPlaybackStart(durationMs: number, bookId: string): void {
    this.trackPerformance('playback_start', durationMs, { bookId });
  }

  /**
   * Track API response time.
   */
  trackApiLatency(endpoint: string, durationMs: number, status: number): void {
    this.trackPerformance('api_latency', durationMs, {
      endpoint,
      status: String(status),
    });
  }

  // =============================================================================
  // Playback Events
  // =============================================================================

  trackPlayStart(bookId: string, position: number, source: string): void {
    this.track('play_start', { bookId, position, source }, 'playback');
  }

  trackPlayPause(bookId: string, position: number, duration: number): void {
    this.track('play_pause', { bookId, position, listeningDuration: duration }, 'playback');
  }

  trackPlayComplete(bookId: string, totalDuration: number): void {
    this.track('play_complete', { bookId, totalDuration }, 'playback');
  }

  trackSeek(bookId: string, from: number, to: number): void {
    this.track('seek', { bookId, from, to, delta: to - from }, 'playback');
  }

  trackSpeedChange(bookId: string, oldSpeed: number, newSpeed: number): void {
    this.track('speed_change', { bookId, oldSpeed, newSpeed }, 'playback');
  }

  trackChapterChange(bookId: string, chapterIndex: number, chapterTitle: string): void {
    this.track('chapter_change', { bookId, chapterIndex, chapterTitle }, 'playback');
  }

  trackSleepTimer(action: 'set' | 'cancelled' | 'triggered', duration?: number): void {
    this.track('sleep_timer', { action, duration }, 'playback');
  }

  // =============================================================================
  // Download Events
  // =============================================================================

  trackDownloadStart(bookId: string, fileCount: number, totalSize: number): void {
    this.track('download_start', { bookId, fileCount, totalSize }, 'download');
  }

  trackDownloadComplete(bookId: string, durationMs: number, totalSize: number): void {
    this.track('download_complete', { bookId, durationMs, totalSize }, 'download');
    this.trackPerformance('download_time', durationMs, { bookId });
  }

  trackDownloadError(bookId: string, error: string, fileIndex?: number): void {
    this.track('download_error', { bookId, error, fileIndex }, 'download');
  }

  trackDownloadDelete(bookId: string): void {
    this.track('download_delete', { bookId }, 'download');
  }

  // =============================================================================
  // Search Events
  // =============================================================================

  trackSearch(query: string, resultCount: number, durationMs: number): void {
    this.track('search', {
      queryLength: query.length,
      resultCount,
      durationMs,
    }, 'search');
    this.trackPerformance('search_time', durationMs);
  }

  trackSearchResultClick(query: string, itemId: string, position: number): void {
    this.track('search_result_click', {
      queryLength: query.length,
      itemId,
      position,
    }, 'search');
  }

  // =============================================================================
  // Library Events
  // =============================================================================

  trackLibraryFilter(filterType: string, value: string): void {
    this.track('library_filter', { filterType, value }, 'library');
  }

  trackLibrarySort(sortBy: string, ascending: boolean): void {
    this.track('library_sort', { sortBy, ascending }, 'library');
  }

  trackBookOpen(bookId: string, source: string): void {
    this.track('book_open', { bookId, source }, 'library');
  }

  trackSeriesOpen(seriesId: string): void {
    this.track('series_open', { seriesId }, 'library');
  }

  trackAuthorOpen(authorId: string): void {
    this.track('author_open', { authorId }, 'library');
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Get current session info.
   */
  getSession(): SessionInfo | null {
    return this.session;
  }

  /**
   * Get performance metrics summary.
   */
  getMetricsSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          avg: metric.value,
          min: metric.value,
          max: metric.value,
          count: 1,
        };
      } else {
        const s = summary[metric.name];
        s.count++;
        s.avg = (s.avg * (s.count - 1) + metric.value) / s.count;
        s.min = Math.min(s.min, metric.value);
        s.max = Math.max(s.max, metric.value);
      }
    }

    return summary;
  }

  /**
   * Flush pending events to storage/backend.
   */
  async flush(): Promise<void> {
    if (this.pendingEvents.length === 0) return;

    try {
      // Persist to storage
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_EVENTS,
        JSON.stringify(this.pendingEvents)
      );

      // In production, you would send to your analytics backend here
      // await this.sendToBackend(this.pendingEvents);

      if (__DEV__) {
        console.log(`[Analytics] Flushed ${this.pendingEvents.length} events`);
      }
    } catch (error) {
      console.error('[Analytics] Failed to flush events:', error);
    }
  }

  /**
   * End the current session.
   */
  async endSession(): Promise<void> {
    if (this.session) {
      this.session.endTime = Date.now();
      const duration = this.session.endTime - this.session.startTime;

      this.track('session_end', {
        duration,
        screenViews: this.session.screenViews,
        eventsCount: this.session.eventsCount,
      }, 'user');

      await this.flush();
    }
  }

  /**
   * Cleanup on app termination.
   */
  async cleanup(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    await this.endSession();
    this.isInitialized = false;
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state === 'background') {
      this.track('app_background', {}, 'user');
      this.flush();
    } else if (state === 'active') {
      this.track('app_foreground', {}, 'user');
    }
  };

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private checkPerformanceBudget(name: string, value: number): void {
    const budgets: Record<string, { warn: number; error: number }> = {
      cold_start: PERFORMANCE_BUDGETS.coldStart,
      screen_load: PERFORMANCE_BUDGETS.screenLoad,
      playback_start: PERFORMANCE_BUDGETS.playbackStart,
    };

    const budget = budgets[name];
    if (!budget) return;

    if (value >= budget.error) {
      console.error(`[Analytics] PERF BUDGET EXCEEDED: ${name} = ${value}ms (budget: ${budget.error}ms)`);
      this.track('perf_budget_exceeded', { metric: name, value, budget: budget.error }, 'error');
    } else if (value >= budget.warn) {
      console.warn(`[Analytics] PERF WARNING: ${name} = ${value}ms (budget: ${budget.warn}ms)`);
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const analyticsService = new AnalyticsService();
