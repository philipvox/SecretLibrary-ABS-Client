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
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { LibraryItem } from '@/core/types';
import { useCoverUrl } from '@/core/cache';
import { useDownloadStatus, useDownloads } from '@/core/hooks/useDownloads';
import { usePlayerStore } from '@/features/player';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

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
function ProgressRing({ progress, size = 24 }: { progress: number; size?: number }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={ACCENT}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export const SeriesBookRow = memo(function SeriesBookRow({
  book,
  sequenceNumber,
  isNowPlaying,
  isUpNext,
  onPress,
}: SeriesBookRowProps) {
  const coverUrl = useCoverUrl(book.id);
  const { isDownloaded, isDownloading, progress: downloadProgress } = useDownloadStatus(book.id);
  const { queueDownload } = useDownloads();
  const { loadBook, play, pause, isPlaying } = usePlayerStore();

  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Unknown';
  const duration = (book.media as any)?.duration || 0;

  // Get listening progress
  const userProgress = (book as any).userMediaProgress?.progress || 0;
  const isCompleted = userProgress >= 0.95;
  const isInProgress = userProgress > 0 && userProgress < 0.95;
  const progressPercent = Math.round(userProgress * 100);

  // Calculate time remaining
  const timeRemaining = duration * (1 - userProgress);
  const timeRemainingText = formatDurationReadable(timeRemaining);

  // Handle download press
  const handleDownloadPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    queueDownload(book);
  }, [book, queueDownload]);

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
        isNowPlaying && styles.containerNowPlaying,
        isUpNext && !isNowPlaying && styles.containerUpNext,
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
            !isDownloaded && !isDownloading && styles.coverNotDownloaded,
            isCompleted && !isNowPlaying && styles.coverCompleted,
          ]}
          contentFit="cover"
        />

        {/* Status indicator on cover */}
        {isCompleted && !isNowPlaying && (
          <View style={[styles.statusBadge, styles.statusBadgeCompleted]}>
            <Check size={scale(10)} color="#000" strokeWidth={3} />
          </View>
        )}
        {isDownloaded && !isCompleted && !isNowPlaying && (
          <View style={styles.statusBadge}>
            <Check size={scale(10)} color="#000" strokeWidth={3} />
          </View>
        )}
        {isNowPlaying && (
          <View style={[styles.statusBadge, styles.statusBadgePlaying]}>
            <Volume2 size={scale(10)} color="#000" strokeWidth={2} />
          </View>
        )}
      </View>

      {/* Book info */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              isNowPlaying && styles.titleNowPlaying,
              isCompleted && !isNowPlaying && styles.titleCompleted,
            ]}
            numberOfLines={1}
          >
            {sequenceNumber !== null ? `${sequenceNumber}. ` : ''}{title}
          </Text>
          {isNowPlaying && (
            <View style={styles.nowPlayingBadge}>
              <Text style={styles.nowPlayingText}>NOW PLAYING</Text>
            </View>
          )}
          {isUpNext && !isNowPlaying && (
            <View style={styles.upNextBadge}>
              <Text style={styles.upNextText}>UP NEXT</Text>
            </View>
          )}
        </View>

        {/* Progress section - varies based on state */}
        {isCompleted ? (
          // Completed state
          <View style={styles.statusRow}>
            <CheckCircle size={scale(14)} color={ACCENT} strokeWidth={2} />
            <Text style={styles.completedText}>Done</Text>
            <Text style={styles.durationTextDim}>· {formatDurationReadable(duration)}</Text>
          </View>
        ) : isInProgress ? (
          // In progress state - show progress bar and time remaining
          <View style={styles.progressSection}>
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>{progressPercent}%</Text>
            </View>
            <Text style={styles.timeRemainingText}>{timeRemainingText} left</Text>
          </View>
        ) : (
          // Not started state
          <Text style={styles.durationText}>{formatDurationReadable(duration)}</Text>
        )}
      </View>

      {/* Right action button */}
      <View style={styles.actionContainer}>
        {isDownloading ? (
          <View style={styles.downloadingIndicator}>
            <ProgressRing progress={downloadProgress} size={scale(28)} />
          </View>
        ) : isDownloaded ? (
          <TouchableOpacity
            style={[
              styles.playButton,
              isNowPlaying && styles.playButtonActive,
            ]}
            onPress={handlePlayPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isNowPlaying && isPlaying ? (
              <Pause size={scale(18)} color="#000" strokeWidth={2} />
            ) : (
              <Play size={scale(18)} color={isNowPlaying ? '#000' : 'rgba(255,255,255,0.8)'} fill={isNowPlaying ? '#000' : 'rgba(255,255,255,0.8)'} strokeWidth={0} />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownloadPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowDown size={scale(18)} color="rgba(255,255,255,0.5)" strokeWidth={2} />
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
    backgroundColor: 'rgba(244,182,12,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244,182,12,0.4)',
  },
  containerUpNext: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  containerCompleted: {
    opacity: 0.7,
  },
  coverContainer: {
    position: 'relative',
  },
  cover: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(6),
    backgroundColor: '#262626',
  },
  coverNotDownloaded: {
    opacity: 0.6,
  },
  coverCompleted: {
    opacity: 0.8,
  },
  statusBadge: {
    position: 'absolute',
    bottom: scale(-2),
    right: scale(-2),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgePlaying: {
    backgroundColor: '#fff',
  },
  statusBadgeCompleted: {
    backgroundColor: 'rgba(244,182,12,0.8)',
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
    color: '#fff',
    flex: 1,
  },
  titleNowPlaying: {
    fontWeight: '600',
    color: '#fff',
  },
  titleCompleted: {
    color: 'rgba(255,255,255,0.7)',
  },
  nowPlayingBadge: {
    backgroundColor: ACCENT,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  nowPlayingText: {
    fontSize: scale(8),
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  upNextBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  upNextText: {
    fontSize: scale(8),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  completedText: {
    fontSize: scale(12),
    color: ACCENT,
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(2),
  },
  progressText: {
    fontSize: scale(11),
    fontWeight: '600',
    color: ACCENT,
    width: scale(32),
    textAlign: 'right',
  },
  timeRemainingText: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
  },
  durationText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },
  durationTextDim: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.4)',
  },
  actionContainer: {
    marginLeft: scale(8),
  },
  playButton: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: ACCENT,
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
