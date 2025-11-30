/**
 * src/core/native/performanceMonitor.ts
 *
 * Native performance monitoring utilities.
 * Tracks frame rate, memory usage, and provides optimization hints.
 */

import { Platform, InteractionManager, NativeModules } from 'react-native';

const DEBUG = __DEV__;
const log = (...args: any[]) => DEBUG && console.log('[PerfMon]', ...args);

// ============================================================================
// FRAME RATE MONITORING
// ============================================================================

interface FrameMetrics {
  fps: number;
  droppedFrames: number;
  totalFrames: number;
  jankFrames: number; // Frames > 16.67ms
}

class FrameRateMonitor {
  private isRunning = false;
  private frameCount = 0;
  private droppedFrames = 0;
  private jankFrames = 0;
  private lastTime = 0;
  private animationFrame: number | null = null;
  private listeners: ((metrics: FrameMetrics) => void)[] = [];
  private reportInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring frame rate
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.jankFrames = 0;

    const measureFrame = () => {
      if (!this.isRunning) return;

      const now = performance.now();
      const delta = now - this.lastTime;
      this.lastTime = now;
      this.frameCount++;

      // Detect dropped frames (> 16.67ms per frame = < 60fps)
      if (delta > 16.67) {
        const dropped = Math.floor(delta / 16.67) - 1;
        this.droppedFrames += dropped;
        if (delta > 33) {
          this.jankFrames++;
        }
      }

      this.animationFrame = requestAnimationFrame(measureFrame);
    };

    this.animationFrame = requestAnimationFrame(measureFrame);

    // Report metrics every second
    this.reportInterval = setInterval(() => {
      this.reportMetrics();
    }, 1000);

    log('Frame rate monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
    log('Frame rate monitoring stopped');
  }

