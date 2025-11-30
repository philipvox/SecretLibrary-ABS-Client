/**
 * src/core/native/haptics.ts
 *
 * Native haptic feedback service for tactile interactions.
 * Provides consistent haptic patterns across iOS and Android.
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

// ============================================================================
// HAPTIC FEEDBACK TYPES
// ============================================================================

export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
export type NotificationType = 'success' | 'warning' | 'error';

// ============================================================================
// HAPTIC SERVICE
// ============================================================================

class HapticService {
  private enabled = true;
  private isLoaded = false;

  /**
   * Initialize haptics (call early in app lifecycle)
   */
  async init(): Promise<void> {
    await loadHaptics();
    this.isLoaded = true;
  }

  /**
   * Enable or disable haptic feedback globally
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if haptics are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Trigger impact feedback (for UI interactions)
   */
  async impact(style: ImpactStyle = 'medium'): Promise<void> {
    if (!this.enabled) return;

    const haptics = await loadHaptics();
    if (!haptics) return;

    try {
      const impactStyle = this.mapImpactStyle(style);
      await haptics.impactAsync(impactStyle);
    } catch (e) {
      // Silently fail on unsupported devices
    }
  }

  /**
   * Trigger notification feedback (for system events)
   */
  async notification(type: NotificationType = 'success'): Promise<void> {
    if (!this.enabled) return;

    const haptics = await loadHaptics();
    if (!haptics) return;

    try {
      const notificationType = this.mapNotificationType(type);
      await haptics.notificationAsync(notificationType);
    } catch (e) {
      // Silently fail on unsupported devices
    }
  }

  /**
   * Trigger selection feedback (for picker/selection changes)
   */
  async selection(): Promise<void> {
    if (!this.enabled) return;

    const haptics = await loadHaptics();
    if (!haptics) return;

    try {
      await haptics.selectionAsync();
    } catch (e) {
      // Silently fail on unsupported devices
    }
  }

  // ============================================================================
  // PRESET PATTERNS
  // ============================================================================

  /**
   * Light tap for button press
   */
  async buttonPress(): Promise<void> {
    await this.impact('light');
  }

  /**
   * Medium tap for toggle/switch
   */
  async toggle(): Promise<void> {
    await this.impact('medium');
  }

  /**
   * Heavy tap for important actions
   */
  async importantAction(): Promise<void> {
    await this.impact('heavy');
  }

  /**
   * Success feedback
   */
  async success(): Promise<void> {
    await this.notification('success');
  }

  /**
   * Warning feedback
   */
  async warning(): Promise<void> {
    await this.notification('warning');
  }

  /**
   * Error feedback
   */
  async error(): Promise<void> {
    await this.notification('error');
  }

  /**
   * Seek feedback (for audio scrubbing)
   */
  async seek(): Promise<void> {
    await this.selection();
  }

  /**
   * Chapter change feedback
   */
  async chapterChange(): Promise<void> {
    await this.impact('soft');
  }

  /**
   * Playback state change (play/pause)
   */
  async playbackToggle(): Promise<void> {
    await this.impact('medium');
  }

  /**
   * Skip forward/backward
   */
  async skip(): Promise<void> {
    await this.impact('light');
  }

  /**
   * Long press feedback
   */
  async longPress(): Promise<void> {
    await this.impact('heavy');
  }

  /**
   * Pull to refresh trigger
   */
  async pullToRefresh(): Promise<void> {
    await this.impact('medium');
  }

  /**
   * Swipe action complete
   */
  async swipeComplete(): Promise<void> {
    await this.impact('soft');
  }

  /**
   * Download complete
   */
  async downloadComplete(): Promise<void> {
    await this.notification('success');
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private mapImpactStyle(style: ImpactStyle): any {
    // Map to expo-haptics ImpactFeedbackStyle
    const styles: Record<ImpactStyle, string> = {
      light: 'Light',
      medium: 'Medium',
      heavy: 'Heavy',
      soft: 'Soft',
      rigid: 'Rigid',
    };
    return styles[style] || 'Medium';
  }

  private mapNotificationType(type: NotificationType): any {
    // Map to expo-haptics NotificationFeedbackType
    const types: Record<NotificationType, string> = {
      success: 'Success',
      warning: 'Warning',
      error: 'Error',
    };
    return types[type] || 'Success';
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
  const buttonPress = useCallback(() => haptics.buttonPress(), []);
  const toggle = useCallback(() => haptics.toggle(), []);
  const importantAction = useCallback(() => haptics.importantAction(), []);
  const success = useCallback(() => haptics.success(), []);
  const warning = useCallback(() => haptics.warning(), []);
  const error = useCallback(() => haptics.error(), []);
  const selection = useCallback(() => haptics.selection(), []);
  const seek = useCallback(() => haptics.seek(), []);
  const skip = useCallback(() => haptics.skip(), []);
  const longPress = useCallback(() => haptics.longPress(), []);

  return {
    buttonPress,
    toggle,
    importantAction,
    success,
    warning,
    error,
    selection,
    seek,
    skip,
    longPress,
    // Direct access to service
    impact: haptics.impact.bind(haptics),
    notification: haptics.notification.bind(haptics),
  };
}
