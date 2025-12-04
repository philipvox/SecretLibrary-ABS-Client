/**
 * src/features/home/components/PlaybackControls.tsx
 *
 * Playback control buttons: Rewind | Forward | Play
 * Figma: 162px wide container, buttons ~52px
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { GlassButton } from './GlassButton';
import { PlayTriangle, PauseIcon, SkipForwardIcon, SkipBackwardIcon } from './icons';
import { COLORS } from '../homeDesign';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

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

  const buttonSize = scale(52);
  const gap = scale(2);

  return (
    <View style={[styles.container, { gap }]}>
      {/* Rewind */}
      <GlassButton
        onPress={onSkipBackward}
        size={buttonSize}
        disabled={disabled}
      >
        <SkipBackwardIcon size={buttonSize * 0.5} color={COLORS.textPrimary} />
      </GlassButton>

      {/* Fast Forward */}
      <GlassButton
        onPress={onSkipForward}
        size={buttonSize}
        disabled={disabled}
      >
        <SkipForwardIcon size={buttonSize * 0.5} color={COLORS.textPrimary} />
      </GlassButton>

      {/* Play/Pause */}
      <GlassButton
        onPress={handlePlayPause}
        size={buttonSize}
        isPlayButton
        disabled={disabled}
      >
        {isPlaying ? (
          <PauseIcon size={buttonSize * 0.35} color={COLORS.playButton} />
        ) : (
          <PlayTriangle size={buttonSize * 0.35} color={COLORS.playButton} />
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
  },
});
