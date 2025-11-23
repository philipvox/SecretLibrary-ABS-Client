/**
 * Playback controls - redesigned with proper icons
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

export function PlaybackControls() {
  const {
    isPlaying,
    isLoading,
    isBuffering,
    play,
    pause,
    skipBackward,
    skipForward,
  } = usePlayerStore();

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

  const handleSkipBackward = async () => {
    try {
      await skipBackward(30);
    } catch (error) {
      console.error('Failed to skip backward:', error);
    }
  };

  const handleSkipForward = async () => {
    try {
      await skipForward(30);
    } catch (error) {
      console.error('Failed to skip forward:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Skip Backward */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkipBackward}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Icon 
          name="play-back" 
          size={32} 
          color={theme.colors.text.primary}
          set="ionicons"
        />
      </TouchableOpacity>

      {/* Play/Pause */}
      <TouchableOpacity
        style={styles.playButton}
        onPress={handlePlayPause}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading || isBuffering ? (
          <ActivityIndicator size="large" color={theme.colors.text.inverse} />
        ) : (
          <Icon 
            name={isPlaying ? 'pause' : 'play'} 
            size={40} 
            color={theme.colors.text.inverse}
            set="ionicons"
          />
        )}
      </TouchableOpacity>

      {/* Skip Forward */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkipForward}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Icon 
          name="play-forward" 
          size={32} 
          color={theme.colors.text.primary}
          set="ionicons"
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
    paddingVertical: theme.spacing[8],
  },
  skipButton: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: theme.spacing[6],
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: theme.spacing[2],
    ...theme.elevation.medium,
  },
});