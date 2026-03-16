/**
 * src/utils/runtimeMonitor.ts
 *
 * Comprehensive runtime monitoring for Secret Library app.
 * Captures errors, performance issues, memory leaks, and more.
 *
 * Usage:
 * - Call startAllMonitoring() in App.tsx for development
 * - Use hooks in problem components
 * - Generate reports with generateErrorReport()
 */

// React Native global error handling utilities
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ErrorUtils {
  getGlobalHandler?: () => ((error: Error, isFatal: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: Error, isFatal: boolean) => void) => void;
}

// V8/Browser performance memory API
interface PerformanceMemory {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

// Extend global with React Native and browser APIs
declare const global: typeof globalThis & {
  ErrorUtils?: ErrorUtils;
  performance?: ExtendedPerformance;
};

// ============================================================
// TYPES
// ============================================================

interface RuntimeError {
  id: string;
  timestamp: number;
  type: ErrorType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details: any;
  stack?: string;
  screen?: string;
  userAction?: string;
  sessionDuration?: number;
}

type ErrorType =
  | 'crash'
  | 'js_error'
  | 'promise_rejection'
  | 'network_error'
  | 'api_error'
  | 'render_error'
  | 'navigation_error'
  | 'audio_error'
  | 'storage_error'
  | 'image_error'
  | 'memory_warning'
  | 'anr'
  | 'slow_render'
  | 'excessive_rerender'
  | 'state_error'
  | 'timeout'
  | 'offline_error';

// ============================================================
// GLOBAL ERROR STORE
// ============================================================

class ErrorStore {
  private errors: RuntimeError[] = [];
  private sessionStart: number = Date.now();
  private currentScreen: string = 'Unknown';
  private lastUserAction: string = 'App Start';
  private errorListeners: ((error: RuntimeError) => void)[] = [];

  setScreen(screen: string) {
    this.currentScreen = screen;
    this.log('navigation', `Navigated to ${screen}`);
  }

  setUserAction(action: string) {
    this.lastUserAction = action;
  }

  addError(
    error: Omit<
      RuntimeError,
      'id' | 'timestamp' | 'screen' | 'userAction' | 'sessionDuration'
    >
  ) {
    const fullError: RuntimeError = {
      ...error,
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      screen: this.currentScreen,
      userAction: this.lastUserAction,
      sessionDuration: Date.now() - this.sessionStart,
    };

    this.errors.push(fullError);
    this.notifyListeners(fullError);
    this.logError(fullError);

    // Keep last 500 errors max
    if (this.errors.length > 500) {
      this.errors = this.errors.slice(-500);
    }

    // Persist critical errors
    if (error.severity === 'critical' || error.severity === 'high') {
      this.persistError(fullError);
    }
  }

