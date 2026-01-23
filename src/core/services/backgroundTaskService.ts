/**
 * src/core/services/backgroundTaskService.ts
 *
 * Background task completion service.
 * Ensures critical tasks complete when app goes to background.
 *
 * iOS: Uses native beginBackgroundTask API (via native module if available)
 * Android: Uses foreground service or WorkManager (via native module if available)
 * Fallback: Prioritized timeout-based completion for both platforms
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import { trackEvent } from '@/core/monitoring';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('BackgroundTask');

// Configuration
const DEFAULT_TIMEOUT_MS = 4000;  // 4 seconds (iOS gives ~5s)
const MAX_BACKGROUND_TIME_MS = 25000;  // 25 seconds max (iOS background task can give up to 30s)

// Priority levels for tasks (higher = runs first)
export enum TaskPriority {
  CRITICAL = 100,   // Must complete (progress sync)
  HIGH = 75,        // Should complete (download state save)
  NORMAL = 50,      // Nice to complete (cache updates)
  LOW = 25,         // Optional (prefetch)
}

export interface BackgroundTask {
  id: string;
  name: string;
  priority: TaskPriority;
  execute: () => Promise<void>;
  timeoutMs?: number;  // Per-task timeout (default: 2000ms)
}

interface RegisteredTask extends BackgroundTask {
  registeredAt: number;
}

class BackgroundTaskService {
  private registeredTasks: Map<string, RegisteredTask> = new Map();
  private pendingTasks: Map<string, RegisteredTask> = new Map();
  private isProcessing: boolean = false;
  private appStateListener: { remove: () => void } | null = null;
  private backgroundStartTime: number = 0;

  // Native module for extended background time (if available)
  private nativeModule: any = null;
  private backgroundTaskId: number | null = null;

  constructor() {
    // Try to load native background task module
    this.loadNativeModule();
  }

  private loadNativeModule(): void {
    // Note: Would need a custom native module for beginBackgroundTask
    // For now, we use the timeout-based approach
    try {
      // This would be a custom module like:
      // this.nativeModule = require('../../../../modules/background-task-module');
      this.nativeModule = null;
    } catch {
      this.nativeModule = null;
    }
  }

  /**
   * Start listening for app state changes
   */
  start(): void {
    if (this.appStateListener) {
      log.debug('Already started');
      return;
    }

    this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange);
    log.info('Started background task service');
  }

  /**
   * Stop listening and cleanup
   */
  stop(): void {
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    this.registeredTasks.clear();
    this.pendingTasks.clear();
    log.info('Stopped background task service');
  }

  /**
   * Register a task that should run when going to background.
   * Tasks are de-duplicated by ID - registering same ID updates the task.
   *
   * @returns Cleanup function to unregister the task
   */
  registerTask(task: BackgroundTask): () => void {
    const registeredTask: RegisteredTask = {
      ...task,
      registeredAt: Date.now(),
    };

    this.registeredTasks.set(task.id, registeredTask);
    log.debug(`Registered task: ${task.name} (priority: ${task.priority})`);

    return () => {
      this.registeredTasks.delete(task.id);
      this.pendingTasks.delete(task.id);
      log.debug(`Unregistered task: ${task.name}`);
    };
  }

  /**
   * Queue a one-time task that needs to complete before background.
   * Unlike registerTask, this adds to pending queue immediately.
   */
  queueTask(task: BackgroundTask): void {
    const registeredTask: RegisteredTask = {
      ...task,
      registeredAt: Date.now(),
    };
    this.pendingTasks.set(task.id, registeredTask);
    log.debug(`Queued pending task: ${task.name}`);
  }

  /**
   * Force execution of all pending tasks (e.g., on logout)
   */
  async flushPendingTasks(): Promise<void> {
    if (this.pendingTasks.size === 0) {
      return;
    }

    log.debug(`Flushing ${this.pendingTasks.size} pending tasks`);
    await this.executeTasks(Array.from(this.pendingTasks.values()));
    this.pendingTasks.clear();
  }

  private handleAppStateChange = async (nextState: AppStateStatus): Promise<void> => {
    if (nextState === 'background' || nextState === 'inactive') {
      // App going to background
      if (!this.isProcessing) {
        await this.processBackgroundTasks();
      }
    } else if (nextState === 'active') {
      // App returning to foreground
      this.backgroundStartTime = 0;
      this.endNativeBackgroundTask();
    }
  };

  private async processBackgroundTasks(): Promise<void> {
    this.isProcessing = true;
    this.backgroundStartTime = Date.now();

    const startTime = Date.now();
    log.debug('Processing background tasks...');

    // Request extended background time (if native module available)
    await this.beginNativeBackgroundTask();

    // Collect all tasks: registered + pending
    const allTasks: RegisteredTask[] = [
      ...Array.from(this.registeredTasks.values()),
      ...Array.from(this.pendingTasks.values()),
    ];

    // Sort by priority (highest first)
    allTasks.sort((a, b) => b.priority - a.priority);

    // De-duplicate by ID (keep highest priority version)
    const uniqueTasks = new Map<string, RegisteredTask>();
    for (const task of allTasks) {
      if (!uniqueTasks.has(task.id)) {
        uniqueTasks.set(task.id, task);
      }
    }

    const tasksToRun = Array.from(uniqueTasks.values());
    log.debug(`Running ${tasksToRun.length} background tasks`);

    // Execute tasks with overall timeout
    const maxTime = this.nativeModule ? MAX_BACKGROUND_TIME_MS : DEFAULT_TIMEOUT_MS;

    try {
      await this.executeTasks(tasksToRun, maxTime);
    } finally {
      // Clear pending tasks (they've had their chance)
      this.pendingTasks.clear();

      // End native background task
      this.endNativeBackgroundTask();

      const elapsed = Date.now() - startTime;
      log.debug(`Background tasks completed in ${elapsed}ms`);

      trackEvent('background_tasks_completed', {
        taskCount: tasksToRun.length,
        elapsedMs: elapsed,
        hadNativeSupport: !!this.nativeModule,
        platform: Platform.OS,
      }, 'info');

      this.isProcessing = false;
    }
  }

  private async executeTasks(
    tasks: RegisteredTask[],
    overallTimeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<void> {
    const startTime = Date.now();
    let completedCount = 0;
    let failedCount = 0;

    for (const task of tasks) {
      // Check if we've exceeded overall timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= overallTimeoutMs) {
        log.warn(`Overall timeout reached - skipping remaining ${tasks.length - completedCount - failedCount} tasks`);
        trackEvent('background_task_timeout', {
          completedCount,
          skippedCount: tasks.length - completedCount - failedCount,
          timeoutMs: overallTimeoutMs,
        }, 'warning');
        break;
      }

      // Calculate remaining time for this task
      const remainingTime = overallTimeoutMs - elapsed;
      const taskTimeout = Math.min(task.timeoutMs || 2000, remainingTime);

      try {
        log.debug(`Executing task: ${task.name} (timeout: ${taskTimeout}ms)`);

        // Race task against timeout
        const result = await Promise.race([
          task.execute().then(() => 'success' as const),
          new Promise<'timeout'>(resolve =>
            setTimeout(() => resolve('timeout'), taskTimeout)
          ),
        ]);

        if (result === 'timeout') {
          log.warn(`Task timed out: ${task.name}`);
          failedCount++;
        } else {
          log.debug(`Task completed: ${task.name}`);
          completedCount++;
        }
      } catch (error) {
        log.error(`Task failed: ${task.name}`, error);
        failedCount++;
      }
    }

    log.info(`Tasks summary: ${completedCount} completed, ${failedCount} failed`);
  }

  private async beginNativeBackgroundTask(): Promise<void> {
    if (!this.nativeModule) {
      return;
    }

    try {
      this.backgroundTaskId = await this.nativeModule.beginBackgroundTask(
        'AudiobookShelf Background Sync'
      );
      log.debug(`Native background task started: ${this.backgroundTaskId}`);
    } catch (error) {
      log.warn('Failed to start native background task:', error);
    }
  }

  private endNativeBackgroundTask(): void {
    if (!this.nativeModule || this.backgroundTaskId === null) {
      return;
    }

    try {
      this.nativeModule.endBackgroundTask(this.backgroundTaskId);
      log.debug(`Native background task ended: ${this.backgroundTaskId}`);
      this.backgroundTaskId = null;
    } catch (error) {
      log.warn('Failed to end native background task:', error);
    }
  }
}

export const backgroundTaskService = new BackgroundTaskService();