  /**
   * Subscribe to frame metrics
   */
  subscribe(callback: (metrics: FrameMetrics) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private reportMetrics(): void {
    const metrics: FrameMetrics = {
      fps: this.frameCount,
      droppedFrames: this.droppedFrames,
      totalFrames: this.frameCount + this.droppedFrames,
      jankFrames: this.jankFrames,
    };

    this.listeners.forEach((l) => l(metrics));

    // Log warnings for poor performance
    if (metrics.fps < 50) {
      log(`⚠️ Low FPS: ${metrics.fps}, Jank: ${metrics.jankFrames}`);
    }

    // Reset counters
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.jankFrames = 0;
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): FrameMetrics {
    return {
      fps: this.frameCount,
      droppedFrames: this.droppedFrames,
      totalFrames: this.frameCount + this.droppedFrames,
      jankFrames: this.jankFrames,
    };
  }
}

// ============================================================================
// MEMORY MONITORING
// ============================================================================

interface MemoryMetrics {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
  usedPercentage?: number;
}

class MemoryMonitor {
  private listeners: ((metrics: MemoryMetrics) => void)[] = [];
  private interval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring memory (when available)
   */
  start(intervalMs: number = 5000): void {
    if (this.interval) return;

    this.interval = setInterval(() => {
      const metrics = this.getMetrics();
      this.listeners.forEach((l) => l(metrics));

      // Warn on high memory usage
      if (metrics.usedPercentage && metrics.usedPercentage > 80) {
        log(`⚠️ High memory usage: ${metrics.usedPercentage.toFixed(1)}%`);
      }
    }, intervalMs);

    log('Memory monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    log('Memory monitoring stopped');
  }

  /**
   * Subscribe to memory metrics
   */
  subscribe(callback: (metrics: MemoryMetrics) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Get current memory metrics
   */
  getMetrics(): MemoryMetrics {
    // Try to get memory info (limited availability)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usedPercentage:
          (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }

    return {};
  }

  /**
   * Suggest garbage collection (hint only)
   */
  suggestGC(): void {
    // Force a GC hint by creating and clearing a large array
    // Note: This is a hint, not guaranteed
    if (__DEV__) {
      const temp = new Array(1000000);
      temp.length = 0;
      log('GC hint sent');
    }
  }
}

// ============================================================================
// RENDER TRACKING
// ============================================================================

interface RenderMetrics {
  componentName: string;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
}

class RenderTracker {
  private metrics = new Map<string, RenderMetrics>();

  /**
   * Track a component render
   */
  trackRender(componentName: string, renderTimeMs: number): void {
    const existing = this.metrics.get(componentName);

    if (existing) {
      existing.renderCount++;
      existing.lastRenderTime = renderTimeMs;
      existing.averageRenderTime =
        (existing.averageRenderTime * (existing.renderCount - 1) +
          renderTimeMs) /
        existing.renderCount;
    } else {
      this.metrics.set(componentName, {
        componentName,
        renderCount: 1,
        lastRenderTime: renderTimeMs,
        averageRenderTime: renderTimeMs,
      });
    }

    // Warn on slow renders
    if (renderTimeMs > 16) {
      log(`⚠️ Slow render: ${componentName} took ${renderTimeMs.toFixed(2)}ms`);
    }
  }

  /**
   * Get all render metrics
   */
  getAllMetrics(): RenderMetrics[] {
    return Array.from(this.metrics.values()).sort(
      (a, b) => b.renderCount - a.renderCount
    );
  }

  /**
   * Get metrics for a specific component
   */
  getMetrics(componentName: string): RenderMetrics | undefined {
    return this.metrics.get(componentName);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Print a summary to console
   */
  printSummary(): void {
    if (!__DEV__) return;

    const sorted = this.getAllMetrics().slice(0, 10);
    console.log('\n=== Render Metrics (Top 10) ===');
    sorted.forEach((m) => {
      console.log(
        `${m.componentName}: ${m.renderCount} renders, avg ${m.averageRenderTime.toFixed(2)}ms`
      );
    });
    console.log('================================\n');
  }
}

// ============================================================================
// INTERACTION TRACKING
// ============================================================================

class InteractionTracker {
  private pendingInteractions = 0;

  /**
   * Run code after all interactions complete
   */
  runAfterInteractions(callback: () => void): { cancel: () => void } {
    this.pendingInteractions++;
    return InteractionManager.runAfterInteractions(() => {
      this.pendingInteractions--;
      callback();
    });
  }

  /**
   * Check if interactions are pending
   */
  hasPendingInteractions(): boolean {
    return this.pendingInteractions > 0;
  }

  /**
   * Create an interaction handle for long-running operations
   */
  createInteractionHandle(): { done: () => void } {
    const handle = InteractionManager.createInteractionHandle();
    return {
      done: () => {
        InteractionManager.clearInteractionHandle(handle);
      },
    };
  }
}

// ============================================================================
// PERFORMANCE TIPS
// ============================================================================

interface PerformanceTip {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestion: string;
}

function analyzePerformance(
  frameMetrics: FrameMetrics,
  memoryMetrics: MemoryMetrics,
  renderMetrics: RenderMetrics[]
): PerformanceTip[] {
  const tips: PerformanceTip[] = [];

  // Frame rate issues
  if (frameMetrics.fps < 30) {
    tips.push({
      id: 'low-fps-critical',
      severity: 'critical',
      message: `Very low frame rate: ${frameMetrics.fps} FPS`,
      suggestion:
        'Check for expensive operations in render methods. Use React.memo and useCallback.',
    });
  } else if (frameMetrics.fps < 50) {
    tips.push({
      id: 'low-fps-warning',
      severity: 'warning',
      message: `Low frame rate: ${frameMetrics.fps} FPS`,
      suggestion: 'Consider optimizing animations or reducing re-renders.',
    });
  }

  // Jank detection
  if (frameMetrics.jankFrames > 5) {
    tips.push({
      id: 'jank-detected',
      severity: 'warning',
      message: `Jank detected: ${frameMetrics.jankFrames} frames > 33ms`,
      suggestion:
        'Move heavy computations off the main thread using InteractionManager.',
    });
  }

  // Memory issues
  if (memoryMetrics.usedPercentage && memoryMetrics.usedPercentage > 80) {
    tips.push({
      id: 'high-memory',
      severity: 'critical',
      message: `High memory usage: ${memoryMetrics.usedPercentage.toFixed(1)}%`,
      suggestion:
        'Check for memory leaks. Clear caches and unused data. Use FlashList for long lists.',
    });
  }

  // Excessive renders
  const excessiveRenders = renderMetrics.filter((m) => m.renderCount > 50);
  if (excessiveRenders.length > 0) {
    tips.push({
      id: 'excessive-renders',
      severity: 'warning',
      message: `Components with excessive renders: ${excessiveRenders.map((m) => m.componentName).join(', ')}`,
      suggestion:
        'Use React.memo, useMemo, and useCallback to prevent unnecessary re-renders.',
    });
  }

  return tips;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const frameRateMonitor = new FrameRateMonitor();
export const memoryMonitor = new MemoryMonitor();
export const renderTracker = new RenderTracker();
export const interactionTracker = new InteractionTracker();

export { analyzePerformance };
export type { FrameMetrics, MemoryMetrics, RenderMetrics, PerformanceTip };

/**
 * Hook to track component renders (use in development)
 */
export function useRenderTracking(componentName: string): void {
  if (!__DEV__) return;

  const startTime = performance.now();

  // Use layout effect to measure after render
  React.useLayoutEffect(() => {
    const renderTime = performance.now() - startTime;
    renderTracker.trackRender(componentName, renderTime);
  });
}

// Import React for the hook
import React from 'react';
