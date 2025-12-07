import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

interface BookActionsProps {
  book: LibraryItem;
}

// Download progress button with animated progress bar
function DownloadProgressButton({
  progress,
  onPress
}: {
  progress: number;
  onPress: () => void;
}) {
  const progressStyle = useAnimatedStyle(() => ({
    width: `${withTiming(progress * 100, { duration: 200 })}%`,
  }));

  return (
    <TouchableOpacity
      style={styles.progressButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Background track */}
      <View style={styles.progressTrack}>
        {/* Animated fill */}
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>
      {/* Text overlay */}
      <View style={styles.progressContent}>
        <Icon name="pause" size={16} color="#FFFFFF" set="ionicons" />
        <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
      </View>
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
      // Retry with high priority
      await downloadManager.queueDownload(book, 10);
    } else {
      await downloadManager.queueDownload(book);
    }
  };

  // Get download button state
  const getDownloadButtonState = () => {
    if (isDownloaded) {
      return {
        icon: 'checkmark-circle' as const,
        text: 'Downloaded',
        color: '#4CAF50',
        bgColor: 'rgba(76, 175, 80, 0.15)',
      };
    }
    if (isDownloading) {
      return {
        icon: 'pause' as const,
        text: `${Math.round(downloadProgress * 100)}%`,
        color: theme.colors.primary[500],
        bgColor: theme.colors.primary[50],
      };
    }
    if (isPending) {
      return {
        icon: 'time-outline' as const,
        text: 'Queued',
        color: theme.colors.text.secondary,
        bgColor: theme.colors.neutral[100],
      };
    }
    if (isPaused) {
      return {
        icon: 'play' as const,
        text: 'Paused',
        color: '#FF9800',
        bgColor: 'rgba(255, 152, 0, 0.15)',
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
      color: theme.colors.text.secondary,
      bgColor: theme.colors.neutral[100],
    };
  };

  const downloadState = getDownloadButtonState();

  const handleMarkFinished = () => {
    Alert.alert('Coming Soon', 'Mark as finished will be fully implemented soon.');
  };

  const playButtonText = isFinished ? 'Play Again' : hasProgress ? 'Continue' : 'Play';

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.8}>
        <Icon name="play" size={20} color="#FFFFFF" set="ionicons" />
        <Text style={styles.playButtonText}>{playButtonText}</Text>
      </TouchableOpacity>

      <View style={styles.secondaryRow}>
        {isDownloading ? (
          <DownloadProgressButton
            progress={downloadProgress}
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
            color={isFinished ? theme.colors.primary[500] : theme.colors.text.secondary} 
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
    paddingHorizontal: theme.spacing[5],
    paddingBottom: theme.spacing[5],
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.large,
    paddingVertical: theme.spacing[4],
    marginBottom: theme.spacing[3],
    gap: theme.spacing[2],
    ...theme.elevation.small,
  },
  playButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radius.large,
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[2],
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  finishedButton: {
    backgroundColor: theme.colors.primary[50],
  },
  finishedButtonText: {
    color: theme.colors.primary[500],
  },
  // Progress button styles
  progressButton: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    position: 'relative',
  },
  progressTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary[500],
    opacity: 0.9,
  },
  progressContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  progressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
});