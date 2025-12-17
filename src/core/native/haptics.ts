/**
 * src/core/native/haptics.ts
 *
 * Native haptic feedback service for tactile interactions.
 * Provides consistent haptic patterns across iOS and Android.
 * Integrates with haptic settings store for user preferences.
 */

import { Platform } from 'react-native';

// Lazy import to avoid crashes if expo-haptics isn't installed
let Haptics: typeof import('expo-haptics') | null = null;

async function loadHaptics() {
  if (Haptics === null) {
    try {
      Haptics = await import('expo-haptics');
    } catch (e) {
      console.warn('[Haptics] expo-haptics not available');
      Haptics = null;
    }
  }
  return Haptics;
}

// Lazy import of settings store to avoid circular dependencies
let getHapticSettings: (() => {
  enabled: boolean;
  playbackControls: boolean;
  scrubberFeedback: boolean;
  speedControl: boolean;
  sleepTimer: boolean;
  downloads: boolean;
  bookmarks: boolean;
  completions: boolean;
  uiInteractions: boolean;
}) | null = null;

function loadSettingsStore() {
  if (getHapticSettings === null) {
    try {
      const { useHapticSettingsStore } = require('@/features/profile/stores/hapticSettingsStore');
      getHapticSettings = () => useHapticSettingsStore.getState();
    } catch (e) {
      // Store not available yet, use defaults
      getHapticSettings = () => ({
        enabled: true,
        playbackControls: true,
        scrubberFeedback: true,
        speedControl: true,
        sleepTimer: true,
        downloads: true,
        bookmarks: true,
        completions: true,
        uiInteractions: true,
      });
    }
  }
  return getHapticSettings();
}

// ============================================================================
// HAPTIC FEEDBACK TYPES
// ============================================================================

export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
export type NotificationType = 'success' | 'warning' | 'error';
export type HapticCategory =
  | 'playbackControls'
  | 'scrubberFeedback'
  | 'speedControl'
  | 'sleepTimer'
  | 'downloads'
  | 'bookmarks'
  | 'completions'
  | 'uiInteractions';

// ============================================================================
// HAPTIC SERVICE
// ============================================================================

class HapticService {
  private isLoaded = false;

  /**
   * Initialize haptics (call early in app lifecycle)
   */
  async init(): Promise<void> {
    await loadHaptics();
    this.isLoaded = true;
  }

  /**
   * Check if haptics are globally enabled
   */
  isEnabled(): boolean {
    return loadSettingsStore().enabled;
  }

  /**
   * Check if a specific category is enabled
   */
  isCategoryEnabled(category: HapticCategory): boolean {
    const settings = loadSettingsStore();
    return settings.enabled && settings[category];
  }

  /**
   * Helper delay function for custom patterns
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // CORE FEEDBACK METHODS
  // ============================================================================

  /**
   * Trigger impact feedback (for UI interactions)
   * Uses same approach as mood-discovery which works on Android
   */
  async impact(style: ImpactStyle = 'medium'): Promise<void> {
    if (!loadSettingsStore().enabled) return;

    const haptics = await loadHaptics();
    if (!haptics) return;

    try {
      // Use actual enum values like mood-discovery does
      const impactStyle = this.getImpactStyle(haptics, style);
      await haptics.impactAsync(impactStyle);
    } catch (e) {
      // Silently fail on unsupported devices
    }
  }

  /**
   * Trigger notification feedback (for system events)
   */
  async notification(type: NotificationType = 'success'): Promise<void> {
    if (!loadSettingsStore().enabled) return;

    const haptics = await loadHaptics();
    if (!haptics) return;

    try {
      // Use actual enum values
      const notificationType = this.getNotificationType(haptics, type);
      await haptics.notificationAsync(notificationType);
    } catch (e) {
      // Silently fail on unsupported devices
    }
  }

  /**
   * Trigger selection feedback (for picker/selection changes)
   */
  async selection(): Promise<void> {
    if (!loadSettingsStore().enabled) return;

    const haptics = await loadHaptics();
    if (!haptics) return;

    try {
      await haptics.selectionAsync();
    } catch (e) {
      // Silently fail on unsupported devices
    }
  }

  // ============================================================================
  // PLAYBACK CONTROL HAPTICS
  // ============================================================================

  /**
   * Playback state change (play/pause)
   */
  async playbackToggle(): Promise<void> {
    if (!this.isCategoryEnabled('playbackControls')) return;
    await this.impact('medium');
  }

  /**
   * Skip forward/backward
   */
  async skip(): Promise<void> {
    if (!this.isCategoryEnabled('playbackControls')) return;
    await this.impact('light');
  }

  /**
   * Chapter change feedback
   */
  async chapterChange(): Promise<void> {
    if (!this.isCategoryEnabled('playbackControls')) return;
    await this.impact('soft');
  }

  // ============================================================================
  // SCRUBBER/TIMELINE HAPTICS
  // ============================================================================

