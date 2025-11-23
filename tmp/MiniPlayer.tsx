/**
 * src/features/player/components/MiniPlayer.tsx
 *
 * Mini player bar that displays at the bottom of all screens when audio is playing.
 * Shows book cover, title, play/pause button, and progress bar.
 * Tapping opens the full player screen.
 */

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { apiClient } from '@/core/api';

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
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

  // Don't show if no book is loaded
  if (!currentBook) {
    return null;
  }

  const metadata = currentBook.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const coverUrl = apiClient.getItemCoverUrl(currentBook.id);
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  /**
   * Handle play/pause button press
   */
  const handlePlayPause = async (e: any) => {
    e.stopPropagation(); // Prevent opening full player
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
    <TouchableOpacity
      style={styles.container}
      onPress={togglePlayer}
      activeOpacity={0.9}
    >
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      <View style={styles.content}>
        {/* Book Cover */}
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          resizeMode="cover"
        />

        {/* Book Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
          <Text style={styles.time}>
            {formatTime(position)} / {formatTime(duration)}
          </Text>
        </View>

        {/* Play/Pause Button */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    elevation: 8,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: '#E0E0E0',
  },
  progressBar: {
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
    backgroundColor: '#F0F0F0',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  author: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  time: {
    fontSize: 11,
    color: '#888888',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
});
