/**
 * src/features/player/services/bufferRecoveryService.ts
 *
 * Streaming buffer underrun detection and recovery service.
 * Monitors playback for buffer underruns and implements recovery strategies.
 *
 * Recovery strategies:
 * 1. Automatic retry with exponential backoff
 * 2. Seek back slightly to refill buffer (rewind recovery)
 * 3. Network quality monitoring
 * 4. Notify user after repeated failures
 */

import { Platform } from 'react-native';
import { trackEvent } from '@/core/monitoring';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('BufferRecovery');

// Configuration
const BUFFER_STALL_THRESHOLD_MS = 5000;      // 5 seconds of buffering = potential underrun
const MAX_RETRIES = 3;                        // Max recovery attempts before notifying user
const RETRY_BACKOFF_BASE_MS = 1000;           // Base backoff: 1s, 2s, 4s
const REWIND_RECOVERY_SECONDS = 2;            // Seek back 2s on recovery
const RECOVERY_COOLDOWN_MS = 30000;           // 30s cooldown between recovery cycles
const BUFFER_MONITOR_INTERVAL_MS = 1000;      // Check buffer state every second

export type BufferState = 'ok' | 'buffering' | 'stalled' | 'recovering' | 'failed';

export interface BufferStatus {
  state: BufferState;
  bufferingStartedAt: number | null;
  bufferingDurationMs: number;
  recoveryAttempts: number;
  lastRecoveryAt: number | null;
  totalStallsInSession: number;
}

export interface RecoveryOptions {
  onRecoveryStart?: () => void;
  onRecoverySuccess?: () => void;
  onRecoveryFailed?: (attempts: number) => void;
  onBufferingStart?: () => void;
  onBufferingEnd?: () => void;
  onSeekForRecovery?: (newPosition: number) => Promise<void>;
  getCurrentPosition?: () => number;
  retryPlay?: () => Promise<boolean>;
}

class BufferRecoveryService {
  private status: BufferStatus = {
    state: 'ok',
    bufferingStartedAt: null,
    bufferingDurationMs: 0,
    recoveryAttempts: 0,
    lastRecoveryAt: null,
    totalStallsInSession: 0,
  };

  private monitorInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private options: RecoveryOptions = {};
  private isRecovering: boolean = false;

  // Track network conditions
  private recentBufferEvents: number[] = [];  // Timestamps of recent buffer events
  private readonly BUFFER_EVENT_WINDOW_MS = 60000;  // Track events in last 60s

  /**
   * Start monitoring buffer state.
   * @param options Callbacks for recovery events
   */
  start(options: RecoveryOptions): void {
    if (this.isMonitoring) {
      log.debug('Already monitoring');
      return;
    }

    this.options = options;
    this.isMonitoring = true;
    this.resetStatus();

    log.info('Started buffer monitoring');
  }

  /**
   * Stop monitoring buffer state.
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.clearMonitorInterval();
    this.options = {};

    log.info('Stopped buffer monitoring');
  }

  /**
   * Report that buffering has started.
   * Called by audioService when player enters buffering state.
   */
  reportBufferingStarted(): void {
    if (!this.isMonitoring) return;

    if (this.status.state === 'buffering' || this.status.state === 'stalled') {
      // Already in buffering state
      return;
    }

    log.debug('Buffering started');

    this.status.state = 'buffering';
    this.status.bufferingStartedAt = Date.now();

    // Track this buffer event
    this.recentBufferEvents.push(Date.now());
    this.cleanupOldBufferEvents();

    // Start monitoring for stall
    this.startMonitorInterval();

    this.options.onBufferingStart?.();
  }

  /**
   * Report that buffering has ended (playback resumed).
   * Called by audioService when player exits buffering state.
   */
  reportBufferingEnded(): void {
    if (!this.isMonitoring) return;

    if (this.status.state !== 'buffering' && this.status.state !== 'stalled') {
      return;
    }

    const duration = this.status.bufferingStartedAt
      ? Date.now() - this.status.bufferingStartedAt
      : 0;

    log.debug(`Buffering ended after ${duration}ms`);

    // If this was a stall that got resolved, count it
    if (this.status.state === 'stalled' || duration >= BUFFER_STALL_THRESHOLD_MS) {
      this.status.totalStallsInSession++;

      trackEvent('buffer_stall_resolved', {
        durationMs: duration,
        recoveryAttempts: this.status.recoveryAttempts,
        wasRecovering: this.status.state === 'recovering',
        platform: Platform.OS,
      }, 'info');
    }

    this.status.state = 'ok';
    this.status.bufferingDurationMs = duration;
    this.status.bufferingStartedAt = null;
    this.status.recoveryAttempts = 0;

    this.clearMonitorInterval();
    this.options.onBufferingEnd?.();
  }

  /**
   * Get current buffer status.
   */
  getStatus(): BufferStatus {
    // Update buffering duration if currently buffering
    if (this.status.bufferingStartedAt) {
      this.status.bufferingDurationMs = Date.now() - this.status.bufferingStartedAt;
    }
    return { ...this.status };
  }

  /**
   * Check if network appears unstable (many recent buffer events).
   */
  isNetworkUnstable(): boolean {
    this.cleanupOldBufferEvents();
    // If more than 3 buffer events in last minute, network is unstable
    return this.recentBufferEvents.length > 3;
  }

