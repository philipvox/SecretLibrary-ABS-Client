/**
 * src/core/services/memoryPressureService.ts
 *
 * Memory pressure monitoring and response service.
 * Monitors memory usage and takes action to prevent OOM crashes.
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import { trackEvent } from '@/core/monitoring';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('MemoryPressure');

// Try to import memory module
let MemoryModule: any = null;
try {
  MemoryModule = require('@modules/memory-module');
} catch (e) {
  // Module may not be available in Expo Go
}

// Configuration
const CHECK_INTERVAL_MS = 30 * 1000;  // Check every 30 seconds
const WARNING_THRESHOLD_MB = 300;      // Warn at 300MB
const CRITICAL_THRESHOLD_MB = 450;     // Take action at 450MB
const LOW_MEMORY_PERCENT = 85;         // Warn if > 85% of system memory used

export interface MemoryStatus {
  usedMb: number;
  availableMb: number;
  isLowMemory: boolean;
  isWarning: boolean;
  isCritical: boolean;
}

type MemoryCleanupCallback = () => Promise<void>;

class MemoryPressureService {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastStatus: MemoryStatus | null = null;

  // Callbacks for memory cleanup
  private cleanupCallbacks: MemoryCleanupCallback[] = [];

  // App state listener
  private appStateListener: { remove: () => void } | null = null;

  /**
   * Register a cleanup callback that will be called when memory pressure is detected.
   * Callbacks should release caches, image memory, etc.
   *
   * @returns A function to unregister the callback
   */
  registerCleanupCallback(callback: MemoryCleanupCallback): () => void {
    this.cleanupCallbacks.push(callback);
    log.debug(`Registered cleanup callback (${this.cleanupCallbacks.length} total)`);

    return () => {
      const index = this.cleanupCallbacks.indexOf(callback);
      if (index > -1) {
        this.cleanupCallbacks.splice(index, 1);
        log.debug(`Unregistered cleanup callback (${this.cleanupCallbacks.length} remaining)`);
      }
    };
  }

  /**
   * Start monitoring memory pressure
   */
  start(): void {
    if (this.isRunning) {
      log.debug('Already running');
      return;
    }

    if (!MemoryModule) {
      log.debug('MemoryModule not available - memory monitoring disabled');
      return;
    }

    log.info('Starting memory pressure monitoring');
    this.isRunning = true;

    // Listen for app state changes
    this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange);

    // Start periodic checks
    this.startPeriodicCheck();

    // Do initial check
    this.checkMemoryPressure();
  }

  /**
   * Stop monitoring memory pressure
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    log.info('Stopping memory pressure monitoring');
    this.isRunning = false;

    // Clear interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Remove app state listener
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
  }

  /**
   * Get current memory status
   */
  async getStatus(): Promise<MemoryStatus | null> {
    if (!MemoryModule) {
      return null;
    }

    try {
      const info = await MemoryModule.getMemoryInfo();

      const usedMb = info.usedMb || 0;
      const availableMb = info.availableMb || 0;
      const isLowMemory = info.lowMemory || false;
      const usedPercent = info.usedPercent || 0;

      const status: MemoryStatus = {
        usedMb,
        availableMb,
        isLowMemory: isLowMemory || usedPercent > LOW_MEMORY_PERCENT,
        isWarning: usedMb > WARNING_THRESHOLD_MB,
        isCritical: usedMb > CRITICAL_THRESHOLD_MB,
      };

      return status;
    } catch (error) {
      log.warn('Failed to get memory info:', error);
      return null;
    }
  }

  /**
   * Force a memory pressure check and cleanup if needed
   */
  async forceCheck(): Promise<MemoryStatus | null> {
    return this.checkMemoryPressure();
  }

  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, CHECK_INTERVAL_MS);
  }

  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state === 'active') {
      // Coming back to foreground - check memory
      log.debug('App became active - checking memory');
      this.checkMemoryPressure();
    }
  };

  private async checkMemoryPressure(): Promise<MemoryStatus | null> {
    if (!this.isRunning || !MemoryModule) {
      return null;
    }

    const status = await this.getStatus();
    if (!status) {
      return null;
    }

    this.lastStatus = status;

    // Log memory status
    log.debug(`Memory: ${status.usedMb.toFixed(1)}MB used, ${status.availableMb.toFixed(1)}MB available`);

    // Check if we need to take action
    if (status.isCritical) {
      log.warn('CRITICAL memory pressure - triggering cleanup');
      await this.triggerCleanup('critical');
    } else if (status.isWarning) {
      log.warn('Warning: high memory usage');
      trackEvent('memory_pressure_warning', {
        usedMb: Math.round(status.usedMb),
        availableMb: Math.round(status.availableMb),
        platform: Platform.OS,
      }, 'warning');
    } else if (status.isLowMemory) {
      log.warn('System low memory detected');
      await this.triggerCleanup('low_memory');
    }

    return status;
  }

  private async triggerCleanup(reason: 'critical' | 'low_memory'): Promise<void> {
    log.info(`Triggering memory cleanup (reason: ${reason})`);

    // Track the cleanup event
    const beforeStatus = await this.getStatus();

    trackEvent('memory_cleanup_triggered', {
      reason,
      usedMbBefore: Math.round(beforeStatus?.usedMb || 0),
      callbackCount: this.cleanupCallbacks.length,
      platform: Platform.OS,
    }, reason === 'critical' ? 'error' : 'warning');

    // Call all registered cleanup callbacks
    const results = await Promise.allSettled(
      this.cleanupCallbacks.map(callback => callback())
    );

    // Log results
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    log.info(`Cleanup complete: ${succeeded} succeeded, ${failed} failed`);

    // Request garbage collection (hint to JS engine)
    if (global.gc) {
      try {
        global.gc();
        log.debug('Requested garbage collection');
      } catch {
        // GC not available
      }
    }

    // Check memory after cleanup
    const afterStatus = await this.getStatus();
    const freedMb = (beforeStatus?.usedMb || 0) - (afterStatus?.usedMb || 0);

    log.info(`Memory freed: ${freedMb.toFixed(1)}MB`);

    trackEvent('memory_cleanup_completed', {
      reason,
      freedMb: Math.round(freedMb),
      usedMbAfter: Math.round(afterStatus?.usedMb || 0),
      platform: Platform.OS,
    }, 'info');
  }
}

export const memoryPressureService = new MemoryPressureService();
