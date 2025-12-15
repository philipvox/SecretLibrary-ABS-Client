/**
 * src/shared/components/BookCard.tsx
 *
 * Simplified book card component (list view style).
 * - Download icon on right for non-downloaded
 * - Small + on cover corner for queue (downloaded only)
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useCoverUrl } from '@/core/cache';
import type { LibraryItem } from '@/core/types';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useQueueStore, useIsInQueue } from '@/features/queue/stores/queueStore';
import { usePlayerStore } from '@/features/player';
import {
  colors,
  spacing,
  radius,
  layout,
  typography,
  scale,
  formatProgress,
  formatDuration,
} from '@/shared/theme';
import { ThumbnailProgressBar } from './ThumbnailProgressBar';

// Download Icon
const DownloadIcon = ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3v12m0 0l-4-4m4 4l4-4M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Play Icon
const PlayIcon = ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 4.99l14 7-14 7V5z"
      fill={color}
    />
  </Svg>
);

// Small Plus Icon for cover overlay
const SmallPlusIcon = ({ size = 14, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5v14M5 12h14"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
    />
  </Svg>
);

// Checkmark for in-queue
const CheckIcon = ({ size = 14, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12l5 5 9-9"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Cloud Icon for streaming
const CloudIcon = ({ size = 14, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Progress Ring for downloading
const ProgressRing = ({ progress, size = 28 }: { progress: number; size?: number }) => {
  const strokeWidth = 2.5;
  const ringRadius = (size - strokeWidth) / 2;
  const circumference = ringRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const progressPct = Math.round(progress);
  const displayText = progressPct === 0 ? '...' : `${progressPct}%`;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={ringRadius}
          stroke={colors.progressTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={ringRadius}
          stroke={colors.textPrimary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.progressText}>{displayText}</Text>
    </View>
  );
};

export type BookCardActionType = 'auto' | 'download' | 'play';

/** Page context for context-aware secondary info (NNGroup Heuristic #8 - Minimalist Design) */
export type BookCardContext = 'browse' | 'library' | 'author_detail' | 'narrator_detail' | 'series_detail';

export interface BookCardProps {
  book: LibraryItem;
  onPress: () => void;
  showListeningProgress?: boolean;
  /** Action shown on right side:
   * - 'auto': Download for browse, nothing for library (default)
   * - 'download': Always show download if not downloaded
   * - 'play': Show play button for downloaded books
   */
  actionType?: BookCardActionType;
  /** Callback when play button is pressed (when actionType='play') */
  onPlayPress?: () => void;
  /** Page context - determines secondary info shown:
   * - author_detail: Shows narrator (author already on page)
   * - narrator_detail: Shows author (narrator already on page)
   * - default: Shows author
   */
  context?: BookCardContext;
  /** Show download/stream status badge on cover:
   * - Downloaded: gold checkmark ✓
   * - Streaming: blue cloud ☁
   */
  showStatusBadge?: boolean;
}

