/**
 * src/core/services/networkMonitor.ts
 *
 * Network monitoring service for WiFi-only downloads.
 * Tracks connection state and provides download permission logic.
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '@/shared/utils/logger';
import { eventBus } from '@/core/events';

// =============================================================================
// CONSTANTS
// =============================================================================

const WIFI_ONLY_KEY = 'downloadWifiOnly';
const AUTO_DOWNLOAD_SERIES_KEY = 'autoDownloadNextInSeries';

const log = createLogger('NetworkMonitor');

// =============================================================================
// TYPES
// =============================================================================

export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';

export interface NetworkState {
  isConnected: boolean;
  connectionType: ConnectionType;
  canDownload: boolean;
}

export type NetworkChangeListener = (state: NetworkState) => void;

// =============================================================================
// NETWORK MONITOR
// =============================================================================

class NetworkMonitor {
  private wifiOnlyEnabled: boolean = true; // Default to WiFi-only
  private autoDownloadSeriesEnabled: boolean = true; // Default enabled
  private currentState: NetInfoState | null = null;
  private listeners: Set<NetworkChangeListener> = new Set();
  private unsubscribe: (() => void) | null = null;
  private initialized: boolean = false;
  // Fix Bug #1: Track initialization in progress to prevent concurrent init calls
  private initPromise: Promise<void> | null = null;
  // FIX: Debounce rapid network changes to prevent excessive listener calls
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 300; // 300ms debounce for network changes
  // Fix Bug #4: Track previous connection state for event emission
  private wasConnected: boolean | null = null;

  /**
   * Initialize the network monitor.
   * Call this on app startup.
   *
   * FIX Bug #1: Prevents duplicate NetInfo listeners from concurrent init calls
   * FIX Bug #2: Returns existing init promise if init is in progress
   */
  async init(): Promise<void> {
    // Fix Bug #1: If already initialized, return immediately
    if (this.initialized) {
      log.debug('Already initialized');
      return;
    }

    // Fix Bug #1: If initialization is in progress, wait for it
    if (this.initPromise) {
      log.debug('Initialization already in progress, waiting...');
      return this.initPromise;
    }

    log.debug('Initializing...');

    // Fix Bug #1: Track the init promise to prevent concurrent initialization
    this.initPromise = this.doInit();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Internal initialization logic
   */
  private async doInit(): Promise<void> {
    // Fix Bug #1: Unsubscribe from any existing listener before re-init
    if (this.unsubscribe) {
      log.debug('Cleaning up existing listener before re-init');
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Load preferences
    await this.loadPreferences();

    // Get initial state
    this.currentState = await NetInfo.fetch();
    // Fix Bug #4: Initialize wasConnected with initial state
    this.wasConnected = this.currentState?.isConnected ?? false;
    log.debug(`Initial state: ${this.getConnectionType()} (connected: ${this.currentState?.isConnected})`);

    // Subscribe to changes with debouncing
    this.unsubscribe = NetInfo.addEventListener((state) => {
      const previousType = this.getConnectionType();
      const wasConnectedBefore = this.wasConnected;
      this.currentState = state;
      const newType = this.getConnectionType();
      const isConnectedNow = state.isConnected ?? false;

      log.debug(`Network changed: ${previousType} → ${newType} (connected: ${isConnectedNow})`);

      // Fix Bug #4: Emit network events when connectivity state changes
      // Only emit after first state is established (wasConnected !== null)
      if (wasConnectedBefore !== null && wasConnectedBefore !== isConnectedNow) {
        if (isConnectedNow) {
          log.debug('Emitting network:online event');
          eventBus.emit('network:online', { connectionType: newType });
        } else {
          log.debug('Emitting network:offline event');
          eventBus.emit('network:offline', {});
        }
      }

      // Update tracking state
      this.wasConnected = isConnectedNow;

      // FIX: Debounce rapid network changes to prevent excessive listener calls
      // This is especially important during WiFi/cellular handoffs
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.notifyListeners();
      }, this.DEBOUNCE_MS);
    });

    this.initialized = true;
    log.debug('Initialized');
  }

  /**
   * Clean up subscriptions
   * FIX: Properly resets all state including initPromise and debounceTimer
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    // FIX: Clear debounce timer to prevent orphaned callbacks
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.listeners.clear();
    this.initialized = false;
    this.initPromise = null;
    this.currentState = null;
    this.wasConnected = null; // Fix Bug #4: Reset connection tracking state
    log.debug('Destroyed');
  }

  // ===========================================================================
  // PREFERENCES
  // ===========================================================================

  private async loadPreferences(): Promise<void> {
    try {
      const [wifiOnly, autoDownload] = await Promise.all([
        AsyncStorage.getItem(WIFI_ONLY_KEY),
        AsyncStorage.getItem(AUTO_DOWNLOAD_SERIES_KEY),
      ]);

      // Default to true if not set
      this.wifiOnlyEnabled = wifiOnly !== 'false';
      this.autoDownloadSeriesEnabled = autoDownload !== 'false';

      log.debug(`Preferences loaded: wifiOnly=${this.wifiOnlyEnabled}, autoDownloadSeries=${this.autoDownloadSeriesEnabled}`);
    } catch {
      log.debug('Failed to load preferences, using defaults');
    }
  }

  /**
   * Get WiFi-only preference
   */
  isWifiOnlyEnabled(): boolean {
    return this.wifiOnlyEnabled;
  }

  /**
   * Set WiFi-only preference
   * FIX LOW: Added error handling for AsyncStorage failure
   */
  async setWifiOnlyEnabled(enabled: boolean): Promise<void> {
    this.wifiOnlyEnabled = enabled;
    try {
      await AsyncStorage.setItem(WIFI_ONLY_KEY, enabled.toString());
      log.debug(`WiFi-only preference set to: ${enabled}`);
    } catch (err) {
      log.warn('Failed to persist WiFi-only preference:', err);
      // Continue - in-memory value is set, just persistence failed
    }
    this.notifyListeners();
  }

  /**
   * Get auto-download series preference
   */
  isAutoDownloadSeriesEnabled(): boolean {
    return this.autoDownloadSeriesEnabled;
  }

  /**
   * Set auto-download series preference
   * FIX LOW: Added error handling for AsyncStorage failure
   */
  async setAutoDownloadSeriesEnabled(enabled: boolean): Promise<void> {
    this.autoDownloadSeriesEnabled = enabled;
    try {
      await AsyncStorage.setItem(AUTO_DOWNLOAD_SERIES_KEY, enabled.toString());
      log.debug(`Auto-download series preference set to: ${enabled}`);
    } catch (err) {
      log.warn('Failed to persist auto-download series preference:', err);
      // Continue - in-memory value is set, just persistence failed
    }
  }

  // ===========================================================================
  // NETWORK STATE
  // ===========================================================================

  /**
   * Get current connection type
   * FIX LOW: Returns 'unknown' if not initialized (safe default)
   */
  getConnectionType(): ConnectionType {
    if (!this.initialized) {
      log.debug('getConnectionType called before init, returning unknown');
    }
    if (!this.currentState) return 'unknown';
    if (!this.currentState.isConnected) return 'none';

    switch (this.currentState.type) {
      case NetInfoStateType.wifi:
        return 'wifi';
      case NetInfoStateType.cellular:
        return 'cellular';
      case NetInfoStateType.none:
        return 'none';
      default:
        return 'unknown';
    }
  }

  /**
   * Check if device is connected to any network
   */
  isConnected(): boolean {
    return this.currentState?.isConnected ?? false;
  }

  /**
   * Check if device is on WiFi
   */
  isOnWifi(): boolean {
    return this.getConnectionType() === 'wifi';
  }

  /**
   * Check if device is on cellular
   */
  isOnCellular(): boolean {
    return this.getConnectionType() === 'cellular';
  }

  /**
   * Check if downloads are currently allowed based on network and preferences
   */
  canDownload(): boolean {
    if (!this.isConnected()) {
      return false;
    }

    if (this.wifiOnlyEnabled && !this.isOnWifi()) {
      return false;
    }

    return true;
  }

  /**
   * Get reason why download is blocked (for user messaging)
   */
  getDownloadBlockedReason(): string | null {
    if (!this.isConnected()) {
      return 'No internet connection';
    }

    if (this.wifiOnlyEnabled && this.isOnCellular()) {
      return 'WiFi-only mode is enabled. Connect to WiFi or disable in settings.';
    }

    return null;
  }

  /**
   * Get full network state
   */
  getState(): NetworkState {
    return {
      isConnected: this.isConnected(),
      connectionType: this.getConnectionType(),
      canDownload: this.canDownload(),
    };
  }

  // ===========================================================================
  // LISTENERS
  // ===========================================================================

  /**
   * Subscribe to network state changes
   *
   * FIX Bug #2: Warns if subscribing before init completes, but still works safely
   * FIX Bug #3: Validates state before calling listener
   */
  subscribe(listener: NetworkChangeListener): () => void {
    // Fix Bug #2: Warn if not initialized (listener will get safe default state)
    if (!this.initialized) {
      log.warn('Subscribing before init() completed - listener will receive initial state when available');
    }

    this.listeners.add(listener);

    // Fix Bug #3: Immediately call with current state (safe even if not initialized)
    // getState() handles null currentState gracefully
    try {
      listener(this.getState());
    } catch (error) {
      log.error('Error in network listener callback:', error);
    }

    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   * FIX Bug #3: Catches errors in listeners to prevent one bad listener from breaking others
   */
  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        log.error('Error in network listener callback:', error);
        // Don't re-throw - one bad listener shouldn't break others
      }
    }
  }
}

// Singleton instance
export const networkMonitor = new NetworkMonitor();
