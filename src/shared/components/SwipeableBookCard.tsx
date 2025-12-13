/**
 * src/shared/components/SwipeableBookCard.tsx
 *
 * Swipeable book card with action buttons revealed on swipe.
 * Features:
 * - Swipe left: reveals download/delete actions
 * - Swipe right: reveals queue action
 * - Smooth spring animations
 * - Haptic feedback
 */
import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Animated as RNAnimated,
} from 'react-native';
import {
  GestureDetector,
  Gesture,
  Swipeable,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useCoverUrl } from '@/core/cache';
import type { LibraryItem } from '@/core/types';
import { useDownloadStatus, useDownloads } from '@/core/hooks/useDownloads';
import { useQueueStore, useIsInQueue } from '@/features/queue/stores/queueStore';
import { usePlayerStore } from '@/features/player';
import { colors, scale, formatDuration } from '@/shared/theme';

const ACTION_WIDTH = 70;
const SWIPE_THRESHOLD = 40;

const COLORS = {
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  textTertiary: colors.textTertiary,
  accent: colors.accent,
  download: colors.success,
  queue: '#2196F3',
  delete: colors.error,
  background: colors.backgroundTertiary,
};

// Icons
const DownloadIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => (
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

const QueueIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 6h16M4 12h16M4 18h10"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const DeleteIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CheckIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 13l4 4L19 7"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export interface SwipeableBookCardProps {
  book: LibraryItem;
  onPress: () => void;
  onDelete?: () => void;
  showListeningProgress?: boolean;
}

export function SwipeableBookCard({
  book,
  onPress,
  onDelete,
  showListeningProgress = true,
}: SwipeableBookCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  // State from hooks
  const { isDownloaded, isDownloading, progress } = useDownloadStatus(book.id);
  const isInQueue = useIsInQueue(book.id);
  const currentBookId = usePlayerStore((s) => s.currentBook?.id);
  const isNowPlaying = currentBookId === book.id;

  // Actions
  const { queueDownload, deleteDownload } = useDownloads();
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);

  // Get metadata
  const coverUrl = useCoverUrl(book.id);
  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Untitled';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const duration = (book.media as any)?.duration || 0;
  const durationText = duration > 0 ? formatDuration.short(duration) : null;

  // Get listening progress
  const userProgress = (book as any).userMediaProgress;
  const progressPercent = userProgress?.progress ? Math.round(userProgress.progress * 100) : 0;

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  // Action handlers
  const handleDownload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    queueDownload(book);
    closeSwipeable();
  }, [book, queueDownload, closeSwipeable]);

  const handleQueueToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isInQueue) {
      removeFromQueue(book.id);
    } else {
      addToQueue(book);
    }
    closeSwipeable();
  }, [book, isInQueue, addToQueue, removeFromQueue, closeSwipeable]);

  const handleDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (isDownloaded) {
      deleteDownload(book.id);
    }
    onDelete?.();
    closeSwipeable();
  }, [book.id, isDownloaded, deleteDownload, onDelete, closeSwipeable]);

  // Render right actions (download/delete)
  const renderRightActions = useCallback(
    (progress: RNAnimated.AnimatedInterpolation<number>, dragX: RNAnimated.AnimatedInterpolation<number>) => {
      const translateX = dragX.interpolate({
        inputRange: [-ACTION_WIDTH * 2, -ACTION_WIDTH, 0],
        outputRange: [0, 0, ACTION_WIDTH * 2],
        extrapolate: 'clamp',
      });

      return (
        <RNAnimated.View style={[styles.rightActionsContainer, { transform: [{ translateX }] }]}>
          {!isDownloaded && !isDownloading && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.download }]}
              onPress={handleDownload}
            >
              <DownloadIcon size={22} color="#fff" />
              <Text style={styles.actionText}>Download</Text>
            </TouchableOpacity>
          )}
          {isDownloaded && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.delete }]}
              onPress={handleDelete}
            >
              <DeleteIcon size={22} color="#fff" />
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          )}
        </RNAnimated.View>
      );
    },
    [isDownloaded, isDownloading, handleDownload, handleDelete]
  );

  // Render left actions (queue)
  const renderLeftActions = useCallback(
    (progress: RNAnimated.AnimatedInterpolation<number>, dragX: RNAnimated.AnimatedInterpolation<number>) => {
      if (!isDownloaded || isNowPlaying) return null;

      const translateX = dragX.interpolate({
        inputRange: [0, ACTION_WIDTH],
        outputRange: [-ACTION_WIDTH, 0],
        extrapolate: 'clamp',
      });

      return (
        <RNAnimated.View style={[styles.leftActionsContainer, { transform: [{ translateX }] }]}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isInQueue ? COLORS.accent : COLORS.queue }]}
            onPress={handleQueueToggle}
          >
            {isInQueue ? (
              <CheckIcon size={22} color="#000" />
            ) : (
              <QueueIcon size={22} color="#fff" />
            )}
            <Text style={[styles.actionText, isInQueue && { color: '#000' }]}>
              {isInQueue ? 'Queued' : 'Queue'}
            </Text>
          </TouchableOpacity>
        </RNAnimated.View>
      );
    },
    [isDownloaded, isNowPlaying, isInQueue, handleQueueToggle]
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      rightThreshold={SWIPE_THRESHOLD}
      leftThreshold={SWIPE_THRESHOLD}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      onSwipeableWillOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <Pressable style={styles.container} onPress={onPress}>
        {/* Cover */}
        <View style={styles.coverContainer}>
          <Image
            source={coverUrl}
            style={[styles.cover, !isDownloaded && !isDownloading && styles.coverNotDownloaded]}
            contentFit="cover"
          />
          {isDownloading && (
            <View style={styles.downloadingOverlay}>
              <Text style={styles.downloadingText}>{Math.round(progress * 100)}%</Text>
            </View>
          )}
          {isInQueue && isDownloaded && !isNowPlaying && (
            <View style={styles.queueBadge}>
              <CheckIcon size={10} color="#000" />
            </View>
          )}
        </View>

        {/* Book info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {author}{durationText ? ` · ${durationText}` : ''}
          </Text>
          {showListeningProgress && progressPercent > 0 && (
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>{progressPercent}%</Text>
            </View>
          )}
        </View>

        {/* Status indicators */}
        <View style={styles.statusContainer}>
          {isDownloaded && (
            <View style={styles.downloadedBadge}>
              <CheckIcon size={12} color={COLORS.accent} />
            </View>
          )}
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    backgroundColor: COLORS.background,
  },
  coverContainer: {
    position: 'relative',
  },
  cover: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(8),
    backgroundColor: '#262626',
  },
  coverNotDownloaded: {
    opacity: 0.6,
  },
  downloadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadingText: {
    fontSize: scale(10),
    fontWeight: '600',
    color: '#fff',
  },
  queueBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: scale(12),
    justifyContent: 'center',
  },
  title: {
    fontSize: scale(15),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: scale(13),
    color: COLORS.textSecondary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 1.5,
  },
  progressText: {
    fontSize: scale(11),
    color: COLORS.textTertiary,
    minWidth: 30,
  },
  statusContainer: {
    paddingLeft: scale(8),
  },
  downloadedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  leftActionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  actionButton: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#fff',
    marginTop: 4,
  },
});

export default SwipeableBookCard;
