/**
 * src/features/home/components/PlaybackControls.tsx
 *
 * Playback control buttons: Rewind | Forward | Play
 * Arranged left to right as per design
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GlassButton } from './GlassButton';
import { PlayTriangle, PauseIcon, SkipForwardIcon, SkipBackwardIcon } from './icons';
import { COLORS, DIMENSIONS } from '../homeDesign';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  disabled?: boolean;
}

export function PlaybackControls({
  isPlaying,
  onPlay,
  onPause,
  onSkipForward,
  onSkipBackward,
  disabled = false,
}: PlaybackControlsProps) {
  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  // Button sizes from design
  const smallButtonSize = DIMENSIONS.skipButtonSize;
  const playButtonSize = DIMENSIONS.playButtonSize;

  return (
    <View style={styles.container}>
      {/* Skip Backward (Rewind) - Left */}
      <GlassButton
        onPress={onSkipBackward}
        size={smallButtonSize}
        disabled={disabled}
      >
        <SkipBackwardIcon size={smallButtonSize * 0.5} color={COLORS.textPrimary} />
      </GlassButton>

      {/* Skip Forward - Middle */}
      <GlassButton
        onPress={onSkipForward}
        size={smallButtonSize}
        disabled={disabled}
      >
        <SkipForwardIcon size={smallButtonSize * 0.5} color={COLORS.textPrimary} />
      </GlassButton>

      {/* Play/Pause - Right (Larger, Lime) */}
      <GlassButton
        onPress={handlePlayPause}
        size={playButtonSize}
        isPlayButton
        disabled={disabled}
      >
        {isPlaying ? (
          <PauseIcon size={playButtonSize * 0.35} color={COLORS.playButton} />
        ) : (
          <PlayTriangle size={playButtonSize * 0.35} color={COLORS.playButton} />
        )}
      </GlassButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DIMENSIONS.controlButtonGap,
  },
});
