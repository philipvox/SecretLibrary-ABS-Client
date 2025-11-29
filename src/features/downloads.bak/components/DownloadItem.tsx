/**
 * src/features/downloads/components/DownloadItem.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DownloadedBook } from '../services/downloadService';
import { useDownloadStore } from '../stores/downloadStore';
import { formatBytes } from '../hooks/useDownloads';
import { theme } from '@/shared/theme';

interface DownloadItemProps {
  download: DownloadedBook;
  onPlay?: () => void;
}

export function DownloadItem({ download, onPlay }: DownloadItemProps) {
  const { deleteDownload } = useDownloadStore();

  const handleDelete = () => {
    Alert.alert(
      'Remove Download',
      `Remove "${download.title}" from downloads?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteDownload(download.libraryItemId),
        },
      ]
    );
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPlay} activeOpacity={0.7}>
      <View style={styles.coverContainer}>
        {download.localCoverPath ? (
          <Image source={{ uri: download.localCoverPath }} style={styles.cover} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="book" size={24} color={theme.colors.text.tertiary} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {download.title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {download.author}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{formatBytes(download.totalSize)}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{formatDuration(download.duration)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onPlay} style={styles.actionButton}>
          <Ionicons name="play-circle" size={36} color={theme.colors.primary[500]} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={22} color={theme.colors.status.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing[3],
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radius.medium,
    marginBottom: theme.spacing[2],
  },
  coverContainer: {
    marginRight: theme.spacing[3],
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.small,
  },
  coverPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  author: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
  },
  metaDot: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginHorizontal: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  actionButton: {
    padding: theme.spacing[1],
  },
});