  /**
   * Get estimated network quality based on recent buffering.
   * Returns 'good', 'fair', or 'poor'.
   */
  getNetworkQuality(): 'good' | 'fair' | 'poor' {
    this.cleanupOldBufferEvents();
    const eventCount = this.recentBufferEvents.length;

    if (eventCount === 0) return 'good';
    if (eventCount <= 2) return 'fair';
    return 'poor';
  }

  /**
   * Reset status for new playback session.
   */
  resetStatus(): void {
    this.status = {
      state: 'ok',
      bufferingStartedAt: null,
      bufferingDurationMs: 0,
      recoveryAttempts: 0,
      lastRecoveryAt: null,
      totalStallsInSession: 0,
    };
    this.recentBufferEvents = [];
    this.isRecovering = false;
    this.clearMonitorInterval();
  }

  /**
   * Start the monitor interval that checks for stalls.
   */
  private startMonitorInterval(): void {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(() => {
      this.checkForStall();
    }, BUFFER_MONITOR_INTERVAL_MS);
  }

  /**
   * Clear the monitor interval.
   */
  private clearMonitorInterval(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Check if current buffering has become a stall.
   */
  private async checkForStall(): Promise<void> {
    if (!this.status.bufferingStartedAt) return;
    if (this.isRecovering) return;

    const duration = Date.now() - this.status.bufferingStartedAt;

    if (duration >= BUFFER_STALL_THRESHOLD_MS) {
      // This is a stall - attempt recovery
      log.warn(`Buffer stall detected after ${duration}ms`);
      this.status.state = 'stalled';

      await this.attemptRecovery();
    }
  }

  /**
   * Attempt to recover from buffer underrun.
   */
  private async attemptRecovery(): Promise<void> {
    if (this.isRecovering) return;

    // Check cooldown
    if (this.status.lastRecoveryAt) {
      const timeSinceLastRecovery = Date.now() - this.status.lastRecoveryAt;
      if (timeSinceLastRecovery < RECOVERY_COOLDOWN_MS && this.status.recoveryAttempts >= MAX_RETRIES) {
        log.warn('Recovery on cooldown, waiting...');
        return;
      }
    }

    this.isRecovering = true;
    this.status.state = 'recovering';
    this.status.recoveryAttempts++;
    this.status.lastRecoveryAt = Date.now();

    log.info(`Attempting recovery (attempt ${this.status.recoveryAttempts}/${MAX_RETRIES})`);

    this.options.onRecoveryStart?.();

    try {
      // Strategy 1: Try simple retry with backoff
      const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, this.status.recoveryAttempts - 1);
      log.debug(`Waiting ${backoffMs}ms before retry...`);

      await new Promise(resolve => setTimeout(resolve, backoffMs));

      // Attempt to play
      if (this.options.retryPlay) {
        const success = await this.options.retryPlay();

        if (success) {
          log.info('Recovery successful via retry');
          this.handleRecoverySuccess();
          return;
        }
      }

      // Strategy 2: Rewind recovery - seek back slightly to refill buffer
      if (this.options.onSeekForRecovery && this.options.getCurrentPosition) {
        const currentPos = this.options.getCurrentPosition();
        const newPos = Math.max(0, currentPos - REWIND_RECOVERY_SECONDS);

        log.info(`Attempting rewind recovery: ${currentPos.toFixed(1)}s -> ${newPos.toFixed(1)}s`);

        await this.options.onSeekForRecovery(newPos);

        // Wait a bit and check if playing
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (this.options.retryPlay) {
          const success = await this.options.retryPlay();

          if (success) {
            log.info('Recovery successful via rewind');
            this.handleRecoverySuccess();
            return;
          }
        }
      }

      // Recovery attempt failed
      if (this.status.recoveryAttempts >= MAX_RETRIES) {
        log.error(`Recovery failed after ${MAX_RETRIES} attempts`);
        this.handleRecoveryFailed();
      } else {
        log.warn(`Recovery attempt ${this.status.recoveryAttempts} failed, will retry`);
        this.isRecovering = false;
        // Will retry on next checkForStall interval
      }

    } catch (error) {
      log.error('Recovery error:', error);

      if (this.status.recoveryAttempts >= MAX_RETRIES) {
        this.handleRecoveryFailed();
      }
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Handle successful recovery.
   */
  private handleRecoverySuccess(): void {
    trackEvent('buffer_recovery_success', {
      attempts: this.status.recoveryAttempts,
      platform: Platform.OS,
    }, 'info');

    this.options.onRecoverySuccess?.();

    // Reset state but keep stall count
    this.status.state = 'ok';
    this.status.bufferingStartedAt = null;
    this.status.recoveryAttempts = 0;
    this.clearMonitorInterval();
  }

  /**
   * Handle failed recovery (max retries exhausted).
   */
  private handleRecoveryFailed(): void {
    this.status.state = 'failed';

    trackEvent('buffer_recovery_failed', {
      attempts: this.status.recoveryAttempts,
      totalStallsInSession: this.status.totalStallsInSession,
      networkQuality: this.getNetworkQuality(),
      platform: Platform.OS,
    }, 'error');

    this.options.onRecoveryFailed?.(this.status.recoveryAttempts);
    this.clearMonitorInterval();
  }

  /**
   * Remove old buffer events outside the tracking window.
   */
  private cleanupOldBufferEvents(): void {
    const cutoff = Date.now() - this.BUFFER_EVENT_WINDOW_MS;
    this.recentBufferEvents = this.recentBufferEvents.filter(t => t > cutoff);
  }
}

export const bufferRecoveryService = new BufferRecoveryService();
