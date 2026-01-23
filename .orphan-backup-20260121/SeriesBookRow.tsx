/**
 * src/features/series/components/SeriesBookRow.tsx
 *
 * Enhanced book row for series based on UX research.
 * Features:
 * - Completed books dimmed (80% opacity)
 * - Time remaining for in-progress books
 * - Visual progress bars
 * - Clear state indicators
 */

import React, { useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Check, CheckCircle, Volume2, Play, Pause, ArrowDown } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { useCoverUrl } from '@/core/cache';

// Helper to get book metadata safely
function getBookMetadata(item: LibraryItem): BookMetadata | null {
  if (item.mediaType !== 'book' || !item.media?.metadata) return null;
  return item.media.metadata as BookMetadata;
}

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media;
}
import { useDownloadStatus, useDownloads } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { usePlayerStore } from '@/features/player';
import { scale, spacing, radius, useTheme } from '@/shared/theme';

interface SeriesBookRowProps {
  book: LibraryItem;
  sequenceNumber: number | null;
  isNowPlaying: boolean;
  isUpNext: boolean;
  onPress: () => void;
}

// Format duration as "Xh Ym"
function formatDurationReadable(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Format duration as timestamp "X:XX:XX"
function formatDurationTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Progress Ring for downloading
function ProgressRing({ progress, size = 24, isPaused = false, accentColor, trackColor }: { progress: number; size?: number; isPaused?: boolean; accentColor: string; trackColor: string }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;
  const progressColor = isPaused ? '#FF9800' : accentColor;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {isPaused && (
        <Svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24">
          <Path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill="#FF9800" />
        </Svg>
      )}
    </View>
  );
}

