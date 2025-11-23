/**
 * src/features/player/components/PlaybackControls.tsx
 *
 * Playback control buttons: skip back 30s, play/pause, skip forward 30s.
 * Used in the full player screen.
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';

/**
 * Playback controls component
 */
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

  /**
   * Handle play/pause toggle
   */
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

  /**
   * Handle skip backward
   */
  const handleSkipBackward = async () => {
    try {
      await skipBackward(30);
    } catch (error) {
      console.error('Failed to skip backward:', error);
    }
  };

  /**
   * Handle skip forward
   */
  const handleSkipForward = async () => {
    try {
      await skipForward(30);
    } catch (error) {
      console.error('Failed to skip forward:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Skip Backward 30s */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkipBackward}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Text style={styles.skipIcon}>⏪</Text>
        <Text style={styles.skipLabel}>30s</Text>
      </TouchableOpacity>

      {/* Play/Pause Button */}
      <TouchableOpacity
        style={styles.playButton}
        onPress={handlePlayPause}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading || isBuffering ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : (
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        )}
      </TouchableOpacity>

      {/* Skip Forward 30s */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkipForward}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Text style={styles.skipIcon}>⏩</Text>
        <Text style={styles.skipLabel}>30s</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  skipButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  skipIcon: {
    fontSize: 24,
    color: '#333333',
  },
  skipLabel: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    elevation: 8,
  },
  playIcon: {
    fontSize: 36,
    color: '#FFFFFF',
  },
});
