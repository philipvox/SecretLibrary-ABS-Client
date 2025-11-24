// File: src/features/player/components/PlaybackControls.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

interface PlaybackControlsProps {
  buttonColor?: string;
  iconColor?: string;
  skipColor?: string;
}

export function PlaybackControls({
  buttonColor = theme.colors.neutral[0],
  iconColor = theme.colors.text.primary,
  skipColor = theme.colors.neutral[400],
}: PlaybackControlsProps) {
  const { isPlaying, isLoading, isBuffering, play, pause, skipBackward, skipForward } = usePlayerStore();

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await pause();
      } else {
        await play();
      }
    } catch (error) {
      console.error('Failed to toggle playback:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => skipBackward(30)}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Icon name="play-back" size={32} color={skipColor} set="ionicons" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.playButton, { backgroundColor: buttonColor }]}
        onPress={handlePlayPause}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading || isBuffering ? (
          <ActivityIndicator size="large" color={iconColor} />
        ) : (
          <Icon
            name={isPlaying ? 'pause' : 'play'}
            size={40}
            color={iconColor}
            set="ionicons"
          />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => skipForward(30)}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Icon name="play-forward" size={32} color={skipColor} set="ionicons" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[4],
  },
  skipButton: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: theme.spacing[6],
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.elevation.large,
  },
});