  /**
   * Seek feedback (for audio scrubbing)
   */
  async seek(): Promise<void> {
    if (!this.isCategoryEnabled('scrubberFeedback')) return;
    await this.selection();
  }

  /**
   * Chapter marker crossed during scrubbing
   */
  async chapterMarker(): Promise<void> {
    if (!this.isCategoryEnabled('scrubberFeedback')) return;
    await this.impact('light');
  }

  /**
   * Snapped to chapter during scrubbing
   */
  async chapterSnap(): Promise<void> {
    if (!this.isCategoryEnabled('scrubberFeedback')) return;
    await this.impact('medium');
  }

  // ============================================================================
  // SPEED CONTROL HAPTICS
  // ============================================================================

  /**
   * Speed value changed
   */
  async speedChange(): Promise<void> {
    if (!this.isCategoryEnabled('speedControl')) return;
    await this.selection();
  }

  /**
   * Reached speed boundary (min or max)
   */
  async speedBoundary(): Promise<void> {
    if (!this.isCategoryEnabled('speedControl')) return;
    await this.impact('medium');
    await this.delay(50);
    await this.impact('light');
  }

  /**
   * Reached default speed (1.0x)
   */
  async speedDefault(): Promise<void> {
    if (!this.isCategoryEnabled('speedControl')) return;
    await this.impact('light');
  }

  // ============================================================================
  // SLEEP TIMER HAPTICS
  // ============================================================================

  /**
   * Sleep timer set
   */
  async sleepTimerSet(): Promise<void> {
    if (!this.isCategoryEnabled('sleepTimer')) return;
    await this.notification('success');
  }

  /**
   * Sleep timer cleared
   */
  async sleepTimerClear(): Promise<void> {
    if (!this.isCategoryEnabled('sleepTimer')) return;
    await this.impact('light');
  }

  /**
   * Sleep timer warning (1 minute remaining)
   */
  async sleepTimerWarning(): Promise<void> {
    if (!this.isCategoryEnabled('sleepTimer')) return;
    await this.notification('warning');
  }

  /**
   * Sleep timer expired
   */
  async sleepTimerExpired(): Promise<void> {
    if (!this.isCategoryEnabled('sleepTimer')) return;
    await this.notification('warning');
  }

  // ============================================================================
  // DOWNLOAD HAPTICS
  // ============================================================================

  /**
   * Download started
   */
  async downloadStart(): Promise<void> {
    if (!this.isCategoryEnabled('downloads')) return;
    await this.impact('light');
  }

  /**
   * Download complete
   */
  async downloadComplete(): Promise<void> {
    if (!this.isCategoryEnabled('downloads')) return;
    await this.notification('success');
  }

  /**
   * Download failed
   */
  async downloadFailed(): Promise<void> {
    if (!this.isCategoryEnabled('downloads')) return;
    await this.notification('error');
  }

  // ============================================================================
  // BOOKMARK HAPTICS
  // ============================================================================

  /**
   * Bookmark created
   */
  async bookmarkCreated(): Promise<void> {
    if (!this.isCategoryEnabled('bookmarks')) return;
    await this.notification('success');
  }

  /**
   * Bookmark deleted
   */
  async bookmarkDeleted(): Promise<void> {
    if (!this.isCategoryEnabled('bookmarks')) return;
    await this.impact('light');
  }

  /**
   * Jumped to bookmark
   */
  async bookmarkJump(): Promise<void> {
    if (!this.isCategoryEnabled('bookmarks')) return;
    await this.selection();
  }

  // ============================================================================
  // COMPLETION CELEBRATION HAPTICS
  // ============================================================================

  /**
   * Book completion celebration
   */
  async bookComplete(): Promise<void> {
    if (!this.isCategoryEnabled('completions')) return;
    await this.notification('success');
    await this.delay(100);
    await this.impact('light');
  }

  /**
   * Series completion celebration (stronger pattern)
   */
  async seriesComplete(): Promise<void> {
    if (!this.isCategoryEnabled('completions')) return;
    await this.notification('success');
    await this.delay(150);
    await this.impact('medium');
    await this.delay(100);
    await this.impact('light');
  }

  /**
   * Progress milestone (25%, 50%, 75%)
   */
  async progressMilestone(): Promise<void> {
    if (!this.isCategoryEnabled('completions')) return;
    await this.impact('light');
  }

  // ============================================================================
  // UI INTERACTION HAPTICS
  // ============================================================================

  /**
   * Light tap for button press
   */
  async buttonPress(): Promise<void> {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    await this.impact('light');
  }

  /**
   * Medium tap for toggle/switch
   */
  async toggle(): Promise<void> {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    await this.impact('medium');
  }

  /**
   * Heavy tap for important actions
   */
  async importantAction(): Promise<void> {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    await this.impact('heavy');
  }

  /**
   * Long press feedback
   */
  async longPress(): Promise<void> {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    await this.impact('heavy');
  }

  /**
   * Pull to refresh trigger
   */
  async pullToRefresh(): Promise<void> {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    await this.impact('medium');
  }

