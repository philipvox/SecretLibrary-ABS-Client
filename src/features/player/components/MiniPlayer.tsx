// File: src/features/player/components/MiniPlayer.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

export function MiniPlayer() {
  const { currentBook, isPlaying, position, duration, play, pause, togglePlayer } = usePlayerStore();

  if (!currentBook) return null;

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
  const coverUrl = apiClient.getItemCoverUrl(currentBook.id);

  return (
    <TouchableOpacity style={styles.container} onPress={togglePlayer} activeOpacity={0.95}>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.content}>
        <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.author} numberOfLines={1}>{author}</Text>
        </View>

        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={22} color={theme.colors.neutral[0]} set="ionicons" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.neutral[900],
    borderTopLeftRadius: theme.radius.large,
    borderTopRightRadius: theme.radius.large,
    overflow: 'hidden',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: theme.colors.neutral[700],
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
    backgroundColor: theme.colors.neutral[700],
  },
  info: {
    flex: 1,
    marginLeft: theme.spacing[3],
    marginRight: theme.spacing[3],
  },
  title: {
    ...theme.textStyles.bodySmall,
    fontWeight: '600',
    color: theme.colors.neutral[0],
    marginBottom: theme.spacing[1] / 2,
  },
  author: {
    ...theme.textStyles.caption,
    color: theme.colors.neutral[400],
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
});