/**
 * src/core/native/haptics.ts
 *
 * Native haptic feedback service for tactile interactions.
 * Provides consistent haptic patterns across iOS and Android.
 * Integrates with haptic settings store for user preferences.
 *
 * Uses static import like MoodDiscoveryScreen (which works) instead of
 * dynamic import which can have timing/resolution issues in React Native.
 */

import * as ExpoHaptics from 'expo-haptics';

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
    const result = settings.enabled && settings[category];
    console.log('[Haptics] isCategoryEnabled:', { category, enabled: settings.enabled, categoryValue: settings[category], result });
    return result;
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
   * Uses static import like MoodDiscoveryScreen which works correctly
   */
  impact(style: ImpactStyle = 'medium'): void {
    const settings = loadSettingsStore();
    console.log('[Haptics] impact called:', { style, enabled: settings.enabled });

    if (!settings.enabled) {
      console.log('[Haptics] Blocked - haptics disabled in settings');
      return;
    }

    try {
      const impactStyle = this.getImpactStyle(style);
      console.log('[Haptics] Firing impactAsync with style:', impactStyle);
      ExpoHaptics.impactAsync(impactStyle).catch((e) => {
        console.warn('[Haptics] impactAsync failed:', e);
      });
    } catch (e) {
      console.warn('[Haptics] impact error:', e);
    }
  }

  /**
   * Trigger notification feedback (for system events)
   */
  notification(type: NotificationType = 'success'): void {
    if (!loadSettingsStore().enabled) return;

    try {
      const notificationType = this.getNotificationType(type);
      ExpoHaptics.notificationAsync(notificationType).catch(() => {});
    } catch (e) {
      // Silently fail on unsupported devices
    }
  }

  /**
   * Trigger selection feedback (for picker/selection changes)
   */
  selection(): void {
    const settings = loadSettingsStore();
    console.log('[Haptics] selection called:', { enabled: settings.enabled });

    if (!settings.enabled) {
      console.log('[Haptics] Blocked - haptics disabled in settings');
      return;
    }

    try {
      console.log('[Haptics] Firing selectionAsync');
      ExpoHaptics.selectionAsync().catch((e) => {
        console.warn('[Haptics] selectionAsync failed:', e);
      });
    } catch (e) {
      console.warn('[Haptics] selection error:', e);
    }
  }

  // ============================================================================
  // PLAYBACK CONTROL HAPTICS
  // ============================================================================

  /**
   * Playback state change (play/pause)
   */
  playbackToggle(): void {
    if (!this.isCategoryEnabled('playbackControls')) return;
    this.impact('medium');
  }

  /**
   * Skip forward/backward
   */
  skip(): void {
    if (!this.isCategoryEnabled('playbackControls')) return;
    this.impact('light');
  }

  /**
   * Chapter change feedback
   */
  chapterChange(): void {
    if (!this.isCategoryEnabled('playbackControls')) return;
    this.impact('soft');
  }

  // ============================================================================
  // SCRUBBER/TIMELINE HAPTICS
  // ============================================================================

  /**
   * Seek feedback (for audio scrubbing)
   */
  seek(): void {
    if (!this.isCategoryEnabled('scrubberFeedback')) return;
    this.selection();
  }

  /**
   * Chapter marker crossed during scrubbing
   */
  chapterMarker(): void {
    if (!this.isCategoryEnabled('scrubberFeedback')) return;
    this.impact('light');
  }

  /**
   * Snapped to chapter during scrubbing
   */
  chapterSnap(): void {
    if (!this.isCategoryEnabled('scrubberFeedback')) return;
    this.impact('medium');
  }

  // ============================================================================
  // SPEED CONTROL HAPTICS
  // ============================================================================

  /**
   * Speed value changed
   */
  speedChange(): void {
    if (!this.isCategoryEnabled('speedControl')) return;
    this.selection();
  }

  /**
   * Reached speed boundary (min or max)
   */
  speedBoundary(): void {
    if (!this.isCategoryEnabled('speedControl')) return;
    this.impact('medium');
    setTimeout(() => this.impact('light'), 50);
  }

  /**
   * Reached default speed (1.0x)
   */
  speedDefault(): void {
    if (!this.isCategoryEnabled('speedControl')) return;
    this.impact('light');
  }

  // ============================================================================
  // SLEEP TIMER HAPTICS
  // ============================================================================

  /**
   * Sleep timer set
   */
  sleepTimerSet(): void {
    if (!this.isCategoryEnabled('sleepTimer')) return;
    this.notification('success');
  }

  /**
   * Sleep timer cleared
   */
  sleepTimerClear(): void {
    if (!this.isCategoryEnabled('sleepTimer')) return;
    this.impact('light');
  }

  /**
   * Sleep timer warning (1 minute remaining)
   */
  sleepTimerWarning(): void {
    if (!this.isCategoryEnabled('sleepTimer')) return;
    this.notification('warning');
  }

  /**
   * Sleep timer expired
   */
  sleepTimerExpired(): void {
    if (!this.isCategoryEnabled('sleepTimer')) return;
    this.notification('warning');
  }

  // ============================================================================
  // DOWNLOAD HAPTICS
  // ============================================================================

  /**
   * Download started
   */
  downloadStart(): void {
    if (!this.isCategoryEnabled('downloads')) return;
    this.impact('light');
  }

  /**
   * Download complete
   */
  downloadComplete(): void {
    if (!this.isCategoryEnabled('downloads')) return;
    this.notification('success');
  }

  /**
   * Download failed
   */
  downloadFailed(): void {
    if (!this.isCategoryEnabled('downloads')) return;
    this.notification('error');
  }

  // ============================================================================
  // BOOKMARK HAPTICS
  // ============================================================================

  /**
   * Bookmark created
   */
  bookmarkCreated(): void {
    if (!this.isCategoryEnabled('bookmarks')) return;
    this.notification('success');
  }

  /**
   * Bookmark deleted
   */
  bookmarkDeleted(): void {
    if (!this.isCategoryEnabled('bookmarks')) return;
    this.impact('light');
  }

  /**
   * Jumped to bookmark
   */
  bookmarkJump(): void {
    if (!this.isCategoryEnabled('bookmarks')) return;
    this.selection();
  }

  // ============================================================================
  // COMPLETION CELEBRATION HAPTICS
  // ============================================================================

  /**
   * Book completion celebration
   */
  bookComplete(): void {
    if (!this.isCategoryEnabled('completions')) return;
    this.notification('success');
    setTimeout(() => this.impact('light'), 100);
  }

  /**
   * Series completion celebration (stronger pattern)
   */
  seriesComplete(): void {
    if (!this.isCategoryEnabled('completions')) return;
    this.notification('success');
    setTimeout(() => {
      this.impact('medium');
      setTimeout(() => this.impact('light'), 100);
    }, 150);
  }

  /**
   * Progress milestone (25%, 50%, 75%)
   */
  progressMilestone(): void {
    if (!this.isCategoryEnabled('completions')) return;
    this.impact('light');
  }

  // ============================================================================
  // UI INTERACTION HAPTICS
  // ============================================================================

  /**
   * Light tap for button press
   */
  buttonPress(): void {
    console.log('[Haptics] buttonPress called, uiInteractions enabled:', this.isCategoryEnabled('uiInteractions'));
    if (!this.isCategoryEnabled('uiInteractions')) return;
    this.impact('light');
  }

  /**
   * Medium tap for toggle/switch
   */
  toggle(): void {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    this.impact('medium');
  }

  /**
   * Heavy tap for important actions
   */
  importantAction(): void {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    this.impact('heavy');
  }

  /**
   * Long press feedback
   */
  longPress(): void {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    this.impact('heavy');
  }

  /**
   * Pull to refresh trigger
   */
  pullToRefresh(): void {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    this.impact('medium');
  }

  /**
   * Swipe action complete
   */
  swipeComplete(): void {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    this.impact('soft');
  }

  /**
   * Success feedback (generic)
   */
  success(): void {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    this.notification('success');
  }

  /**
   * Warning feedback (generic)
   */
  warning(): void {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    this.notification('warning');
  }

  /**
   * Error feedback (generic)
   */
  error(): void {
    if (!this.isCategoryEnabled('uiInteractions')) return;
    this.notification('error');
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Get the ImpactFeedbackStyle enum value
   */
  private getImpactStyle(style: ImpactStyle): ExpoHaptics.ImpactFeedbackStyle {
    switch (style) {
      case 'light':
        return ExpoHaptics.ImpactFeedbackStyle.Light;
      case 'medium':
        return ExpoHaptics.ImpactFeedbackStyle.Medium;
      case 'heavy':
        return ExpoHaptics.ImpactFeedbackStyle.Heavy;
      case 'soft':
        return ExpoHaptics.ImpactFeedbackStyle.Soft;
      case 'rigid':
        return ExpoHaptics.ImpactFeedbackStyle.Rigid;
      default:
        return ExpoHaptics.ImpactFeedbackStyle.Medium;
    }
  }

  /**
   * Get the NotificationFeedbackType enum value
   */
  private getNotificationType(type: NotificationType): ExpoHaptics.NotificationFeedbackType {
    switch (type) {
      case 'success':
        return ExpoHaptics.NotificationFeedbackType.Success;
      case 'warning':
        return ExpoHaptics.NotificationFeedbackType.Warning;
      case 'error':
        return ExpoHaptics.NotificationFeedbackType.Error;
      default:
        return ExpoHaptics.NotificationFeedbackType.Success;
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
