/**
 * src/core/services/tokenHealthService.ts
 *
 * Token health monitoring service.
 * Proactively verifies token validity and triggers re-auth before expiration.
 */

import { AppState, AppStateStatus } from 'react-native';
import { authService } from '@/core/auth/authService';
import { apiClient } from '@/core/api';
import { trackEvent } from '@/core/monitoring';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('TokenHealth');

// Configuration
const CHECK_INTERVAL_MS = 5 * 60 * 1000;  // Check every 5 minutes
const BACKGROUND_CHECK_THRESHOLD_MS = 30 * 60 * 1000;  // Check after 30 min in background
const MAX_FAILED_CHECKS = 3;  // Consecutive failures before triggering re-auth

export interface TokenHealthStatus {
  isValid: boolean;
  lastChecked: number;
  consecutiveFailures: number;
  lastError: string | null;
}

type TokenHealthCallback = (status: TokenHealthStatus) => void;

class TokenHealthService {
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheck: number = 0;
  private consecutiveFailures: number = 0;
  private lastError: string | null = null;
  private backgroundTime: number = 0;
  private isRunning: boolean = false;

  // Callback for token health changes (e.g., to show re-auth dialog)
  private onTokenInvalid: TokenHealthCallback | null = null;
  private onTokenRestored: TokenHealthCallback | null = null;

  // App state listener
  private appStateListener: { remove: () => void } | null = null;

  /**
   * Set callback for when token becomes invalid
   */
  setOnTokenInvalid(callback: TokenHealthCallback | null): void {
    this.onTokenInvalid = callback;
  }

  /**
   * Set callback for when token is restored (after re-auth)
   */
  setOnTokenRestored(callback: TokenHealthCallback | null): void {
    this.onTokenRestored = callback;
  }

  /**
   * Start monitoring token health
   */
  start(): void {
    if (this.isRunning) {
      log.debug('Already running');
      return;
    }

    log.debug('Starting token health monitoring');
    this.isRunning = true;
    this.consecutiveFailures = 0;
    this.lastError = null;

    // Listen for app state changes
    this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange);

    // Start periodic checks
    this.startPeriodicCheck();

    // Do initial check
    this.checkTokenHealth();
  }

  /**
   * Stop monitoring token health
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    log.debug('Stopping token health monitoring');
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
   * Get current health status
   */
  getStatus(): TokenHealthStatus {
    return {
      isValid: this.consecutiveFailures === 0,
      lastChecked: this.lastCheck,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError,
    };
  }

  /**
   * Force a token check (e.g., after coming back online)
   */
  async forceCheck(): Promise<boolean> {
    return this.checkTokenHealth();
  }

  /**
   * Notify service that token was refreshed (e.g., after re-login)
   */
  notifyTokenRefreshed(): void {
    log.debug('Token refreshed notification received');
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.lastCheck = Date.now();

    if (this.onTokenRestored) {
      this.onTokenRestored(this.getStatus());
    }
  }

  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkTokenHealth();
    }, CHECK_INTERVAL_MS);
  }

  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state === 'active') {
      // Coming back to foreground
      const backgroundDuration = Date.now() - this.backgroundTime;
      log.debug(`App became active after ${Math.round(backgroundDuration / 1000)}s in background`);

      // If we've been in background for a while, check token immediately
      if (backgroundDuration > BACKGROUND_CHECK_THRESHOLD_MS) {
        log.debug('Extended background period detected - checking token');
        this.checkTokenHealth();
      }
    } else if (state === 'background') {
      // Going to background
      this.backgroundTime = Date.now();
      log.debug('App went to background');
    }
  };

  private async checkTokenHealth(): Promise<boolean> {
    if (!this.isRunning) {
      return false;
    }

    // Don't check if no token is set
    const token = apiClient.getAuthToken();
    if (!token) {
      log.debug('No token set - skipping check');
      return false;
    }

    log.debug('Checking token health...');
    this.lastCheck = Date.now();

    try {
      // Verify token by calling /api/me
      const isValid = await authService.verifyToken();

      if (isValid) {
        // Token is valid
        if (this.consecutiveFailures > 0) {
          log.debug('Token restored after failures');
          this.consecutiveFailures = 0;
          this.lastError = null;

          if (this.onTokenRestored) {
            this.onTokenRestored(this.getStatus());
          }

          trackEvent('token_health_restored', {
            previousFailures: this.consecutiveFailures,
          }, 'info');
        }
        return true;
      } else {
        // Token verification returned false (usually 401)
        return this.handleCheckFailure('Token verification failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.handleCheckFailure(errorMsg);
    }
  }

  private handleCheckFailure(error: string): boolean {
    this.consecutiveFailures++;
    this.lastError = error;

    log.warn(`Token check failed (${this.consecutiveFailures}/${MAX_FAILED_CHECKS}): ${error}`);

    // Track failures for monitoring
    trackEvent('token_health_check_failed', {
      error,
      consecutiveFailures: this.consecutiveFailures,
    }, this.consecutiveFailures >= MAX_FAILED_CHECKS ? 'error' : 'warning');

    // If we've hit the threshold, notify that re-auth is needed
    if (this.consecutiveFailures >= MAX_FAILED_CHECKS && this.onTokenInvalid) {
      log.debug('Max failures reached - notifying for re-auth');
      this.onTokenInvalid(this.getStatus());
    }

    return false;
  }
}

export const tokenHealthService = new TokenHealthService();
