/**
 * src/shared/components/Snackbar.tsx
 *
 * Reusable snackbar/toast component with optional action button.
 * Follows NNGroup research on feedback and undo patterns.
 *
 * Features:
 * - Appears at bottom of screen above tab bar
 * - Auto-dismisses after configurable duration
 * - Optional action button (e.g., "Undo")
 * - Smooth slide-in/out animations
 * - Dark theme styling
 */

import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius, scale, useTheme, ThemeColors } from '@/shared/theme';
import { BOTTOM_NAV_HEIGHT, MINI_PLAYER_HEIGHT } from '@/constants/layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// TYPES
// ============================================================================

export interface SnackbarProps {
  /** Message to display */
  message: string;
  /** Whether snackbar is visible */
  visible: boolean;
  /** Auto-dismiss duration in ms (default: 4000) */
  duration?: number;
  /** Action button label (e.g., "Undo") */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Callback when snackbar is dismissed */
  onDismiss: () => void;
  /** Optional icon component */
  icon?: React.ReactNode;
  /** Type affects styling (default: 'info') */
  type?: 'info' | 'success' | 'warning' | 'error';
}

// ============================================================================
// COLORS
// ============================================================================

// Get snackbar colors based on theme
function getSnackbarColors(colors: ThemeColors) {
  return {
    info: {
      background: colors.background.elevated,
      border: colors.border.default,
      text: colors.text.primary,
      action: colors.accent.primary,
    },
    success: {
      background: `${colors.status.success}25`,
      border: `${colors.status.success}50`,
      text: colors.text.primary,
      action: colors.status.success,
    },
    warning: {
      background: `${colors.status.warning}25`,
      border: `${colors.status.warning}50`,
      text: colors.text.primary,
      action: colors.status.warning,
    },
    error: {
      background: `${colors.status.error}25`,
      border: `${colors.status.error}50`,
      text: colors.text.primary,
      action: colors.status.error,
    },
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Snackbar({
  message,
  visible,
  duration = 4000,
  actionLabel,
  onAction,
  onDismiss,
  icon,
  type = 'info',
}: SnackbarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);
  // Track when snackbar is fully hidden (avoids reading .value during render)
  const [isHidden, setIsHidden] = useState(!visible);

  const snackbarColors = getSnackbarColors(colors);
  const typeColors = snackbarColors[type];

  // Calculate bottom position (above tab bar + mini player)
  const bottomOffset = insets.bottom + BOTTOM_NAV_HEIGHT + MINI_PLAYER_HEIGHT + spacing.md;

  // Animation handlers
  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  // Callback to mark snackbar as hidden (called from worklet via runOnJS)
  const markHidden = useCallback(() => {
    setIsHidden(true);
  }, []);

  // Show/hide animation
  useEffect(() => {
    if (visible) {
      // Mark as not hidden immediately when showing
      setIsHidden(false);
      // Slide in
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });

      // Auto-dismiss after duration
      if (duration > 0) {
        translateY.value = withDelay(
          duration,
          withTiming(100, { duration: 200 }, (finished) => {
            if (finished) {
              runOnJS(handleDismiss)();
            }
          })
        );
        opacity.value = withDelay(
          duration,
          withTiming(0, { duration: 200 })
        );
      }
    } else {
      // Slide out and mark hidden when complete
      translateY.value = withTiming(100, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(markHidden)();
        }
      });
    }
  }, [visible, duration, handleDismiss, markHidden]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleActionPress = useCallback(() => {
    onAction?.();
    onDismiss();
  }, [onAction, onDismiss]);

  // Don't render when fully hidden (using React state, not shared value)
  // Return empty View on Android to prevent SafeAreaProvider crash
  if (!visible && isHidden) {
    return Platform.OS === 'android' ? <View /> : null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: bottomOffset },
        { backgroundColor: typeColors.background, borderColor: typeColors.border },
        animatedStyle,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {/* Icon */}
      {icon && <View style={styles.iconContainer}>{icon}</View>}

      {/* Message */}
      <Text style={[styles.message, { color: typeColors.text }]} numberOfLines={2}>
        {message}
      </Text>

      {/* Action button */}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleActionPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.actionText, { color: typeColors.action }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ============================================================================
// SNACKBAR MANAGER HOOK
// ============================================================================

interface SnackbarState {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

const initialState: SnackbarState = {
  visible: false,
  message: '',
};

/**
 * Hook to manage snackbar state
 */
export function useSnackbar() {
  const [state, setState] = React.useState<SnackbarState>(initialState);

  const show = useCallback((options: Omit<SnackbarState, 'visible'>) => {
    setState({
      ...options,
      visible: true,
    });
  }, []);

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const showUndo = useCallback((message: string, onUndo: () => void, duration = 5000) => {
    show({
      message,
      actionLabel: 'Undo',
      onAction: onUndo,
      duration,
      type: 'info',
    });
  }, [show]);

  const showSuccess = useCallback((message: string, duration = 3000) => {
    show({
      message,
      duration,
      type: 'success',
    });
  }, [show]);

  const showError = useCallback((message: string, duration = 4000) => {
    show({
      message,
      duration,
      type: 'error',
    });
  }, [show]);

  return {
    state,
    show,
    hide,
    showUndo,
    showSuccess,
    showError,
    snackbarProps: {
      ...state,
      onDismiss: hide,
    },
  };
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: scale(48),
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: scale(14),
    fontWeight: '500',
    lineHeight: scale(20),
  },
  actionButton: {
    marginLeft: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    fontSize: scale(14),
    fontWeight: '600',
  },
});

export default Snackbar;