  private logError(error: RuntimeError) {
    const emoji = {
      critical: '💥',
      high: '🔴',
      medium: '🟠',
      low: '🟡',
    }[error.severity];

    console.log(`\n${emoji} [${error.type.toUpperCase()}] ${error.message}`);
    console.log(`   Screen: ${error.screen}`);
    console.log(`   Action: ${error.userAction}`);
    console.log(`   Session: ${Math.round(error.sessionDuration! / 1000)}s`);
    if (error.details) console.log('   Details:', error.details);
    if (error.stack)
      console.log('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
  }

  private log(type: string, message: string) {
    if (__DEV__) {
      console.log(`[MONITOR:${type}] ${message}`);
    }
  }

  private async persistError(error: RuntimeError) {
    try {
      const key = `@error_log_${error.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(error));
    } catch (e) {
      console.warn('Failed to persist error:', e);
    }
  }

  subscribe(listener: (error: RuntimeError) => void) {
    this.errorListeners.push(listener);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(error: RuntimeError) {
    this.errorListeners.forEach((l) => l(error));
  }

  getErrors() {
    return [...this.errors];
  }

  getErrorsByType(type: ErrorType) {
    return this.errors.filter((e) => e.type === type);
  }

  getErrorsBySeverity(severity: RuntimeError['severity']) {
    return this.errors.filter((e) => e.severity === severity);
  }

  getSummary() {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byScreen: Record<string, number> = {};

    this.errors.forEach((e) => {
      byType[e.type] = (byType[e.type] || 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
      byScreen[e.screen!] = (byScreen[e.screen!] || 0) + 1;
    });

    return {
      total: this.errors.length,
      byType,
      bySeverity,
      byScreen,
      sessionDuration: Date.now() - this.sessionStart,
    };
  }

  async exportErrors(): Promise<string> {
    return JSON.stringify(
      {
        exported: new Date().toISOString(),
        sessionDuration: Date.now() - this.sessionStart,
        summary: this.getSummary(),
        errors: this.errors,
      },
      null,
      2
    );
  }

  clear() {
    this.errors = [];
  }
}

export const errorStore = new ErrorStore();

// ============================================================
// 1. GLOBAL ERROR HANDLERS
// ============================================================

export const setupGlobalErrorHandlers = () => {
  // Catch unhandled JS errors
  const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
  global.ErrorUtils?.setGlobalHandler?.(
    (error: Error, isFatal: boolean) => {
      errorStore.addError({
        type: 'js_error',
        severity: isFatal ? 'critical' : 'high',
        message: error.message || 'Unknown JS Error',
        details: { isFatal },
        stack: error.stack,
      });

      originalHandler?.(error, isFatal);
    }
  );

  console.log('[MONITOR] Global error handlers installed');
};

// ============================================================
// 2. NETWORK MONITORING
// ============================================================

class NetworkMonitor {
  private isConnected: boolean = true;
  private connectionType: string = 'unknown';
  private requestLog: Map<string, { start: number; url: string }> = new Map();
  private unsubscribe: (() => void) | null = null;

  start() {
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected ?? false;
      this.connectionType = state.type;

      if (wasConnected && !this.isConnected) {
        errorStore.addError({
          type: 'network_error',
          severity: 'medium',
          message: 'Network connection lost',
          details: { connectionType: this.connectionType },
        });
      }

      console.log(
        `[MONITOR:network] ${this.isConnected ? '🟢 Online' : '🔴 Offline'} (${this.connectionType})`
      );
    });

    this.patchFetch();
  }

  stop() {
    this.unsubscribe?.();
  }

  private patchFetch() {
    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const startTime = Date.now();

      this.requestLog.set(requestId, { start: startTime, url });

      try {
        const response = await originalFetch(input, init);
        const duration = Date.now() - startTime;

        // Log slow requests
        if (duration > 3000) {
          errorStore.addError({
            type: 'network_error',
            severity: 'low',
            message: `Slow API request: ${duration}ms`,
            details: { url: url.slice(0, 100), duration, status: response.status },
          });
        }

        // Log failed requests
        if (!response.ok) {
          errorStore.addError({
            type: 'api_error',
            severity: response.status >= 500 ? 'high' : 'medium',
            message: `API error: ${response.status}`,
            details: {
              url: url.slice(0, 100),
              status: response.status,
              statusText: response.statusText,
            },
          });
        }

        if (__DEV__) {
          console.log(
            `[MONITOR:fetch] ${response.ok ? '✓' : '✗'} ${response.status} ${url.slice(0, 50)}... (${duration}ms)`
          );
        }

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        errorStore.addError({
          type: 'network_error',
          severity: 'high',
          message: `Fetch failed: ${errorMessage}`,
          details: { url: url.slice(0, 100), duration, error: errorMessage },
        });

        throw error;
      } finally {
        this.requestLog.delete(requestId);
      }
    };
  }
}

export const networkMonitor = new NetworkMonitor();

// ============================================================
// 3. RENDER PERFORMANCE MONITORING
// ============================================================

class RenderMonitor {
  private renderTimes: Map<string, number[]> = new Map();
  private renderCounts: Map<string, number> = new Map();
  private mountTimes: Map<string, number> = new Map();
  private thresholds = {
    slowRender: 16, // ms (60fps frame budget)
    verySlowRender: 100,
    excessiveRerenders: 10, // per second
  };

  recordRender(componentName: string) {
    const now = Date.now();
    const count = (this.renderCounts.get(componentName) || 0) + 1;
    this.renderCounts.set(componentName, count);

    // Track render times
    const times = this.renderTimes.get(componentName) || [];
    times.push(now);

    // Keep last 20 renders
    if (times.length > 20) times.shift();
    this.renderTimes.set(componentName, times);

    // Check for excessive re-renders (>10 in 1 second)
    const recentRenders = times.filter((t) => now - t < 1000).length;
    if (recentRenders > this.thresholds.excessiveRerenders) {
      errorStore.addError({
        type: 'excessive_rerender',
        severity: 'medium',
        message: `${componentName} rendered ${recentRenders} times in 1 second`,
        details: { componentName, renderCount: count, recentRenders },
      });
    }

    return count;
  }

  recordMount(componentName: string, duration: number) {
    this.mountTimes.set(componentName, duration);

    if (duration > this.thresholds.verySlowRender) {
      errorStore.addError({
        type: 'slow_render',
        severity: duration > 500 ? 'high' : 'medium',
        message: `${componentName} slow mount: ${duration.toFixed(0)}ms`,
        details: { componentName, duration },
      });
    }

    console.log(
      `[MONITOR:render] ${componentName} mounted in ${duration.toFixed(0)}ms ${duration > 100 ? '⚠️' : ''}`
    );
  }

  getStats() {
    const stats: Record<string, { renders: number; avgInterval: number }> = {};

    this.renderCounts.forEach((count, name) => {
      const times = this.renderTimes.get(name) || [];
      let avgInterval = 0;
      if (times.length > 1) {
        const intervals = times.slice(1).map((t, i) => t - times[i]);
        avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }
      stats[name] = { renders: count, avgInterval };
    });

    return stats;
  }
}

export const renderMonitor = new RenderMonitor();

// ============================================================
// 4. AUDIO PLAYER MONITORING
// ============================================================

class AudioMonitor {
  private playerState: string = 'idle';
  private errorCount: number = 0;
  private stateHistory: { state: string; time: number }[] = [];

  recordStateChange(newState: string, details?: any) {
    const now = Date.now();
    this.stateHistory.push({ state: newState, time: now });

    // Keep last 50 state changes
    if (this.stateHistory.length > 50) this.stateHistory.shift();

    // Detect rapid state changes (potential issue)
    const recentChanges = this.stateHistory.filter(
      (s) => now - s.time < 1000
    ).length;
    if (recentChanges > 5) {
      errorStore.addError({
        type: 'audio_error',
        severity: 'medium',
        message: `Rapid audio state changes: ${recentChanges} in 1 second`,
        details: { states: this.stateHistory.slice(-5), ...details },
      });
    }

    this.playerState = newState;
    console.log(`[MONITOR:audio] State: ${newState}`);
  }

  recordError(error: Error | string, context?: string) {
    this.errorCount++;

    errorStore.addError({
      type: 'audio_error',
      severity: 'high',
      message: typeof error === 'string' ? error : error.message,
      details: { context, errorCount: this.errorCount },
      stack: typeof error === 'object' ? error.stack : undefined,
    });
  }

  recordBuffering(isBuffering: boolean, duration?: number) {
    if (isBuffering) {
      console.log('[MONITOR:audio] ⏳ Buffering...');
    } else if (duration && duration > 3000) {
      errorStore.addError({
        type: 'audio_error',
        severity: 'low',
        message: `Long buffering: ${duration}ms`,
        details: { bufferDuration: duration },
      });
    }
  }

  getStats() {
    return {
      currentState: this.playerState,
      errorCount: this.errorCount,
      stateHistory: this.stateHistory.slice(-10),
    };
  }
}

export const audioMonitor = new AudioMonitor();

// ============================================================
// 5. IMAGE LOADING MONITORING
// ============================================================

class ImageMonitor {
  private loadTimes: Map<string, number> = new Map();
  private failures: Map<string, number> = new Map();
  private reloads: Map<string, number> = new Map();

  recordLoadStart(uri: string) {
    this.loadTimes.set(uri, Date.now());
  }

  recordLoadEnd(uri: string) {
    const startTime = this.loadTimes.get(uri);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.loadTimes.delete(uri);

      if (duration > 3000) {
        errorStore.addError({
          type: 'image_error',
          severity: 'low',
          message: `Slow image load: ${duration}ms`,
          details: { uri: uri.slice(0, 100), duration },
        });
      }
    }
  }

  recordError(uri: string, error?: Error) {
    const failCount = (this.failures.get(uri) || 0) + 1;
    this.failures.set(uri, failCount);

    errorStore.addError({
      type: 'image_error',
      severity: failCount > 3 ? 'high' : 'medium',
      message: `Image failed to load (attempt ${failCount})`,
      details: { uri: uri.slice(0, 100), failCount, error: error?.message },
    });
  }

  recordReload(uri: string, componentName: string) {
    const reloadCount = (this.reloads.get(uri) || 0) + 1;
    this.reloads.set(uri, reloadCount);

    if (reloadCount > 2) {
      errorStore.addError({
        type: 'image_error',
        severity: 'medium',
        message: `Image reloading repeatedly (${reloadCount}x) - likely causing flicker`,
        details: { uri: uri.slice(0, 100), componentName, reloadCount },
      });
    }
  }

  getStats() {
    return {
      pendingLoads: this.loadTimes.size,
      failures: Object.fromEntries(this.failures),
      reloads: Object.fromEntries(this.reloads),
    };
  }
}

export const imageMonitor = new ImageMonitor();

// ============================================================
// 6. STORAGE MONITORING
// ============================================================

class StorageMonitor {
  private operations: {
    type: string;
    key: string;
    duration: number;
    success: boolean;
  }[] = [];

  async wrapGet<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      this.recordOperation('get', key, Date.now() - start, true);
      return result;
    } catch (error) {
      this.recordOperation('get', key, Date.now() - start, false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      errorStore.addError({
        type: 'storage_error',
        severity: 'medium',
        message: `Storage get failed: ${key}`,
        details: { key, error: errorMessage },
      });
      throw error;
    }
  }

  async wrapSet(key: string, operation: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await operation();
      this.recordOperation('set', key, Date.now() - start, true);
    } catch (error) {
      this.recordOperation('set', key, Date.now() - start, false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      errorStore.addError({
        type: 'storage_error',
        severity: 'high',
        message: `Storage set failed: ${key}`,
        details: { key, error: errorMessage },
      });
      throw error;
    }
  }

  private recordOperation(
    type: string,
    key: string,
    duration: number,
    success: boolean
  ) {
    this.operations.push({ type, key, duration, success });

    // Keep last 100
    if (this.operations.length > 100) this.operations.shift();

    if (duration > 500) {
      console.warn(`[MONITOR:storage] Slow ${type}: ${duration}ms for ${key}`);
    }
  }

  getStats() {
    const successful = this.operations.filter((o) => o.success).length;
    const avgDuration =
      this.operations.reduce((a, o) => a + o.duration, 0) /
        this.operations.length || 0;

    return {
      totalOperations: this.operations.length,
      successRate: successful / this.operations.length || 0,
      avgDuration,
      recentFailures: this.operations.filter((o) => !o.success).slice(-5),
    };
  }
}

export const storageMonitor = new StorageMonitor();

// ============================================================
// 7. MEMORY MONITORING (with native module support)
// ============================================================

// Import native memory module (may not be available on all platforms)
let nativeMemoryModule: {
  getMemoryInfo: () => Promise<{
    usedMb: number;
    totalMb: number;
    usedPercent: number;
    platform: string;
    lowMemory?: boolean;
  }>;
  getMemoryUsageMb: () => number;
} | null = null;

// Try to load native module (safe to fail)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nativeMemoryModule = require('memory-module');
} catch {
  // Native module not available, will use JS fallback
  if (__DEV__) {
    console.log('[MONITOR:memory] Native memory module not available, using JS fallback');
  }
}

interface MemorySample {
  time: number;
  usedMb: number;
  totalMb?: number;
  usedPercent?: number;
  platform?: string;
  lowMemory?: boolean;
}

class MemoryMonitor {
  private samples: MemorySample[] = [];
  private initialUsedMb: number | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private useNative: boolean = !!nativeMemoryModule;

  start(intervalMs: number = 10000) {
    this.interval = setInterval(() => this.sample(), intervalMs);
    this.sample();
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  private async sample() {
    const now = Date.now();

    if (this.useNative && nativeMemoryModule) {
      // Use native module for accurate memory info
      try {
        const info = await nativeMemoryModule.getMemoryInfo();

        if (this.initialUsedMb === null) {
          this.initialUsedMb = info.usedMb;
          console.log(
            `[MONITOR:memory] Native monitoring active (${info.platform}), initial: ${info.usedMb.toFixed(1)}MB`
          );
        }

        const sample: MemorySample = {
          time: now,
          usedMb: info.usedMb,
          totalMb: info.totalMb,
          usedPercent: info.usedPercent,
          platform: info.platform,
          lowMemory: info.lowMemory,
        };

        this.samples.push(sample);
        if (this.samples.length > 100) this.samples.shift();

        // Detect memory growth
        const growthMb = info.usedMb - (this.initialUsedMb || 0);

        if (growthMb > 100) {
          errorStore.addError({
            type: 'memory_warning',
            severity: growthMb > 200 ? 'critical' : 'high',
            message: `Memory growth: +${growthMb.toFixed(0)}MB since start`,
            details: {
              initialMB: this.initialUsedMb?.toFixed(1),
              currentMB: info.usedMb.toFixed(1),
              totalMB: info.totalMb.toFixed(1),
              usedPercent: info.usedPercent.toFixed(1),
              growthMb: growthMb.toFixed(1),
            },
          });
        }

        // Android low memory warning
        if (info.lowMemory) {
          errorStore.addError({
            type: 'memory_warning',
            severity: 'high',
            message: 'Device is in low memory state',
            details: {
              usedMb: info.usedMb.toFixed(1),
              usedPercent: info.usedPercent.toFixed(1),
            },
          });
        }

        if (__DEV__) {
          console.log(
            `[MONITOR:memory] ${info.usedMb.toFixed(1)}MB / ${info.totalMb.toFixed(0)}MB (${info.usedPercent.toFixed(1)}%) ${growthMb > 0 ? `+${growthMb.toFixed(1)}MB` : ''}`
          );
        }

        return;
      } catch (error) {
        // Fall through to JS fallback
        if (__DEV__) {
          console.warn('[MONITOR:memory] Native call failed, using JS fallback:', error);
        }
        this.useNative = false;
      }
    }

    // JS fallback (limited accuracy)
    const estimatedHeap = global.performance?.memory?.usedJSHeapSize;

    if (!estimatedHeap) {
      if (this.samples.length === 0) {
        console.log('[MONITOR:memory] Memory monitoring active (limited - no native module)');
      }
      return;
    }

    const usedMb = estimatedHeap / 1024 / 1024;

    if (this.initialUsedMb === null) {
      this.initialUsedMb = usedMb;
    }

    this.samples.push({ time: now, usedMb });
    if (this.samples.length > 100) this.samples.shift();

    const growthMb = usedMb - this.initialUsedMb;

    if (growthMb > 100) {
      errorStore.addError({
        type: 'memory_warning',
        severity: growthMb > 200 ? 'critical' : 'high',
        message: `Memory growth: +${growthMb.toFixed(0)}MB since start`,
        details: {
          initialMB: this.initialUsedMb.toFixed(1),
          currentMB: usedMb.toFixed(1),
          growthMb: growthMb.toFixed(1),
        },
      });
    }

    if (__DEV__) {
      console.log(
        `[MONITOR:memory] ${usedMb.toFixed(1)}MB (${growthMb > 0 ? '+' : ''}${growthMb.toFixed(1)}MB) [JS estimate]`
      );
    }
  }

  getStats() {
    if (this.samples.length === 0) {
      return {
        currentMB: 'N/A',
        initialMB: 'N/A',
        growthMB: 'N/A',
        trend: 'unknown',
        usingNative: this.useNative,
      };
    }

    const latest = this.samples[this.samples.length - 1];

    return {
      currentMB: latest.usedMb.toFixed(1),
      totalMB: latest.totalMb?.toFixed(0) || 'N/A',
      usedPercent: latest.usedPercent?.toFixed(1) || 'N/A',
      initialMB: this.initialUsedMb?.toFixed(1) || 'N/A',
      growthMB: this.initialUsedMb
        ? (latest.usedMb - this.initialUsedMb).toFixed(1)
        : 'N/A',
      trend: this.samples.length > 10 ? this.calculateTrend() : 'unknown',
      platform: latest.platform || 'js',
      lowMemory: latest.lowMemory || false,
      usingNative: this.useNative,
    };
  }

  // For stress tests - get current heap value
  getState() {
    if (this.useNative && nativeMemoryModule) {
      try {
        const usedMb = nativeMemoryModule.getMemoryUsageMb();
        return { heapUsed: usedMb * 1024 * 1024, usedMb };
      } catch {
        // Fall through
      }
    }
    const estimatedHeap = global.performance?.memory?.usedJSHeapSize || 0;
    return { heapUsed: estimatedHeap, usedMb: estimatedHeap / 1024 / 1024 };
  }

  private calculateTrend(): 'growing' | 'stable' | 'shrinking' {
    if (this.samples.length < 10) return 'stable';

    const recent = this.samples.slice(-10);
    const older = this.samples.slice(-20, -10);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, s) => a + s.usedMb, 0) / recent.length;
    const olderAvg = older.reduce((a, s) => a + s.usedMb, 0) / older.length;

    const diff = recentAvg - olderAvg;
    const percentChange = (diff / olderAvg) * 100;

    if (percentChange > 5) return 'growing';
    if (percentChange < -5) return 'shrinking';
    return 'stable';
  }

  // Check if native module is being used
  isUsingNative(): boolean {
    return this.useNative;
  }

  // Get recent samples for analysis
  getRecentSamples(count: number = 10): MemorySample[] {
    return this.samples.slice(-count);
  }
}

export const memoryMonitor = new MemoryMonitor();

// ============================================================
// 8. ANR (App Not Responding) DETECTION
// ============================================================

class ANRMonitor {
  private lastHeartbeat: number = Date.now();
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private threshold: number = 5000; // 5 seconds without heartbeat = ANR

  start() {
    // Heartbeat on JS thread
    this.heartbeat = setInterval(() => {
      this.lastHeartbeat = Date.now();
    }, 500);

    // Watchdog checks for heartbeat
    this.watchdog = setInterval(() => {
      const timeSinceHeartbeat = Date.now() - this.lastHeartbeat;

      if (timeSinceHeartbeat > this.threshold) {
        errorStore.addError({
          type: 'anr',
          severity: 'critical',
          message: `App Not Responding: JS thread blocked for ${timeSinceHeartbeat}ms`,
          details: { blockedFor: timeSinceHeartbeat },
        });
      } else if (timeSinceHeartbeat > 2000) {
        console.warn(
          `[MONITOR:anr] ⚠️ JS thread slow: ${timeSinceHeartbeat}ms since last heartbeat`
        );
      }
    }, 1000);
  }

  stop() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.watchdog) clearInterval(this.watchdog);
  }
}

export const anrMonitor = new ANRMonitor();

// ============================================================
// 8.5 FPS MONITORING
// ============================================================

interface FpsSample {
  context: string;
  fps: number;
  droppedFrames: number;
  timestamp: number;
}

class FpsMonitor {
  private isMonitoring = false;
  private frameTimestamps: number[] = [];
  private samples: FpsSample[] = [];
  private currentContext: string = 'idle';
  private rafId: number | null = null;
  private lastReportTime = 0;
  private droppedFrames = 0;

  private readonly TARGET_FRAME_TIME = 16.67; // 60fps
  private readonly SAMPLE_INTERVAL = 1000; // Report every second
  private readonly MAX_SAMPLES = 500;
  private readonly FPS_BUDGET = 55; // From performanceBudgets

  start(context: string) {
    if (this.isMonitoring && this.currentContext === context) return;

    this.stop(); // Stop any existing monitoring
    this.currentContext = context;
    this.isMonitoring = true;
    this.frameTimestamps = [];
    this.droppedFrames = 0;
    this.lastReportTime = performance.now();

    this.measureFrame();

    if (__DEV__) {
      console.log(`[FPS] Started monitoring: ${context}`);
    }
  }

  stop() {
    if (!this.isMonitoring) return;

    // Final report for this context
    this.reportCurrentFps();

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.isMonitoring = false;

    if (__DEV__) {
      console.log(`[FPS] Stopped monitoring: ${this.currentContext}`);
    }
  }

  private measureFrame = () => {
    if (!this.isMonitoring) return;

    const now = performance.now();

    if (this.frameTimestamps.length > 0) {
      const lastFrame = this.frameTimestamps[this.frameTimestamps.length - 1];
      const delta = now - lastFrame;

      // Count dropped frames (frame took > 2x target time)
      if (delta > this.TARGET_FRAME_TIME * 2) {
        this.droppedFrames += Math.floor(delta / this.TARGET_FRAME_TIME) - 1;
      }
    }

    this.frameTimestamps.push(now);

    // Keep only last 120 frames (2 seconds at 60fps)
    if (this.frameTimestamps.length > 120) {
      this.frameTimestamps.shift();
    }

    // Report every second
    if (now - this.lastReportTime >= this.SAMPLE_INTERVAL) {
      this.reportCurrentFps();
      this.lastReportTime = now;
    }

    this.rafId = requestAnimationFrame(this.measureFrame);
  };

  private reportCurrentFps() {
    if (this.frameTimestamps.length < 10) return;

    const fps = this.calculateFps();

    const sample: FpsSample = {
      context: this.currentContext,
      fps: Math.round(fps),
      droppedFrames: this.droppedFrames,
      timestamp: Date.now(),
    };

    this.samples.push(sample);
    if (this.samples.length > this.MAX_SAMPLES) {
      this.samples.shift();
    }

    // Log warning if below budget
    if (fps < this.FPS_BUDGET) {
      if (__DEV__) {
        console.warn(
          `[FPS] ⚠️ Low: ${fps.toFixed(1)} in ${this.currentContext} (${this.droppedFrames} dropped)`
        );
      }

      // Record as error if significantly below budget
      if (fps < 45) {
        errorStore.addError({
          type: 'slow_render',
          severity: fps < 30 ? 'high' : 'medium',
          message: `Low FPS: ${fps.toFixed(1)} during ${this.currentContext}`,
          details: {
            fps: Math.round(fps),
            droppedFrames: this.droppedFrames,
            context: this.currentContext,
          },
        });
      }
    }

    // Reset dropped frame counter for next interval
    this.droppedFrames = 0;
  }

  private calculateFps(): number {
    if (this.frameTimestamps.length < 2) return 60;

    const first = this.frameTimestamps[0];
    const last = this.frameTimestamps[this.frameTimestamps.length - 1];
    const elapsed = last - first;

    if (elapsed === 0) return 60;

    return ((this.frameTimestamps.length - 1) / elapsed) * 1000;
  }

  getCurrentFps(): number {
    return Math.round(this.calculateFps());
  }

  isActive(): boolean {
    return this.isMonitoring;
  }

  getContext(): string {
    return this.currentContext;
  }

  getStats(context?: string) {
    const filtered = context
      ? this.samples.filter((s) => s.context === context)
      : this.samples;

    if (filtered.length === 0) return null;

    const fpsValues = filtered.map((s) => s.fps);
    const totalDropped = filtered.reduce((sum, s) => sum + s.droppedFrames, 0);

    return {
      context: context || 'all',
      sampleCount: filtered.length,
      avgFps: Math.round(fpsValues.reduce((a, b) => a + b) / fpsValues.length),
      minFps: Math.min(...fpsValues),
      maxFps: Math.max(...fpsValues),
      totalDroppedFrames: totalDropped,
      belowBudgetCount: fpsValues.filter((f) => f < this.FPS_BUDGET).length,
    };
  }

  getAllStats() {
    const contexts = [...new Set(this.samples.map((s) => s.context))];
    return Object.fromEntries(
      contexts.map((ctx) => [ctx, this.getStats(ctx)])
    );
  }

  getRecentSamples(count: number = 10): FpsSample[] {
    return this.samples.slice(-count);
  }

  reset() {
    this.samples = [];
    this.frameTimestamps = [];
    this.droppedFrames = 0;
  }
}

export const fpsMonitor = new FpsMonitor();

// ============================================================
// 9. NAVIGATION MONITORING
// ============================================================

export const navigationMonitor = {
  lastScreen: 'Unknown',
  screenHistory: [] as { screen: string; time: number }[],

  recordNavigation(screenName: string) {
    this.lastScreen = screenName;
    this.screenHistory.push({ screen: screenName, time: Date.now() });

    // Keep last 50
    if (this.screenHistory.length > 50) this.screenHistory.shift();

    errorStore.setScreen(screenName);
    console.log(`[MONITOR:nav] → ${screenName}`);
  },

  getHistory() {
    return this.screenHistory;
  },
};

// ============================================================
// 10. USER INTERACTION MONITORING
// ============================================================

class InteractionMonitor {
  private interactions: { type: string; target: string; time: number }[] = [];

  recordTap(target: string) {
    this.record('tap', target);
    errorStore.setUserAction(`Tapped: ${target}`);
  }

  recordScroll(target: string) {
    this.record('scroll', target);
  }

  recordInput(target: string) {
    this.record('input', target);
    errorStore.setUserAction(`Input: ${target}`);
  }

  private record(type: string, target: string) {
    this.interactions.push({ type, target, time: Date.now() });

    // Keep last 100
    if (this.interactions.length > 100) this.interactions.shift();
  }

  getRecentInteractions(count: number = 10) {
    return this.interactions.slice(-count);
  }
}

export const interactionMonitor = new InteractionMonitor();

// ============================================================
// 11. LISTENER LEAK DETECTION
// ============================================================

class ListenerMonitor {
  private listeners: Map<string, number> = new Map();

  recordAdd(name: string) {
    const count = (this.listeners.get(name) || 0) + 1;
    this.listeners.set(name, count);

    if (count > 5) {
      console.warn(
        `[MONITOR:listeners] ⚠️ ${name}: ${count} active listeners (potential leak)`
      );
    }
  }

  recordRemove(name: string) {
    const count = Math.max(0, (this.listeners.get(name) || 0) - 1);
    this.listeners.set(name, count);
  }

  getStats() {
    return Object.fromEntries(this.listeners);
  }

  // For stress tests - get listeners state
  getState() {
    return {
      listeners: Object.fromEntries(this.listeners),
    };
  }
}

export const listenerMonitor = new ListenerMonitor();

// ============================================================
// HOOKS FOR COMPONENTS
// ============================================================

/**
 * Full monitoring for a component
 */
export const useComponentMonitor = (componentName: string) => {
  const mountTime = useRef(Date.now());
  const renderCount = useRef(0);

  // Track renders
  renderCount.current++;
  renderMonitor.recordRender(componentName);

  // Track mount/unmount
  useEffect(() => {
    const duration = Date.now() - mountTime.current;
    renderMonitor.recordMount(componentName, duration);

    return () => {
      console.log(
        `[MONITOR:lifecycle] ${componentName} unmounted after ${Date.now() - mountTime.current}ms, ${renderCount.current} renders`
      );
    };
  }, [componentName]);
};

/**
 * Monitor an image
 */
export const useImageMonitor = (uri: string, componentName: string) => {
  const loadStarted = useRef(false);

  useEffect(() => {
    if (uri && loadStarted.current) {
      imageMonitor.recordReload(uri, componentName);
    }
    loadStarted.current = true;
  }, [uri, componentName]);

  return {
    onLoadStart: () => imageMonitor.recordLoadStart(uri),
    onLoadEnd: () => imageMonitor.recordLoadEnd(uri),
    onError: (e: any) => imageMonitor.recordError(uri, e?.nativeEvent?.error),
  };
};

/**
 * Monitor FPS for a specific context (e.g., 'scrubbing', 'discAnimation', 'scroll')
 * Automatically starts when mounted and stops when unmounted.
 *
 * @example
 * ```tsx
 * // Monitor FPS while player screen is visible
 * function CDPlayerScreen() {
 *   useFpsMonitor('fullPlayer');
 *   return <View>...</View>;
 * }
 *
 * // Monitor FPS during a specific interaction
 * function ProgressBar({ isSeeking }) {
 *   useFpsMonitor(isSeeking ? 'scrubbing' : null);
 *   return <View>...</View>;
 * }
 * ```
 */
export const useFpsMonitor = (context: string | null) => {
  useEffect(() => {
    if (context) {
      fpsMonitor.start(context);
      return () => fpsMonitor.stop();
    }
  }, [context]);

  return {
    getCurrentFps: () => fpsMonitor.getCurrentFps(),
    getStats: () => fpsMonitor.getStats(context || undefined),
  };
};

/**
 * Monitor audio player
 */
export const useAudioMonitor = () => {
  return {
    onStateChange: (state: string, details?: any) =>
      audioMonitor.recordStateChange(state, details),
    onError: (error: Error | string, context?: string) =>
      audioMonitor.recordError(error, context),
    onBuffering: (isBuffering: boolean, duration?: number) =>
      audioMonitor.recordBuffering(isBuffering, duration),
  };
};

/**
 * Track user taps
 */
export const useInteractionMonitor = (targetName: string) => {
  return {
    onPress: useCallback(
      () => interactionMonitor.recordTap(targetName),
      [targetName]
    ),
    onScroll: useCallback(
      () => interactionMonitor.recordScroll(targetName),
      [targetName]
    ),
  };
};

// ============================================================
// MASTER SETUP
// ============================================================

let isMonitoringStarted = false;
let statsInterval: ReturnType<typeof setInterval> | null = null;

export const startAllMonitoring = () => {
  if (isMonitoringStarted) {
    console.log('[MONITOR] Already started');
    return;
  }

  isMonitoringStarted = true;

  console.log('\n========================================');
  console.log('🔍 RUNTIME MONITORING STARTED');
  console.log('========================================\n');

  setupGlobalErrorHandlers();
  networkMonitor.start();
  memoryMonitor.start(15000); // Every 15 seconds
  anrMonitor.start();

  // Log stats periodically
  statsInterval = setInterval(() => {
    console.log('\n========== MONITORING STATS ==========');
    console.log('Errors:', errorStore.getSummary());
    console.log('Memory:', memoryMonitor.getStats());
    console.log('FPS:', fpsMonitor.getAllStats());
    console.log('Images:', imageMonitor.getStats());
    console.log('Audio:', audioMonitor.getStats());
    console.log('Storage:', storageMonitor.getStats());
    console.log('Listeners:', listenerMonitor.getStats());
    console.log('Renders:', renderMonitor.getStats());
    console.log('=======================================\n');
  }, 60000); // Every minute
};

export const stopAllMonitoring = () => {
  networkMonitor.stop();
  memoryMonitor.stop();
  anrMonitor.stop();
  if (statsInterval) clearInterval(statsInterval);
  isMonitoringStarted = false;
};

// ============================================================
// EXPORT ERROR REPORT
// ============================================================

export interface ErrorReport {
  generated: string;
  platform: string;
  total: number;
  critical: RuntimeError[];
  high: RuntimeError[];
  medium: RuntimeError[];
  low: RuntimeError[];
  summary: ReturnType<typeof errorStore.getSummary>;
  memory: ReturnType<typeof memoryMonitor.getStats>;
  fps: ReturnType<typeof fpsMonitor.getAllStats>;
  images: ReturnType<typeof imageMonitor.getStats>;
  audio: ReturnType<typeof audioMonitor.getStats>;
  storage: ReturnType<typeof storageMonitor.getStats>;
  listeners: ReturnType<typeof listenerMonitor.getStats>;
  renders: ReturnType<typeof renderMonitor.getStats>;
  navigation: ReturnType<typeof navigationMonitor.getHistory>;
  recentInteractions: ReturnType<typeof interactionMonitor.getRecentInteractions>;
  errors: RuntimeError[];
}

export const generateErrorReport = (): ErrorReport => {
  const errors = errorStore.getErrors();
  const report: ErrorReport = {
    generated: new Date().toISOString(),
    platform: Platform.OS,
    total: errors.length,
    critical: errors.filter((e) => e.severity === 'critical'),
    high: errors.filter((e) => e.severity === 'high'),
    medium: errors.filter((e) => e.severity === 'medium'),
    low: errors.filter((e) => e.severity === 'low'),
    summary: errorStore.getSummary(),
    memory: memoryMonitor.getStats(),
    fps: fpsMonitor.getAllStats(),
    images: imageMonitor.getStats(),
    audio: audioMonitor.getStats(),
    storage: storageMonitor.getStats(),
    listeners: listenerMonitor.getStats(),
    renders: renderMonitor.getStats(),
    navigation: navigationMonitor.getHistory(),
    recentInteractions: interactionMonitor.getRecentInteractions(20),
    errors,
  };

  return report;
};

// Async version for exporting as JSON string
export const exportErrorReportJSON = async (): Promise<string> => {
  return JSON.stringify(generateErrorReport(), null, 2);
};