export function BookCard({
  book,
  onPress,
  showListeningProgress = true,
  actionType = 'auto',
  onPlayPress,
  context = 'browse',
  showStatusBadge = false,
}: BookCardProps) {
  // State from hooks
  const { isDownloaded, isDownloading, progress } = useDownloadStatus(book.id);
  const isInQueue = useIsInQueue(book.id);
  const currentBookId = usePlayerStore((s) => s.currentBook?.id);
  const isNowPlaying = currentBookId === book.id;

  // Actions
  const { queueDownload } = useDownloads();
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);

  // Animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get metadata
  const coverUrl = useCoverUrl(book.id);
  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Untitled';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata?.narratorName || metadata?.narrators?.[0]?.name || '';
  const duration = (book.media as any)?.duration || 0;
  const durationText = duration > 0 ? formatDuration.short(duration) : null;

  // Context-aware secondary info (NNGroup Heuristic #8 - Minimalist Design)
  // On Author Detail: show narrator (author already on page)
  // On Narrator Detail: show author (narrator already on page)
  // Default: show author
  const getSecondaryPerson = (): string => {
    switch (context) {
      case 'author_detail':
        return narrator || author; // Show narrator, fallback to author
      case 'narrator_detail':
        return author; // Show author
      default:
        return author; // Default to author
    }
  };
  const secondaryPerson = getSecondaryPerson();

  // Get listening progress
  const userProgress = (book as any).userMediaProgress;
  const progressPercent = userProgress?.progress ? Math.round(userProgress.progress * 100) : 0;

  // Handle download press
  const handleDownloadPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    queueDownload(book);
  }, [book, queueDownload]);

  // Handle play press
  const handlePlayPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayPress?.();
  }, [onPlayPress]);

  // Handle queue toggle on cover
  const handleQueuePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    if (isInQueue) {
      removeFromQueue(book.id);
    } else {
      addToQueue(book);
    }
  }, [book, isInQueue, addToQueue, removeFromQueue, scaleAnim]);

  return (
    <View style={styles.container}>
      {/* Pressable card area - navigates to BookDetail */}
      <Pressable style={styles.cardPressable} onPress={onPress}>
        {/* Cover with optional queue button overlay */}
        <View style={styles.coverContainer}>
          <Image
            source={coverUrl}
            style={[styles.cover, !isDownloaded && !isDownloading && styles.coverNotDownloaded]}
            contentFit="cover"
          />

          {/* Progress bar overlay at bottom of cover */}
          {showListeningProgress && (
            <ThumbnailProgressBar progress={userProgress?.progress || 0} />
          )}

          {/* Queue button on cover - only for downloaded books */}
          {isDownloaded && !isNowPlaying && (
            <TouchableOpacity
              style={[styles.queueButton, isInQueue && styles.queueButtonActive]}
              onPress={handleQueuePress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                {isInQueue ? (
                  <CheckIcon size={12} color={colors.backgroundPrimary} />
                ) : (
                  <SmallPlusIcon size={12} color={colors.textPrimary} />
                )}
              </Animated.View>
            </TouchableOpacity>
          )}

          {/* Download/Stream status badge */}
          {showStatusBadge && !isDownloading && (
            <View style={[styles.statusBadge, isDownloaded ? styles.downloadedBadge : styles.streamBadge]}>
              {isDownloaded ? (
                <CheckIcon size={10} color="#000" />
              ) : (
                <CloudIcon size={10} color="#fff" />
              )}
            </View>
          )}
        </View>

        {/* Book info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {secondaryPerson}{durationText ? ` · ${durationText}` : ''}
          </Text>
          {showListeningProgress && progressPercent > 0 && (
            <Text style={styles.listeningProgress}>
              {formatProgress.percent(progressPercent / 100)} complete
            </Text>
          )}
        </View>
      </Pressable>

      {/* Right side action - context-dependent */}
      {/* Download action (browse context) */}
      {(actionType === 'auto' || actionType === 'download') && !isDownloaded && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={isDownloading ? undefined : handleDownloadPress}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ProgressRing progress={progress * 100} size={scale(28)} />
          ) : (
            <DownloadIcon size={scale(20)} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      )}

      {/* Play action (library context) */}
      {actionType === 'play' && isDownloaded && !isNowPlaying && onPlayPress && (
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPress}
        >
          <PlayIcon size={scale(16)} color={colors.backgroundPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Wrapper for backwards compatibility
export function BookCardWithState(props: BookCardProps) {
  return <BookCard {...props} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cardPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  coverContainer: {
    position: 'relative',
  },
  cover: {
    width: scale(50),
    height: scale(50),
    borderRadius: radius.cover,
    backgroundColor: colors.backgroundElevated,
  },
  coverNotDownloaded: {
    opacity: 0.7,
  },
  queueButton: {
    position: 'absolute',
    bottom: spacing.xxs,
    right: spacing.xxs,
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  queueButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  statusBadge: {
    position: 'absolute',
    bottom: spacing.xxs,
    left: spacing.xxs,
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadedBadge: {
    backgroundColor: colors.accent,
  },
  streamBadge: {
    backgroundColor: 'rgba(100, 150, 255, 0.9)',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  title: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  listeningProgress: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  actionButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: scale(2), // Offset for visual centering of play icon
  },
  progressText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default BookCard;