export const SeriesBookRow = memo(function SeriesBookRow({
  book,
  sequenceNumber,
  isNowPlaying,
  isUpNext,
  onPress,
}: SeriesBookRowProps) {
  // Theme-aware colors
  const { colors } = useTheme();
  const accentColor = colors.accent.primary;

  const coverUrl = useCoverUrl(book.id);
  const { isDownloaded, isDownloading, isPaused, isPending, progress: downloadProgress } = useDownloadStatus(book.id);
  const { queueDownload } = useDownloads();
  const { loadBook, play, pause, isPlaying } = usePlayerStore();

  const metadata = getBookMetadata(book);
  const title = metadata?.title || 'Unknown';
  const duration = isBookMedia(book.media) ? book.media.duration || 0 : 0;

  // Get listening progress
  const userProgress = book.userMediaProgress?.progress || 0;
  const isCompleted = userProgress >= 0.95;
  const isInProgress = userProgress > 0 && userProgress < 0.95;
  const progressPercent = Math.round(userProgress * 100);

  // Calculate time remaining
  const timeRemaining = duration * (1 - userProgress);
  const timeRemainingText = formatDurationReadable(timeRemaining);

  // Handle download press - supports pause/resume
  const handleDownloadPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // If downloading, pause it
    if (isDownloading && !isPaused) {
      await downloadManager.pauseDownload(book.id);
      return;
    }

    // If paused, resume it
    if (isPaused) {
      await downloadManager.resumeDownload(book.id);
      return;
    }

    // If pending, cancel it
    if (isPending) {
      await downloadManager.cancelDownload(book.id);
      return;
    }

    // Otherwise queue the download
    queueDownload(book);
  }, [book, queueDownload, isDownloading, isPaused, isPending]);

  // Handle play press
  const handlePlayPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isNowPlaying && isPlaying) {
      await pause();
    } else if (isNowPlaying) {
      await play();
    } else {
      await loadBook(book, { autoPlay: true, showPlayer: true });
    }
  }, [book, isNowPlaying, isPlaying, loadBook, play, pause]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isNowPlaying && [styles.containerNowPlaying, { backgroundColor: colors.accent.primarySubtle, borderColor: colors.accent.primary }],
        isUpNext && !isNowPlaying && [styles.containerUpNext, { backgroundColor: colors.background.tertiary, borderColor: colors.border.default }],
        isCompleted && !isNowPlaying && styles.containerCompleted,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Cover with status overlay */}
      <View style={styles.coverContainer}>
        <Image
          source={coverUrl}
          style={[
            styles.cover,
            { backgroundColor: colors.surface.card },
          ]}
          contentFit="cover"
        />

        {/* Status indicator on cover */}
        {isCompleted && !isNowPlaying && (
          <View style={[styles.statusBadge, { backgroundColor: accentColor }]}>
            <Check size={scale(10)} color={colors.text.inverse} strokeWidth={3} />
          </View>
        )}
        {isDownloaded && !isCompleted && !isNowPlaying && (
          <View style={[styles.statusBadge, { backgroundColor: accentColor }]}>
            <Check size={scale(10)} color={colors.text.inverse} strokeWidth={3} />
          </View>
        )}
        {isNowPlaying && (
          <View style={[styles.statusBadge, { backgroundColor: colors.background.primary }]}>
            <Volume2 size={scale(10)} color={colors.text.primary} strokeWidth={2} />
          </View>
        )}
      </View>

      {/* Book info */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              { color: colors.text.primary },
              isNowPlaying && styles.titleNowPlaying,
              isCompleted && !isNowPlaying && { color: colors.text.secondary },
            ]}
            numberOfLines={1}
          >
            {sequenceNumber !== null ? `${sequenceNumber}. ` : ''}{title}
          </Text>
          {isNowPlaying && (
            <View style={[styles.nowPlayingBadge, { backgroundColor: accentColor }]}>
              <Text style={[styles.nowPlayingText, { color: colors.text.inverse }]}>NOW PLAYING</Text>
            </View>
          )}
          {isUpNext && !isNowPlaying && (
            <View style={[styles.upNextBadge, { backgroundColor: colors.background.tertiary }]}>
              <Text style={[styles.upNextText, { color: colors.text.secondary }]}>UP NEXT</Text>
            </View>
          )}
        </View>

        {/* Progress section - varies based on state */}
        {isCompleted ? (
          // Completed state
          <View style={styles.statusRow}>
            <CheckCircle size={scale(14)} color={accentColor} strokeWidth={2} />
            <Text style={[styles.completedText, { color: accentColor }]}>Done</Text>
            <Text style={[styles.durationTextDim, { color: colors.text.tertiary }]}>· {formatDurationReadable(duration)}</Text>
          </View>
        ) : isInProgress ? (
          // In progress state - show progress bar and time remaining
          <View style={styles.progressSection}>
            <View style={styles.progressContainer}>
              <View style={[styles.progressTrack, { backgroundColor: colors.progress.track }]}>
                <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: accentColor }]} />
              </View>
              <Text style={[styles.progressText, { color: accentColor }]}>{progressPercent}%</Text>
            </View>
            <Text style={[styles.timeRemainingText, { color: colors.text.tertiary }]}>{timeRemainingText} left</Text>
          </View>
        ) : (
          // Not started state
          <Text style={[styles.durationText, { color: colors.text.secondary }]}>{formatDurationReadable(duration)}</Text>
        )}
      </View>

      {/* Right action button */}
      <View style={styles.actionContainer}>
        {isDownloading || isPaused || isPending ? (
          <TouchableOpacity
            style={styles.downloadingIndicator}
            onPress={handleDownloadPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ProgressRing progress={downloadProgress} size={scale(28)} isPaused={isPaused} accentColor={accentColor} trackColor={colors.progress.track} />
          </TouchableOpacity>
        ) : isDownloaded ? (
          <TouchableOpacity
            style={[
              styles.playButton,
              { backgroundColor: colors.surface.card },
              isNowPlaying && { backgroundColor: accentColor },
            ]}
            onPress={handlePlayPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isNowPlaying && isPlaying ? (
              <Pause size={scale(18)} color={colors.text.inverse} fill={colors.text.inverse} strokeWidth={0} />
            ) : (
              <Play size={scale(18)} color={isNowPlaying ? colors.text.inverse : colors.text.secondary} fill={isNowPlaying ? colors.text.inverse : colors.text.secondary} strokeWidth={0} />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownloadPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowDown size={scale(18)} color={colors.text.tertiary} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
    marginHorizontal: scale(8),
    borderRadius: scale(10),
  },
  containerNowPlaying: {
    // backgroundColor and borderColor set dynamically via accent
    borderWidth: 1,
  },
  containerUpNext: {
    // backgroundColor and borderColor set dynamically via theme
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  containerCompleted: {
    // Full opacity - no dimming
  },
  coverContainer: {
    position: 'relative',
  },
  cover: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(6),
  },
  coverNotDownloaded: {
    // Full opacity - don't dim covers
  },
  coverCompleted: {
    // Full opacity - no dimming
  },
  statusBadge: {
    position: 'absolute',
    bottom: scale(-2),
    right: scale(-2),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    // backgroundColor set dynamically via accentColor or theme
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: scale(12),
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(4),
  },
  title: {
    fontSize: scale(14),
    fontWeight: '500',
    // color set dynamically via colors.text.primary
    flex: 1,
  },
  titleNowPlaying: {
    fontWeight: '600',
  },
  nowPlayingBadge: {
    // backgroundColor set dynamically via accentColor
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  nowPlayingText: {
    fontSize: scale(8),
    fontWeight: '700',
    // color set dynamically via colors.text.inverse
    letterSpacing: 0.5,
  },
  upNextBadge: {
    // backgroundColor set dynamically via colors.background.tertiary
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  upNextText: {
    fontSize: scale(8),
    fontWeight: '700',
    // color set dynamically via colors.text.secondary
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  completedText: {
    fontSize: scale(12),
    // color set dynamically via accentColor
    fontWeight: '500',
  },
  progressSection: {
    gap: scale(4),
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  progressTrack: {
    flex: 1,
    height: scale(4),
    // backgroundColor set dynamically via colors.progress.track
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    // backgroundColor set dynamically via accentColor
    borderRadius: scale(2),
  },
  progressText: {
    fontSize: scale(11),
    fontWeight: '600',
    // color set dynamically via accentColor
    width: scale(32),
    textAlign: 'right',
  },
  timeRemainingText: {
    fontSize: scale(11),
    // color set dynamically via colors.text.tertiary
  },
  durationText: {
    fontSize: scale(12),
    // color set dynamically via colors.text.secondary
  },
  durationTextDim: {
    fontSize: scale(12),
    // color set dynamically via colors.text.tertiary
  },
  actionContainer: {
    marginLeft: scale(8),
  },
  playButton: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    // backgroundColor set dynamically via colors.surface.card or accentColor
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButton: {
    width: scale(38),
    height: scale(38),
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadingIndicator: {
    width: scale(38),
    height: scale(38),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
