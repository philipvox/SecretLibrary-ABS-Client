/**
 * Mini player - redesigned
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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

  if (!currentBook) {
    return null;
  }

  const handlePlayPause = async (e: any) => {
    e.stopPropagation();
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
  const metadata = currentBook.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const coverUrl = currentBook.media.coverPath;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={togglePlayer}
      activeOpacity={0.95}
    >
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.content}>
        {/* Cover */}
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
        </View>

        {/* Play/Pause Button */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon 
            name={isPlaying ? 'pause' : 'play'} 
            size={24} 
            color={theme.colors.text.inverse}
            set="ionicons"
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.elevated,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
    ...theme.elevation.large,
  },
  progressBarContainer: {
    height: 2,
    backgroundColor: theme.colors.neutral[300],
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary[500],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.neutral[200],
  },
  info: {
    flex: 1,
    marginLeft: theme.spacing[3],
    marginRight: theme.spacing[3],
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1] / 2,
  },
  author: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.elevation.small,
  },
});