/**
 * src/utils/perfDebug.ts
 *
 * Performance diagnostics for Secret Library app.
 * Helps identify memory leaks, excessive re-renders, and slow operations.
 *
 * Usage:
 * - Add useAppHealthMonitor() to App.tsx for global monitoring
 * - Add useRenderTracker('ComponentName') to suspected components
 * - Add useLifecycleTracker('ComponentName') to track mount/unmount
 */

import React, { useEffect, useRef } from 'react';
import { AppState, InteractionManager } from 'react-native';

// ============================================
// 1. RENDER TRACKING
// ============================================

/**
 * Logs every render of a component
 * Usage: useRenderTracker('SeriesDetailScreen');
 */
export const useRenderTracker = (componentName: string) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  renderCount.current++;
  const now = Date.now();
  const timeSinceLastRender = now - lastRenderTime.current;
  lastRenderTime.current = now;

  console.log(
    `[RENDER] ${componentName} #${renderCount.current}` +
      (timeSinceLastRender < 100
        ? ` ⚠️ RAPID (${timeSinceLastRender}ms since last)`
        : '')
  );
};

/**
 * Logs mount/unmount with timing
 */
export const useLifecycleTracker = (componentName: string) => {
  const mountTime = useRef(Date.now());

  useEffect(() => {
    console.log(`[MOUNT] ${componentName}`);

    // Log when actually visible
    InteractionManager.runAfterInteractions(() => {
      console.log(
        `[VISIBLE] ${componentName} ready after ${Date.now() - mountTime.current}ms`
      );
    });

    return () => {
      const lifetime = Date.now() - mountTime.current;
      console.log(`[UNMOUNT] ${componentName} after ${lifetime}ms`);
    };
  }, []);
};

// ============================================
// 2. MEMORY TRACKING
// ============================================

/**
 * Logs memory usage every N seconds
 * Usage: useMemoryMonitor(10000); // every 10 seconds
 */
