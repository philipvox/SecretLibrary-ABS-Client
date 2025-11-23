/**
 * src/features/player/components/MiniPlayer.tsx
 *
 * Mini player component that appears at the bottom of screens when audio is playing.
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../stores/playerStore';

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Mini player component
 */
export function MiniPlayer() {
  const {
    currentBook,
    isPlaying,
    position,
    duration,
    play,
    pause,
    togglePlayer,
  } = usePlayerStore();

  // Don't render if no book is loaded
  if (!currentBook) {
    return null;
  }

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

  const progress = duration > 0 ? position / duration : 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={togglePlayer}
      activeOpacity={0.8}
    >
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.content}>
        {/* Cover image */}
        <Image
          source={{ uri: currentBook.media.coverPath }}
          style={styles.cover}
        />

        {/* Book info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {currentBook.media.metadata.title}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {currentBook.media.metadata.authorName}
          </Text>
          <Text style={styles.time}>
            {formatTime(position)} / {formatTime(duration)}
          </Text>
        </View>

        {/* Play/pause button */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={28}
            color="#000"
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#e0e0e0',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  cover: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  author: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  time: {
    fontSize: 11,
    color: '#999',
  },
  playButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 22,
  },
});