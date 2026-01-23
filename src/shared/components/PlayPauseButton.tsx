/**
 * src/shared/components/PlayPauseButton.tsx
 *
 * Unified play/pause button component for consistent design across the app.
 * Features:
 * - Filled icons (not stroked) for both play and pause
 * - Size variants: sm, md, lg, xl
 * - Color variants: primary, secondary, overlay, ghost
 * - Toggle between play/pause based on isPlaying prop
 * - Theme-aware colors
 * - Loading state support
 * - Accessibility labels
 * - Haptic feedback
 */

import React, { useCallback, useMemo } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  View,
} from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import { haptics } from '@/core/native/haptics';
import { scale, accentColors, useTheme, useIsDarkMode } from '@/shared/theme';

// Size definitions (diameter in pt)
const SIZES = {
  sm: 32,   // Mini player, compact lists
  md: 40,   // List rows, cards
  lg: 52,   // Hero cards
  xl: 56,   // Full player controls
} as const;

// Icon size relative to button size (approximately 45%)
const ICON_SIZE_RATIO = 0.45;

export type PlayPauseButtonSize = keyof typeof SIZES;
export type PlayPauseButtonVariant = 'primary' | 'secondary' | 'overlay' | 'ghost';

export interface PlayPauseButtonProps {
  /** Whether content is currently playing */
  isPlaying: boolean;
  /** Called when button is pressed */
  onPress: () => void;
  /** Visual variant */
  variant?: PlayPauseButtonVariant;
  /** Size variant */
  size?: PlayPauseButtonSize;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Whether to show loading spinner instead of icon (initial load) */
  loading?: boolean;
  /** Whether audio is buffering (streaming stall) - shows spinner with play/pause */
  isBuffering?: boolean;
  /** Accessibility label override */
  accessibilityLabel?: string;
  /** Additional styles for the container */
  style?: StyleProp<ViewStyle>;
  /** Whether to trigger haptic feedback (default: true) */
  hapticFeedback?: boolean;
}

/**
 * Unified play/pause button with consistent styling
 */
export function PlayPauseButton({
  isPlaying,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  isBuffering = false,
  accessibilityLabel,
  style,
  hapticFeedback = true,
}: PlayPauseButtonProps) {
  const { colors } = useTheme();
  const isDark = useIsDarkMode();

  // Get button dimensions
  const buttonSize = scale(SIZES[size]);
  const iconSize = Math.round(buttonSize * ICON_SIZE_RATIO);
  const borderRadius = buttonSize / 2;

  // Get colors based on variant
  const { background, iconColor } = useMemo(() => {
    switch (variant) {
      case 'primary':
        // Accent background with contrasting icon
        return {
          background: colors.accent.primary,
          iconColor: colors.accent.textOnAccent,
        };
      case 'secondary':
        // Theme surface background with theme text icon
        return {
          background: colors.background.elevated,
          iconColor: colors.text.primary,
        };
      case 'overlay':
        // Semi-transparent background with contrasting icon
        return {
          background: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)',
          iconColor: colors.text.inverse,
        };
      case 'ghost':
        // No background, just icon using theme color
        return {
          background: 'transparent',
          iconColor: colors.text.primary,
        };
      default:
        return {
          background: colors.accent.primary,
          iconColor: colors.accent.textOnAccent,
        };
    }
  }, [variant, colors, isDark]);

  // Handle press with haptic feedback
  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (hapticFeedback) {
      haptics.playbackToggle();
    }
    onPress();
  }, [disabled, loading, hapticFeedback, onPress]);

  // Generate accessibility label
  const label = accessibilityLabel ||
    (loading ? 'Loading' : isBuffering ? 'Buffering' : isPlaying ? 'Pause' : 'Play');

  // Smaller icon when buffering to make room for spinner
  const bufferingIconSize = Math.round(iconSize * 0.7);

  // Button container styles
  const buttonStyles = useMemo<StyleProp<ViewStyle>>(() => [
    styles.button,
    {
      width: buttonSize,
      height: buttonSize,
      borderRadius,
      backgroundColor: background,
    },
    variant === 'ghost' ? styles.ghostButton : null,
    disabled ? styles.disabled : null,
    style,
  ], [buttonSize, borderRadius, background, variant, disabled, style]);

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {loading ? (
        <ActivityIndicator size={iconSize} color={iconColor} />
      ) : isBuffering ? (
        // Buffering: show spinner around smaller play/pause icon
        <View style={styles.bufferingContainer}>
          <ActivityIndicator
            size={buttonSize * 0.85}
            color={iconColor}
            style={styles.bufferingSpinner}
          />
          {isPlaying ? (
            <Pause
              size={bufferingIconSize}
              color={iconColor}
              fill={iconColor}
              strokeWidth={0}
            />
          ) : (
            <Play
              size={bufferingIconSize}
              color={iconColor}
              fill={iconColor}
              strokeWidth={0}
              style={{ marginLeft: scale(1) }}
            />
          )}
        </View>
      ) : isPlaying ? (
        <Pause
          size={iconSize}
          color={iconColor}
          fill={iconColor}
          strokeWidth={0}
        />
      ) : (
        <Play
          size={iconSize}
          color={iconColor}
          fill={iconColor}
          strokeWidth={0}
          style={styles.playIconOffset}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for elevated variants
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  ghostButton: {
    // Remove shadow for ghost variant
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  // Slight offset to visually center play triangle (optical centering)
  playIconOffset: {
    marginLeft: scale(2),
  },
  // Buffering state: spinner around icon
  bufferingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingSpinner: {
    position: 'absolute',
  },
});

export default PlayPauseButton;
