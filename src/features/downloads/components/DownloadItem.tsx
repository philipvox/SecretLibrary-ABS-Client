/**
 * src/features/downloads/components/DownloadItem.tsx
 *
 * Single download item for the downloads list view.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { useCoverUrl } from '@/core/cache';
import { DownloadTask } from '@/core/services/downloadManager';
import { sqliteCache } from '@/core/services/sqliteCache';
import { LibraryItem } from '@/core/types';
import { haptics } from '@/core/native/haptics';
import { colors, scale } from '@/shared/theme';

const COLORS = {
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  accent: colors.success,
  warning: colors.warning,
  error: colors.error,
  cardBg: colors.cardBackground,
  progressBg: colors.progressTrack,
  progressFill: colors.success,
};

// Pause icon
const PauseIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M10 4H6v16h4V4zM18 4h-4v16h4V4z"
      fill={color}
    />
  </Svg>
);

// Play icon
const PlayIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 4l15 8-15 8V4z"
      fill={color}
    />
  </Svg>
);

// Check icon
const CheckIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 6L9 17l-5-5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Remove icon
const RemoveIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 6L6 18M6 6l12 12"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Alert icon
const AlertIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 9v4M12 17h.01M12 3l9.5 16.5H2.5L12 3z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

interface DownloadItemProps {
  download: DownloadTask;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}

export function DownloadItem({ download, onPause, onResume, onDelete }: DownloadItemProps) {
  const [book, setBook] = useState<LibraryItem | null>(null);
  const coverUrl = useCoverUrl(download.itemId);

  // Load book metadata from cache
  useEffect(() => {
    sqliteCache.getLibraryItem(download.itemId).then((item) => {
      if (item) setBook(item);
    });
  }, [download.itemId]);

  const metadata = book?.media?.metadata as any;
  const title = metadata?.title || 'Loading...';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || '';

  // NN/g: Haptic feedback for download actions
  const handlePause = useCallback(() => {
    haptics.toggle();
    onPause();
  }, [onPause]);

  const handleResume = useCallback(() => {
    haptics.buttonPress();
    onResume();
  }, [onResume]);

  const handleDelete = useCallback(() => {
    haptics.warning();
    onDelete();
  }, [onDelete]);

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // NN/g: Detailed status display for visibility of system status
  const getStatusInfo = () => {
    const bytesInfo = download.bytesDownloaded > 0 && download.totalBytes > 0
      ? ` • ${formatBytes(download.bytesDownloaded)} / ${formatBytes(download.totalBytes)}`
      : '';

    switch (download.status) {
      case 'downloading':
        // Show "Preparing" when server is fetching/caching the file
        const progressPct = Math.round(download.progress * 100);
        const statusText = progressPct === 0
          ? 'Preparing...'
          : `Downloading ${progressPct}%${bytesInfo}`;
        return {
          text: statusText,
          color: COLORS.accent,
          showProgress: true, // Always show progress bar for downloading state
        };
      case 'pending':
        return {
          text: 'Queued - waiting to start...',
          color: COLORS.textSecondary,
          showProgress: false,
        };
      case 'paused':
        return {
          text: `Paused at ${Math.round(download.progress * 100)}%${bytesInfo}`,
          color: COLORS.warning,
          showProgress: true,
        };
      case 'error':
        return {
          text: `Failed: ${download.error || 'Unknown error'} - tap to retry`,
          color: COLORS.error,
          showProgress: false,
        };
      case 'complete':
        return {
          text: `Downloaded • ${formatBytes(download.totalBytes || 0)}`,
          color: COLORS.accent,
          showProgress: false,
        };
      default:
        return {
          text: '',
          color: COLORS.textSecondary,
          showProgress: false,
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Action button based on status - NN/g: 44×44px minimum touch target
  const renderActionButton = () => {
    switch (download.status) {
      case 'downloading':
        return (
          <Pressable style={styles.actionButton} onPress={handlePause}>
            <PauseIcon size={scale(18)} color={COLORS.accent} />
          </Pressable>
        );
      case 'paused':
        return (
          <Pressable style={styles.actionButton} onPress={handleResume}>
            <PlayIcon size={scale(18)} color={COLORS.warning} />
          </Pressable>
        );
      case 'pending':
        return (
          <View style={styles.actionButton}>
            <ActivityIndicator size="small" color={COLORS.textSecondary} />
          </View>
        );
      case 'error':
        return (
          <Pressable style={styles.actionButton} onPress={handleResume}>
            <AlertIcon size={scale(18)} color={COLORS.error} />
          </Pressable>
        );
      case 'complete':
        return (
          <Pressable style={styles.actionButton} onPress={handleDelete}>
            <CheckIcon size={scale(18)} color={COLORS.accent} />
          </Pressable>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Cover */}
      <Image source={coverUrl} style={styles.cover} contentFit="cover" />

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {author ? (
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
        ) : null}
        <Text style={[styles.status, { color: statusInfo.color }]}>
          {statusInfo.text}
        </Text>

        {/* Progress bar */}
        {statusInfo.showProgress && (
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${download.progress * 100}%`,
                  backgroundColor: statusInfo.color,
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* Action button */}
      {renderActionButton()}

      {/* Delete button */}
      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <RemoveIcon size={scale(18)} color={COLORS.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    backgroundColor: COLORS.cardBg,
    borderRadius: scale(12),
    marginBottom: scale(8),
    gap: scale(10),
  },
  cover: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(6),
    backgroundColor: '#262626',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: scale(14),
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: scale(2),
  },
  author: {
    fontSize: scale(12),
    color: COLORS.textSecondary,
    marginBottom: scale(2),
  },
  status: {
    fontSize: scale(11),
  },
  progressContainer: {
    marginTop: scale(6),
    height: scale(3),
    backgroundColor: COLORS.progressBg,
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(2),
  },
  // NN/g: 44×44px minimum touch targets
  actionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
