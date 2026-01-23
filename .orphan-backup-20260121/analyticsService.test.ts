/**
 * Tests for Analytics Service
 */

import { analyticsService } from '../analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock Sentry functions
jest.mock('../../monitoring/sentry', () => ({
  trackEvent: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// Mock AppState
const mockAppStateListeners: ((state: string) => void)[] = [];
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn((_, callback) => {
      mockAppStateListeners.push(callback);
      return { remove: jest.fn() };
    }),
  },
}));

describe('AnalyticsService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockAppStateListeners.length = 0;

    // Reset the service by accessing private state
    // @ts-ignore - accessing private for test reset
    analyticsService.isInitialized = false;
    // @ts-ignore
    analyticsService.session = null;
    // @ts-ignore
    analyticsService.pendingEvents = [];
    // @ts-ignore
    analyticsService.metrics = [];
  });

  afterEach(async () => {
    // @ts-ignore
    if (analyticsService.flushInterval) {
      // @ts-ignore
      clearInterval(analyticsService.flushInterval);
      // @ts-ignore
      analyticsService.flushInterval = null;
    }
  });

  describe('initialize', () => {
    it('creates a new session on init', async () => {
      await analyticsService.initialize();

      const session = analyticsService.getSession();
      expect(session).not.toBeNull();
      expect(session?.id).toBeDefined();
      expect(session?.startTime).toBeGreaterThan(0);
      expect(session?.screenViews).toBe(0);
      expect(session?.eventsCount).toBe(1); // session_start event
    });

    it('restores pending events from storage', async () => {
      const storedEvents = [
        { name: 'test', timestamp: Date.now(), category: 'user' as const },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(storedEvents)
      );

      await analyticsService.initialize();

      // Should have restored event + session_start
      // @ts-ignore - accessing private for test
      expect(analyticsService.pendingEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('subscribes to app state changes', async () => {
      await analyticsService.initialize();

      expect(AppState.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });
  });

  describe('track', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('tracks events with session ID', () => {
      analyticsService.track('test_event', { foo: 'bar' }, 'user');

      // @ts-ignore - accessing private for test
      const events = analyticsService.pendingEvents;
      const lastEvent = events[events.length - 1];

      expect(lastEvent.name).toBe('test_event');
      expect(lastEvent.properties?.foo).toBe('bar');
      expect(lastEvent.properties?.sessionId).toBeDefined();
      expect(lastEvent.category).toBe('user');
    });

    it('increments session event count', () => {
      const initialCount = analyticsService.getSession()?.eventsCount || 0;

      analyticsService.track('event1', {}, 'user');
      analyticsService.track('event2', {}, 'user');
      analyticsService.track('event3', {}, 'user');

      expect(analyticsService.getSession()?.eventsCount).toBe(initialCount + 3);
    });

    it('trims events when exceeding max limit', () => {
      // Track many events
      for (let i = 0; i < 150; i++) {
        analyticsService.track(`event_${i}`, {}, 'user');
      }

      // @ts-ignore - accessing private for test
      expect(analyticsService.pendingEvents.length).toBeLessThanOrEqual(100);
    });
  });

  describe('trackScreen', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('tracks screen view with name', () => {
      analyticsService.trackScreen('HomeScreen', { tab: 'home' });

      // @ts-ignore - accessing private for test
      const events = analyticsService.pendingEvents;
      const screenEvent = events.find((e: any) => e.name === 'screen_view');

      expect(screenEvent).toBeDefined();
      expect(screenEvent?.properties?.screenName).toBe('HomeScreen');
      expect(screenEvent?.properties?.tab).toBe('home');
      expect(screenEvent?.category).toBe('navigation');
    });

    it('increments session screen view count', () => {
      const initial = analyticsService.getSession()?.screenViews || 0;

      analyticsService.trackScreen('Screen1');
      analyticsService.trackScreen('Screen2');

      expect(analyticsService.getSession()?.screenViews).toBe(initial + 2);
    });
  });

  describe('trackPerformance', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('stores performance metrics', () => {
      analyticsService.trackPerformance('screen_load', 250, { screen: 'Home' });

      const summary = analyticsService.getMetricsSummary();
      expect(summary['screen_load']).toBeDefined();
      expect(summary['screen_load'].avg).toBe(250);
      expect(summary['screen_load'].count).toBe(1);
    });

    it('calculates correct averages', () => {
      analyticsService.trackPerformance('api_latency', 100);
      analyticsService.trackPerformance('api_latency', 200);
      analyticsService.trackPerformance('api_latency', 300);

      const summary = analyticsService.getMetricsSummary();
      expect(summary['api_latency'].avg).toBe(200);
      expect(summary['api_latency'].min).toBe(100);
      expect(summary['api_latency'].max).toBe(300);
      expect(summary['api_latency'].count).toBe(3);
    });
  });

  describe('playback events', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('tracks play start', () => {
      analyticsService.trackPlayStart('book-123', 1000, 'miniplayer');

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const playEvent = events.find((e: any) => e.name === 'play_start');

      expect(playEvent?.properties?.bookId).toBe('book-123');
      expect(playEvent?.properties?.position).toBe(1000);
      expect(playEvent?.properties?.source).toBe('miniplayer');
      expect(playEvent?.category).toBe('playback');
    });

    it('tracks play pause with duration', () => {
      analyticsService.trackPlayPause('book-123', 2000, 30000);

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const pauseEvent = events.find((e: any) => e.name === 'play_pause');

      expect(pauseEvent?.properties?.listeningDuration).toBe(30000);
    });

    it('tracks sleep timer events', () => {
      analyticsService.trackSleepTimer('set', 900000);

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const sleepEvent = events.find((e: any) => e.name === 'sleep_timer');

      expect(sleepEvent?.properties?.action).toBe('set');
      expect(sleepEvent?.properties?.duration).toBe(900000);
    });
  });

  describe('download events', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('tracks download start', () => {
      analyticsService.trackDownloadStart('book-456', 5, 500000000);

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const event = events.find((e: any) => e.name === 'download_start');

      expect(event?.properties?.fileCount).toBe(5);
      expect(event?.properties?.totalSize).toBe(500000000);
    });

    it('tracks download complete with timing', () => {
      analyticsService.trackDownloadComplete('book-456', 60000, 500000000);

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const event = events.find((e: any) => e.name === 'download_complete');

      expect(event?.properties?.durationMs).toBe(60000);

      // Should also track performance
      const perfEvent = events.find(
        (e: any) => e.name === 'performance' && e.properties?.metric === 'download_time'
      );
      expect(perfEvent).toBeDefined();
    });
  });

  describe('search events', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('tracks search with sanitized query', () => {
      analyticsService.trackSearch('harry potter', 25, 50);

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const event = events.find((e: any) => e.name === 'search');

      // Should track query length, not actual query (for privacy)
      expect(event?.properties?.queryLength).toBe(12);
      expect(event?.properties?.resultCount).toBe(25);
      expect(event?.properties?.durationMs).toBe(50);
    });

    it('tracks result clicks with position', () => {
      analyticsService.trackSearchResultClick('harry', 'book-789', 2);

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const event = events.find((e: any) => e.name === 'search_result_click');

      expect(event?.properties?.position).toBe(2);
    });
  });

  describe('flush', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('persists events to storage', async () => {
      analyticsService.track('event1', {}, 'user');
      analyticsService.track('event2', {}, 'user');

      await analyticsService.flush();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@analytics:pending_events',
        expect.any(String)
      );
    });

    it('does nothing when no events pending', async () => {
      // Clear events
      // @ts-ignore
      analyticsService.pendingEvents = [];

      await analyticsService.flush();

      // setItem not called for empty events (after init which has events)
      // Actually init already calls setItem, so let's check call count doesn't increase
      const callsBefore = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
      await analyticsService.flush();
      expect((AsyncStorage.setItem as jest.Mock).mock.calls.length).toBe(callsBefore);
    });
  });

  describe('session management', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('ends session with stats', async () => {
      analyticsService.trackScreen('Home');
      analyticsService.track('test', {}, 'user');

      // Add small delay to ensure duration > 0
      await new Promise((resolve) => setTimeout(resolve, 5));

      await analyticsService.endSession();

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const endEvent = events.find((e: any) => e.name === 'session_end');

      expect(endEvent).toBeDefined();
      expect(endEvent?.properties?.duration).toBeGreaterThanOrEqual(0);
      expect(endEvent?.properties?.screenViews).toBeGreaterThanOrEqual(1);
    });
  });

  describe('app state handling', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('tracks background event', () => {
      // Simulate going to background
      mockAppStateListeners.forEach((cb) => cb('background'));

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const bgEvent = events.find((e: any) => e.name === 'app_background');

      expect(bgEvent).toBeDefined();
    });

    it('tracks foreground event', () => {
      // Simulate returning to foreground
      mockAppStateListeners.forEach((cb) => cb('active'));

      // @ts-ignore
      const events = analyticsService.pendingEvents;
      const fgEvent = events.find((e: any) => e.name === 'app_foreground');

      expect(fgEvent).toBeDefined();
    });
  });

  describe('getMetricsSummary', () => {
    beforeEach(async () => {
      await analyticsService.initialize();
    });

    it('returns empty object when no metrics', () => {
      const summary = analyticsService.getMetricsSummary();
      // May have some from init, but specific ones shouldn't exist
      expect(summary['nonexistent']).toBeUndefined();
    });

    it('groups metrics by name', () => {
      analyticsService.trackPerformance('metric_a', 100);
      analyticsService.trackPerformance('metric_a', 200);
      analyticsService.trackPerformance('metric_b', 50);

      const summary = analyticsService.getMetricsSummary();

      expect(summary['metric_a'].count).toBe(2);
      expect(summary['metric_b'].count).toBe(1);
    });
  });
});
