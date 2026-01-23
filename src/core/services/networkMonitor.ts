/**
 * src/core/services/networkMonitor.ts
 *
 * Network monitoring service for WiFi-only downloads.
 * Tracks connection state and provides download permission logic.
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '@/shared/utils/logger';

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

  /**
   * Initialize the network monitor.
   * Call this on app startup.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      log.debug('Already initialized');
      return;
    }

    log.debug('Initializing...');

    // Load preferences
    await this.loadPreferences();

    // Get initial state
    this.currentState = await NetInfo.fetch();
    log.debug(`Initial state: ${this.getConnectionType()} (connected: ${this.currentState?.isConnected})`);

    // Subscribe to changes
    this.unsubscribe = NetInfo.addEventListener((state) => {
      const previousType = this.getConnectionType();
      this.currentState = state;
      const newType = this.getConnectionType();

      log.debug(`Network changed: ${previousType} → ${newType} (connected: ${state.isConnected})`);

      // Notify listeners
      this.notifyListeners();
    });

    this.initialized = true;
    log.debug('Initialized');
  }

  /**
   * Clean up subscriptions
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners.clear();
    this.initialized = false;
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
    } catch (err) {
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
   */
  async setWifiOnlyEnabled(enabled: boolean): Promise<void> {
    this.wifiOnlyEnabled = enabled;
    await AsyncStorage.setItem(WIFI_ONLY_KEY, enabled.toString());
    log.debug(`WiFi-only preference set to: ${enabled}`);
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
   */
  async setAutoDownloadSeriesEnabled(enabled: boolean): Promise<void> {
    this.autoDownloadSeriesEnabled = enabled;
    await AsyncStorage.setItem(AUTO_DOWNLOAD_SERIES_KEY, enabled.toString());
    log.debug(`Auto-download series preference set to: ${enabled}`);
  }

  // ===========================================================================
  // NETWORK STATE
  // ===========================================================================

  /**
   * Get current connection type
   */
  getConnectionType(): ConnectionType {
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
   */
  subscribe(listener: NetworkChangeListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

// Singleton instance
export const networkMonitor = new NetworkMonitor();