export const useMemoryMonitor = (intervalMs: number = 30000) => {
  const initialMemory = useRef<number | null>(null);

  useEffect(() => {
    const checkMemory = () => {
      // @ts-ignore - performance.memory exists in some environments
      if (global.performance?.memory) {
        // @ts-ignore
        const heap = global.performance.memory.usedJSHeapSize;
        const heapMB = (heap / 1024 / 1024).toFixed(2);

        if (initialMemory.current === null) {
          initialMemory.current = heap;
          console.log(`[MEMORY] Initial: ${heapMB}MB`);
        } else {
          const growth = heap - initialMemory.current;
          const growthMB = (growth / 1024 / 1024).toFixed(2);
          const emoji =
            growth > 50000000 ? '🔴' : growth > 20000000 ? '🟠' : '🟢';
          console.log(
            `[MEMORY] ${emoji} Current: ${heapMB}MB (${growth > 0 ? '+' : ''}${growthMB}MB since start)`
          );
        }
      }
    };

    checkMemory();
    const interval = setInterval(checkMemory, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
};

// ============================================
// 3. EFFECT TRACKING
// ============================================

/**
 * Logs when an effect runs and why
 * Usage: useEffectTracker('fetchBooks', [bookId, filter], () => { ... });
 */
export const useEffectTracker = (
  name: string,
  deps: any[],
  effect: () => void | (() => void)
) => {
  const prevDeps = useRef<any[]>(deps);
  const runCount = useRef(0);

  useEffect(() => {
    runCount.current++;

    // Find which dep changed
    const changedDeps = deps
      .map((dep, i) => {
        if (prevDeps.current[i] !== dep) {
          return `deps[${i}]: ${JSON.stringify(prevDeps.current[i])} → ${JSON.stringify(dep)}`;
        }
        return null;
      })
      .filter(Boolean);

    console.log(
      `[EFFECT] ${name} run #${runCount.current}` +
        (changedDeps.length
          ? `\n  Changed: ${changedDeps.join(', ')}`
          : ' (initial)')
    );

    prevDeps.current = [...deps];

    const cleanup = effect();

    return () => {
      if (cleanup) {
        console.log(`[EFFECT CLEANUP] ${name}`);
        cleanup();
      }
    };
  }, deps);
};

// ============================================
// 4. LISTENER TRACKING
// ============================================

/**
 * Track all active listeners (to find leaks)
 */
class ListenerTracker {
  private listeners: Map<string, { count: number; stack: string }> = new Map();

  add(name: string) {
    const existing = this.listeners.get(name) || { count: 0, stack: '' };
    existing.count++;
    existing.stack = new Error().stack || '';
    this.listeners.set(name, existing);
    console.log(`[LISTENER+] ${name} (${existing.count} active)`);
  }

  remove(name: string) {
    const existing = this.listeners.get(name);
    if (existing) {
      existing.count--;
      console.log(`[LISTENER-] ${name} (${existing.count} active)`);
      if (existing.count === 0) {
        this.listeners.delete(name);
      }
    } else {
      console.warn(`[LISTENER?] ${name} removed but was never added!`);
    }
  }

  report() {
    console.log('\n[LISTENER REPORT]');
    if (this.listeners.size === 0) {
      console.log('  ✅ No active listeners');
    } else {
      this.listeners.forEach((info, name) => {
        const emoji = info.count > 1 ? '🔴' : '🟢';
        console.log(`  ${emoji} ${name}: ${info.count} active`);
      });
    }
  }
}

export const listenerTracker = new ListenerTracker();

// ============================================
// 5. IMAGE LOAD TRACKING
// ============================================

/**
 * Track image loads to find flickering issues
 */
export const useImageLoadTracker = (uri: string, componentName: string) => {
  const loadCount = useRef(0);

  useEffect(() => {
    loadCount.current++;
    if (loadCount.current > 1) {
      console.warn(
        `[IMAGE] ⚠️ ${componentName} loading image #${loadCount.current} times!`
      );
      console.warn(`  URI: ${uri?.slice(0, 50)}...`);
    }
  }, [uri]);

  return {
    onLoadStart: () => console.log(`[IMAGE] ${componentName} load start`),
    onLoadEnd: () => console.log(`[IMAGE] ${componentName} load end`),
    onError: (e: any) => console.error(`[IMAGE] ${componentName} error:`, e),
  };
};

// ============================================
// 6. TIMING UTILITIES
// ============================================

/**
 * Time a sync operation
 */
export const timeSync = <T>(name: string, fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  const emoji = duration > 100 ? '🔴' : duration > 16 ? '🟠' : '🟢';
  console.log(`[TIME] ${emoji} ${name}: ${duration.toFixed(2)}ms`);
  return result;
};

/**
 * Time an async operation
 */
export const timeAsync = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    const emoji = duration > 1000 ? '🔴' : duration > 100 ? '🟠' : '🟢';
    console.log(`[TIME] ${emoji} ${name}: ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    console.log(
      `[TIME] 💥 ${name} failed after ${(performance.now() - start).toFixed(2)}ms`
    );
    throw error;
  }
};

// ============================================
// 7. GLOBAL APP MONITOR
// ============================================

/**
 * Add to App.tsx to monitor overall app health
 * Usage: useAppHealthMonitor();
 */
export const useAppHealthMonitor = () => {
  const startTime = useRef(Date.now());

  // Memory monitoring
  useMemoryMonitor(60000); // Every minute

  // App state monitoring
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const uptime = Math.round((Date.now() - startTime.current) / 1000 / 60);
      console.log(`[APP] State: ${state}, Uptime: ${uptime} minutes`);

      if (state === 'active') {
        listenerTracker.report();
      }
    });

    return () => subscription.remove();
  }, []);

  // Periodic health check
  useEffect(() => {
    const interval = setInterval(() => {
      const uptime = Math.round((Date.now() - startTime.current) / 1000 / 60);
      console.log(`\n========== HEALTH CHECK (${uptime}min uptime) ==========`);
      listenerTracker.report();
      console.log('================================================\n');
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);
};

// ============================================
// 8. COMPONENT PROFILER WRAPPER
// ============================================

/**
 * Wrap a component to profile it
 * Usage: export default withProfiler(MyComponent, 'MyComponent');
 */
export const withProfiler = <P extends object>(
  Component: React.ComponentType<P>,
  name: string
): React.FC<P> => {
  const ProfiledComponent: React.FC<P> = (props) => {
    useRenderTracker(name);
    useLifecycleTracker(name);
    return React.createElement(Component, props);
  };
  ProfiledComponent.displayName = `Profiled(${name})`;
  return ProfiledComponent;
};

// ============================================
// 9. STORE SUBSCRIPTION TRACKER
// ============================================

/**
 * Track Zustand store subscriptions
 */
export const useStoreSubscriptionTracker = (storeName: string) => {
  useEffect(() => {
    listenerTracker.add(`zustand:${storeName}`);
    return () => listenerTracker.remove(`zustand:${storeName}`);
  }, [storeName]);
};

// ============================================
// 10. NAVIGATION TRACKER
// ============================================

/**
 * Track navigation events
 */
export const useNavigationTracker = (routeName: string) => {
  useEffect(() => {
    console.log(`[NAV] → ${routeName}`);
    return () => console.log(`[NAV] ← ${routeName}`);
  }, [routeName]);
};
