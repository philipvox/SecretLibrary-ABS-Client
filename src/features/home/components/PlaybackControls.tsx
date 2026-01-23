/**
 * src/features/home/components/PlaybackControls.tsx
 *
 * Playback controls using Lucide icons
 * Order: Rewind | Fast Forward | Play
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { SkipBackIcon, SkipForwardIcon, PlayIcon, PauseIcon } from '@/shared/components';
import { haptics } from '@/core/native/haptics';
import {
  spacing,
  scale,
  layout,
  useTheme,
  accentColors,
} from '@/shared/theme';

interface PlaybackControlsProps {
  isPlaying: boolean;
  isLoading?: boolean;
  isBuffering?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSkipForward?: () => void;
  onSkipBackward?: () => void;
  onSkipForwardPressIn?: () => void;
  onSkipForwardPressOut?: () => void;
  onSkipBackwardPressIn?: () => void;
  onSkipBackwardPressOut?: () => void;
  disabled?: boolean;
}

export function PlaybackControls({
  isPlaying,
  isLoading = false,
  isBuffering = false,
  onPlay,
  onPause,
  onSkipForward,
  onSkipBackward,
  onSkipForwardPressIn,
  onSkipForwardPressOut,
  onSkipBackwardPressIn,
  onSkipBackwardPressOut,
  disabled = false,
}: PlaybackControlsProps) {
  const { colors } = useTheme();

  // NN/g: Haptic feedback for play/pause provides tactile confirmation
  const handlePlayPause = useCallback(() => {
    if (isLoading) return; // Don't allow play/pause while loading
    haptics.playbackToggle();
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [isLoading, isPlaying, onPause, onPlay]);

  // NN/g: Haptic feedback on skip button press
  const handleSkipBackward = useCallback(() => {
    haptics.skip();
    onSkipBackward?.();
  }, [onSkipBackward]);

  const handleSkipForward = useCallback(() => {
    haptics.skip();
    onSkipForward?.();
  }, [onSkipForward]);

  const handleSkipBackwardPressIn = useCallback(() => {
    haptics.buttonPress();
    onSkipBackwardPressIn?.();
  }, [onSkipBackwardPressIn]);

  const handleSkipForwardPressIn = useCallback(() => {
    haptics.buttonPress();
    onSkipForwardPressIn?.();
  }, [onSkipForwardPressIn]);

  const iconSize = scale(28);
  const playIconSize = scale(36);
  const controlsDisabled = disabled || isLoading;

  return (
    <View style={styles.container}>
      {/* Rewind */}
      <TouchableOpacity
        onPress={handleSkipBackward}
        onPressIn={handleSkipBackwardPressIn}
        onPressOut={onSkipBackwardPressOut}
        disabled={controlsDisabled}
        activeOpacity={0.7}
        style={[styles.button, controlsDisabled && styles.disabled]}
        accessibilityLabel="Skip backward"
        accessibilityRole="button"
        accessibilityHint="Double tap to skip back. Long press for continuous rewind."
      >
        <SkipBackIcon size={iconSize} color={controlsDisabled ? colors.text.tertiary : colors.text.primary} />
      </TouchableOpacity>

      {/* Fast Forward */}
      <TouchableOpacity
        onPress={handleSkipForward}
        onPressIn={handleSkipForwardPressIn}
        onPressOut={onSkipForwardPressOut}
        disabled={controlsDisabled}
        activeOpacity={0.7}
        style={[styles.button, controlsDisabled && styles.disabled]}
        accessibilityLabel="Skip forward"
        accessibilityRole="button"
        accessibilityHint="Double tap to skip forward. Long press for continuous fast forward."
      >
        <SkipForwardIcon size={iconSize} color={controlsDisabled ? colors.text.tertiary : colors.text.primary} />
      </TouchableOpacity>

      {/* Play/Pause - shows spinner when loading or buffering */}
      <TouchableOpacity
        onPress={handlePlayPause}
        disabled={controlsDisabled}
        activeOpacity={0.7}
        style={styles.playButton}
        accessibilityLabel={isLoading ? 'Loading' : isBuffering ? 'Buffering' : isPlaying ? 'Pause' : 'Play'}
        accessibilityRole="button"
        accessibilityState={{ disabled: controlsDisabled }}
      >
        {isLoading ? (
          <ActivityIndicator size={playIconSize} color={colors.accent.primary} />
        ) : isBuffering ? (
          <View style={styles.bufferingContainer}>
            <ActivityIndicator size={playIconSize * 1.2} color={colors.accent.primary} style={styles.bufferingSpinner} />
            {isPlaying ? (
              <PauseIcon size={playIconSize * 0.6} color={colors.accent.primary} />
            ) : (
              <PlayIcon size={playIconSize * 0.6} color={colors.accent.primary} />
            )}
          </View>
        ) : isPlaying ? (
          <PauseIcon size={playIconSize} color={colors.accent.primary} />
        ) : (
          <PlayIcon size={playIconSize} color={colors.accent.primary} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  // NN/g: Minimum 44×44px touch targets
  button: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    minWidth: 56,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  bufferingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingSpinner: {
    position: 'absolute',
  },
});
