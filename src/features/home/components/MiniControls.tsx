/**
 * src/features/home/components/MiniControls.tsx
 *
 * Compact playback controls for Now Playing card
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '@/shared/components/Icon';
import { COLORS, NOW_PLAYING } from '../constants';
import { MiniControlsProps } from '../types';

export function MiniControls({
  isPlaying,
  onSkipBack,
  onSkipForward,
  onPlayPause,
}: MiniControlsProps) {
  return (
    <View style={styles.container}>
      {/* Skip Back */}
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onSkipBack}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="play-back" size={NOW_PLAYING.controlIconSize} color={COLORS.textPrimary} />
      </TouchableOpacity>

      {/* Skip Forward */}
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onSkipForward}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="play-forward" size={NOW_PLAYING.controlIconSize} color={COLORS.textPrimary} />
      </TouchableOpacity>

      {/* Play/Pause */}
      <TouchableOpacity
        style={styles.playButton}
        onPress={onPlayPause}
        activeOpacity={0.8}
      >
        <Icon
          name={isPlaying ? 'pause' : 'play'}
          size={NOW_PLAYING.playIconSize}
          color={COLORS.background}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: NOW_PLAYING.controlGap,
  },
  controlButton: {
    width: NOW_PLAYING.controlSize,
    height: NOW_PLAYING.controlSize,
    borderRadius: NOW_PLAYING.controlSize / 2,
    backgroundColor: COLORS.controlBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: NOW_PLAYING.playButtonSize,
    height: NOW_PLAYING.playButtonSize,
    borderRadius: NOW_PLAYING.playButtonSize / 2,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    // Offset the play icon slightly to the right for visual centering
    paddingLeft: 2,
  },
});