  /**
   * Swipe action complete
   */
  async swipeComplete(): Promise<void> {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    await this.impact('soft');
  }

  /**
   * Success feedback (generic)
   */
  async success(): Promise<void> {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    await this.notification('success');
  }

  /**
   * Warning feedback (generic)
   */
  async warning(): Promise<void> {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    await this.notification('warning');
  }

  /**
   * Error feedback (generic)
   */
  async error(): Promise<void> {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    await this.notification('error');
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Get the actual ImpactFeedbackStyle enum value from the haptics module
   * This matches how mood-discovery does it: Haptics.ImpactFeedbackStyle.Light
   */
  private getImpactStyle(haptics: typeof import('expo-haptics'), style: ImpactStyle): any {
    switch (style) {
      case 'light':
        return haptics.ImpactFeedbackStyle.Light;
      case 'medium':
        return haptics.ImpactFeedbackStyle.Medium;
      case 'heavy':
        return haptics.ImpactFeedbackStyle.Heavy;
      case 'soft':
        return haptics.ImpactFeedbackStyle.Soft;
      case 'rigid':
        return haptics.ImpactFeedbackStyle.Rigid;
      default:
        return haptics.ImpactFeedbackStyle.Medium;
    }
  }

  /**
   * Get the actual NotificationFeedbackType enum value from the haptics module
   */
  private getNotificationType(haptics: typeof import('expo-haptics'), type: NotificationType): any {
    switch (type) {
      case 'success':
        return haptics.NotificationFeedbackType.Success;
      case 'warning':
        return haptics.NotificationFeedbackType.Warning;
      case 'error':
        return haptics.NotificationFeedbackType.Error;
      default:
        return haptics.NotificationFeedbackType.Success;
    }
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const haptics = new HapticService();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useCallback } from 'react';

/**
 * Hook for haptic feedback in components
 */
export function useHaptics() {
  // UI Interactions
  const buttonPress = useCallback(() => haptics.buttonPress(), []);
  const toggle = useCallback(() => haptics.toggle(), []);
  const importantAction = useCallback(() => haptics.importantAction(), []);
  const longPress = useCallback(() => haptics.longPress(), []);

  // Generic feedback
  const success = useCallback(() => haptics.success(), []);
  const warning = useCallback(() => haptics.warning(), []);
  const error = useCallback(() => haptics.error(), []);
  const selection = useCallback(() => haptics.selection(), []);

  // Playback
  const playbackToggle = useCallback(() => haptics.playbackToggle(), []);
  const skip = useCallback(() => haptics.skip(), []);
  const chapterChange = useCallback(() => haptics.chapterChange(), []);

  // Scrubbing
  const seek = useCallback(() => haptics.seek(), []);
  const chapterMarker = useCallback(() => haptics.chapterMarker(), []);
  const chapterSnap = useCallback(() => haptics.chapterSnap(), []);

  // Speed
  const speedChange = useCallback(() => haptics.speedChange(), []);
  const speedBoundary = useCallback(() => haptics.speedBoundary(), []);
  const speedDefault = useCallback(() => haptics.speedDefault(), []);

  // Sleep timer
  const sleepTimerSet = useCallback(() => haptics.sleepTimerSet(), []);
  const sleepTimerClear = useCallback(() => haptics.sleepTimerClear(), []);
  const sleepTimerWarning = useCallback(() => haptics.sleepTimerWarning(), []);

  // Downloads
  const downloadStart = useCallback(() => haptics.downloadStart(), []);
  const downloadComplete = useCallback(() => haptics.downloadComplete(), []);
  const downloadFailed = useCallback(() => haptics.downloadFailed(), []);

  // Bookmarks
  const bookmarkCreated = useCallback(() => haptics.bookmarkCreated(), []);
  const bookmarkDeleted = useCallback(() => haptics.bookmarkDeleted(), []);
  const bookmarkJump = useCallback(() => haptics.bookmarkJump(), []);

  // Completions
  const bookComplete = useCallback(() => haptics.bookComplete(), []);
  const seriesComplete = useCallback(() => haptics.seriesComplete(), []);
  const progressMilestone = useCallback(() => haptics.progressMilestone(), []);

  return {
    // UI Interactions
    buttonPress,
    toggle,
    importantAction,
    longPress,

    // Generic feedback
    success,
    warning,
    error,
    selection,

    // Playback
    playbackToggle,
    skip,
    chapterChange,

    // Scrubbing
    seek,
    chapterMarker,
    chapterSnap,

    // Speed
    speedChange,
    speedBoundary,
    speedDefault,

    // Sleep timer
    sleepTimerSet,
    sleepTimerClear,
    sleepTimerWarning,

    // Downloads
    downloadStart,
    downloadComplete,
    downloadFailed,

    // Bookmarks
    bookmarkCreated,
    bookmarkDeleted,
    bookmarkJump,

    // Completions
    bookComplete,
    seriesComplete,
    progressMilestone,

    // Direct access to service
    impact: haptics.impact.bind(haptics),
    notification: haptics.notification.bind(haptics),
  };
}
