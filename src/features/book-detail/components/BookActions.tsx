import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { Icon } from '@/shared/components/Icon';
import { colors, spacing, radius, elevation } from '@/shared/theme';

interface BookActionsProps {
  book: LibraryItem;
}

/**
 * Format bytes to human readable string (e.g., "45.2 MB")
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Clean download progress button with simple progress bar
 */
function DownloadProgressButton({
  progress,
  bytesDownloaded,
  totalBytes,
  status,
  onPress,
}: {
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  status: 'preparing' | 'downloading' | 'paused';
  onPress: () => void;
}) {
  const progressStyle = useAnimatedStyle(() => ({
    width: `${withTiming(progress * 100, { duration: 200 })}%`,
  }));

  // Status label
  const getStatusLabel = () => {
    switch (status) {
      case 'preparing': return 'Preparing...';
      case 'downloading': return 'Downloading';
      case 'paused': return 'Paused';
      default: return '';
    }
  };

  // Progress text - show bytes downloaded / total
  const getProgressText = () => {
    if (status === 'preparing' || totalBytes === 0) {
      return 'Calculating...';
    }
    return `${formatBytes(bytesDownloaded)} / ${formatBytes(totalBytes)}`;
  };

  return (
    <TouchableOpacity
      style={styles.downloadProgressButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header row: Status on left, percentage on right */}
      <View style={styles.downloadProgressHeader}>
        <View style={styles.downloadStatusRow}>
          {status === 'preparing' ? (
            <ActivityIndicator size="small" color={colors.textSecondary} style={styles.downloadSpinner} />
          ) : status === 'paused' ? (
            <Icon name="play" size={14} color={colors.textSecondary} set="ionicons" />
          ) : (
            <Icon name="pause" size={14} color={colors.textSecondary} set="ionicons" />
          )}
          <Text style={styles.downloadStatusText}>{getStatusLabel()}</Text>
        </View>
        <Text style={styles.downloadPercentText}>
          {status === 'preparing' ? '—' : `${Math.round(progress * 100)}%`}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.downloadProgressTrack}>
        <Animated.View
          style={[
            styles.downloadProgressFill,
            progressStyle,
            status === 'paused' && styles.downloadProgressFillPaused
          ]}
        />
      </View>

      {/* Footer: bytes downloaded / total */}
      <Text style={styles.downloadBytesText}>{getProgressText()}</Text>
    </TouchableOpacity>
  );
}

export function BookActions({ book }: BookActionsProps) {
  const { loadBook } = usePlayerStore();
  const isFinished = book.userMediaProgress?.isFinished || false;
  const progress = book.userMediaProgress?.progress || 0;
  const hasProgress = progress > 0 && progress < 1;

  // Download status
  const {
    isDownloaded,
    isDownloading,
    isPending,
    isPaused,
    hasError,
    progress: downloadProgress,
    bytesDownloaded,
    totalBytes,
  } = useDownloadStatus(book.id);

  const handlePlay = async () => {
    try {
      await loadBook(book);
    } catch (error) {
      console.error('Failed to start playback:', error);
      Alert.alert('Playback Error', 'Failed to start playback. Please try again.');
    }
  };

  const handleDownload = async () => {
    if (isDownloaded) {
      Alert.alert(
        'Remove Download',
        'Remove this book from offline storage?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => downloadManager.deleteDownload(book.id),
          },
        ]
      );
    } else if (isDownloading) {
      await downloadManager.pauseDownload(book.id);
    } else if (isPaused) {
      await downloadManager.resumeDownload(book.id);
    } else if (hasError) {
      await downloadManager.queueDownload(book, 10);
    } else {
      await downloadManager.queueDownload(book);
    }
  };

  // Get download button state for non-progress states
  const getDownloadButtonState = () => {
    if (isDownloaded) {
      return {
        icon: 'checkmark-circle' as const,
        text: 'Downloaded',
        color: '#4CAF50',
        bgColor: 'rgba(76, 175, 80, 0.15)',
      };
    }
    if (isPending) {
      return {
        icon: 'time-outline' as const,
        text: 'Queued',
        color: colors.textSecondary,
        bgColor: colors.progressTrack,
      };
    }
    if (hasError) {
      return {
        icon: 'alert-circle-outline' as const,
        text: 'Retry',
        color: '#F44336',
        bgColor: 'rgba(244, 67, 54, 0.15)',
      };
    }
    return {
      icon: 'download-outline' as const,
      text: 'Download',
      color: colors.textSecondary,
      bgColor: colors.progressTrack,
    };
  };

  const downloadState = getDownloadButtonState();

  const handleMarkFinished = () => {
    Alert.alert('Coming Soon', 'Mark as finished will be fully implemented soon.');
  };

  const playButtonText = isFinished ? 'Play Again' : hasProgress ? 'Continue' : 'Play';

  // Show progress button when downloading or paused
  const showProgressButton = isDownloading || isPaused;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.8}>
        <Icon name="play" size={20} color="#FFFFFF" set="ionicons" />
        <Text style={styles.playButtonText}>{playButtonText}</Text>
      </TouchableOpacity>

      <View style={styles.secondaryRow}>
        {showProgressButton ? (
          <DownloadProgressButton
            progress={downloadProgress}
            bytesDownloaded={bytesDownloaded}
            totalBytes={totalBytes}
            status={isPaused ? 'paused' : downloadProgress === 0 ? 'preparing' : 'downloading'}
            onPress={handleDownload}
          />
        ) : (
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: downloadState.bgColor }]}
            onPress={handleDownload}
            activeOpacity={0.7}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={downloadState.color} />
            ) : (
              <Icon name={downloadState.icon} size={18} color={downloadState.color} set="ionicons" />
            )}
            <Text style={[styles.secondaryButtonText, { color: downloadState.color }]}>
              {downloadState.text}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.secondaryButton, isFinished && styles.finishedButton]}
          onPress={handleMarkFinished}
          activeOpacity={0.7}
        >
          <Icon
            name="checkmark"
            size={18}
            color={isFinished ? colors.accent : colors.textSecondary}
            set="ionicons"
          />
          <Text style={[styles.secondaryButtonText, isFinished && styles.finishedButtonText]}>
            Finished
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    ...elevation.small,
  },
  playButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.progressTrack,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  finishedButton: {
    backgroundColor: colors.accentSubtle,
  },
  finishedButtonText: {
    color: colors.accent,
  },
  // Download progress button - clean minimal design
  downloadProgressButton: {
    flex: 1,
    backgroundColor: colors.progressTrack,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  downloadProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  downloadStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadSpinner: {
    transform: [{ scale: 0.8 }],
  },
  downloadStatusText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  downloadPercentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  downloadProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  downloadProgressFillPaused: {
    backgroundColor: '#FF9800',
  },
  downloadBytesText: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textTertiary,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
});
