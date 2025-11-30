/**
 * src/core/native/threadUtils.ts
 *
 * Utilities for offloading heavy work from the main thread.
 * Uses InteractionManager and chunked processing to maintain 60fps.
 */

import { InteractionManager } from 'react-native';

const DEBUG = __DEV__;
const log = (...args: any[]) => DEBUG && console.log('[Thread]', ...args);

// ============================================================================
// TASK SCHEDULER
// ============================================================================

type Priority = 'high' | 'normal' | 'idle';

interface ScheduledTask<T> {
  id: string;
  execute: () => T | Promise<T>;
  priority: Priority;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

class TaskScheduler {
  private queue: ScheduledTask<any>[] = [];
  private isProcessing = false;
  private taskId = 0;

  /**
   * Schedule a task to run when the main thread is idle
   */
  schedule<T>(
    execute: () => T | Promise<T>,
    priority: Priority = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: ScheduledTask<T> = {
        id: `task-${++this.taskId}`,
        execute,
        priority,
        resolve,
        reject,
      };

      // Insert based on priority
      const priorityOrder = { high: 0, normal: 1, idle: 2 };
      const insertIndex = this.queue.findIndex(
        (t) => priorityOrder[t.priority] > priorityOrder[priority]
      );

      if (insertIndex === -1) {
        this.queue.push(task);
      } else {
        this.queue.splice(insertIndex, 0, task);
      }

      this.processQueue();
    });
  }

  /**
   * Schedule a task to run after interactions complete
   */
  scheduleAfterInteractions<T>(execute: () => T | Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const result = await execute();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;

      // Wait for interactions to complete
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });

      try {
        const result = await task.execute();
        task.resolve(result);
      } catch (error) {
        task.reject(error as Error);
      }

      // Small delay to allow UI updates
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    this.isProcessing = false;
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.queue.forEach((task) => {
      task.reject(new Error('Task cancelled'));
    });
    this.queue = [];
  }
}

// ============================================================================
// CHUNKED PROCESSING
// ============================================================================

interface ChunkOptions {
  chunkSize?: number;
  delayBetweenChunks?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Process an array in chunks to avoid blocking the main thread
 */
async function processInChunks<T, R>(
  items: T[],
  processor: (item: T, index: number) => R | Promise<R>,
  options: ChunkOptions = {}
): Promise<R[]> {
  const {
    chunkSize = 10,
    delayBetweenChunks = 0,
    onProgress,
  } = options;

  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < total; i += chunkSize) {
    // Wait for interactions before processing chunk
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map((item, idx) => processor(item, i + idx))
    );
    results.push(...chunkResults);

    // Report progress
    if (onProgress) {
      onProgress(Math.min((i + chunkSize) / total, 1));
    }

    // Delay between chunks if specified
    if (delayBetweenChunks > 0 && i + chunkSize < total) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenChunks));
    }
  }

  return results;
}

/**
 * Process items one by one with idle time between
 */
async function processSequentially<T, R>(
  items: T[],
  processor: (item: T, index: number) => R | Promise<R>,
  options: { onProgress?: (progress: number) => void } = {}
): Promise<R[]> {
  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < total; i++) {
    // Wait for interactions
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    const result = await processor(items[i], i);
    results.push(result);

    if (options.onProgress) {
      options.onProgress((i + 1) / total);
    }
  }

  return results;
}

// ============================================================================
// DEBOUNCED EXECUTION
// ============================================================================

/**
 * Create a debounced function that delays execution
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Create a throttled function that limits execution rate
 */
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

interface BatchCollector<T> {
  add: (item: T) => void;
  flush: () => void;
}

/**
 * Collect items and process them in batches
 */
function createBatchCollector<T>(
  processor: (items: T[]) => void | Promise<void>,
  options: { maxSize?: number; maxWait?: number } = {}
): BatchCollector<T> {
  const { maxSize = 50, maxWait = 100 } = options;
  let batch: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  const flush = async () => {
    if (batch.length === 0) return;
    const items = [...batch];
    batch = [];
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    await processor(items);
  };

  const add = (item: T) => {
    batch.push(item);

    if (batch.length >= maxSize) {
      flush();
    } else if (!timeoutId) {
      timeoutId = setTimeout(flush, maxWait);
    }
  };

  return { add, flush };
}

// ============================================================================
// IDLE CALLBACK POLYFILL
// ============================================================================

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

/**
 * Request idle callback (polyfill for React Native)
 */
function requestIdleCallback(callback: IdleCallback, options?: { timeout?: number }): number {
  const start = Date.now();
  const timeout = options?.timeout || 50;

  // Use setTimeout as a simple polyfill
  return setTimeout(() => {
    callback({
      didTimeout: Date.now() - start >= timeout,
      timeRemaining: () => Math.max(0, timeout - (Date.now() - start)),
    });
  }, 1) as unknown as number;
}

/**
 * Cancel idle callback
 */
function cancelIdleCallback(id: number): void {
  clearTimeout(id);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const taskScheduler = new TaskScheduler();

export {
  processInChunks,
  processSequentially,
  debounce,
  throttle,
  createBatchCollector,
  requestIdleCallback,
  cancelIdleCallback,
};

export type { Priority, ChunkOptions, BatchCollector };
