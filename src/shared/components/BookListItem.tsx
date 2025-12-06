/**
 * src/shared/components/BookListItem.tsx
 *
 * Shared list item component for displaying individual books
 * Used across all screens where books are shown (home, library, search, etc.)
 *
 * Design: Cover (50x50) | Title | Author | Progress | Queue + Heart + Download button
 * Swipeable left for delete action (optional)
 *
 * NN/g UX Pattern: Download button replaces Play button
 * - Not downloaded: Download icon (starts download)
 * - Downloading: Progress %
 * - Queued: Clock icon
 * - Downloaded: Checkmark (tapping opens BookDetail)
 */

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Alert, Animated, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle } from 'react-native-svg';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import { useCoverUrl } from '@/core/cache';
import type { LibraryItem } from '@/core/types';
import { HeartIcon } from './HeartButton';
import { useMyLibraryStore } from '@/features/library/stores/myLibraryStore';
import { useQueueStore, useIsInQueue } from '@/features/queue';
import { autoDownloadService } from '@/features/downloads/services/autoDownloadService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

// Colors
const COLORS = {
  background: 'transparent',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textTertiary: 'rgba(255, 255, 255, 0.4)',
  heart: '#4ADE80',
  playButton: '#CCFF00',
  downloadButton: '#CCFF00',
  downloadComplete: '#4ADE80',
  downloadQueued: 'rgba(255, 255, 255, 0.5)',
  deleteAction: '#DC2626',
  heartAction: '#4ADE80',
};

// Play icon SVG
const PlayIcon = ({ size = 24, color = '#CCFF00' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 5.14v14.72a1 1 0 001.5.86l11.57-7.36a1 1 0 000-1.72L9.5 4.28a1 1 0 00-1.5.86z"
      fill={color}
    />
  </Svg>
);

// Trash icon SVG
const TrashIcon = ({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Heart icon SVG for swipe action
const HeartActionIcon = ({ size = 24, color = '#FFFFFF', filled = false }: { size?: number; color?: string; filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Queue Plus icon SVG
const QueuePlusIcon = ({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5v14M5 12h14"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Queue Checkmark icon SVG
const QueueCheckIcon = ({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 6L9 17l-5-5"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// "In Queue" text indicator
const InQueueIndicator = ({ color = '#4ADE80' }: { color?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
    <Text style={{ fontSize: scale(10), fontWeight: '600', color }}>in queue</Text>
    <Svg width={scale(10)} height={scale(10)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

// Download icon SVG (arrow pointing down into tray)
const DownloadIcon = ({ size = 24, color = '#CCFF00' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3v12m0 0l-4-4m4 4l4-4M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Clock icon SVG (for queued downloads)
const ClockIcon = ({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
    <Path
      d="M12 7v5l3 3"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Checkmark icon SVG (for completed downloads)
const CheckmarkIcon = ({ size = 24, color = '#4ADE80' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 6L9 17l-5-5"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export type DownloadIndicatorStatus = 'none' | 'queued' | 'downloading' | 'completed' | 'error';

export interface BookListItemProps {
  book: LibraryItem;
  onPress: () => void;
  onPlayPress?: () => void;
  onDownloadPress?: () => void; // Called when download button tapped (only if not downloaded)
  onDelete?: () => void;
  showProgress?: boolean;
  showSwipe?: boolean;
  seriesName?: string;       // Series name to display
  seriesSequence?: number;   // Sequence number (#1, #2, etc.)
  hideTitle?: boolean;       // Hide book title (for series page)
  hideQueueButton?: boolean; // Hide queue add button (for queue list)
  isLoadingThisBook?: boolean; // Show loading spinner on download action
  downloadStatus?: DownloadIndicatorStatus; // Show download status indicator
  downloadProgress?: number;  // Download progress (0-1)
}

// Right action component (delete)
function RightAction({
  drag,
  onPress
}: {
  drag: SharedValue<number>;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      drag.value,
      [-80, 0],
      [1, 0.5],
      'clamp'
    );
    return { transform: [{ scale }] };
  });

  return (
    <Pressable style={styles.deleteAction} onPress={onPress}>
      <Reanimated.View style={animatedStyle}>
        <TrashIcon size={24} color="#FFFFFF" />
      </Reanimated.View>
    </Pressable>
  );
}

// Left action component (heart)
function LeftAction({
  drag,
  onPress,
  filled,
}: {
  drag: SharedValue<number>;
  onPress: () => void;
  filled: boolean;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      drag.value,
      [0, 80],
      [0.5, 1],
      'clamp'
    );
    return { transform: [{ scale }] };
  });

  return (
    <Pressable style={styles.heartAction} onPress={onPress}>
      <Reanimated.View style={animatedStyle}>
        <HeartActionIcon size={24} color="#FFFFFF" filled={filled} />
      </Reanimated.View>
    </Pressable>
  );
}

export function BookListItem({
  book,
  onPress,
  onPlayPress,
  onDownloadPress,
  onDelete,
  showProgress = true,
  showSwipe = true,
  seriesName,
  seriesSequence,
  hideTitle = false,
  hideQueueButton = false,
  isLoadingThisBook = false,
  downloadStatus = 'none',
  downloadProgress = 0,
}: BookListItemProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const coverUrl = useCoverUrl(book.id);
  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Untitled';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';

  // Get favorite status and toggle function from store
  const isInLibrary = useMyLibraryStore((state) => state.libraryIds.includes(book.id));
  const addToLibrary = useMyLibraryStore((state) => state.addToLibrary);
  const removeFromLibrary = useMyLibraryStore((state) => state.removeFromLibrary);

  // Get queue state and function
  const isInQueue = useIsInQueue(book.id);
  const addToQueue = useQueueStore((state) => state.addToQueue);

  // State for "added to queue" toast animation
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastSlide = useRef(new Animated.Value(0)).current;

  // Get progress info
  const progress = (book as any).userMediaProgress;
  const progressPercent = progress?.progress ? Math.round(progress.progress * 100) : 0;

  const handleDelete = useCallback(() => {
    onDelete?.();
    swipeableRef.current?.close();
  }, [onDelete]);

  const handleHeart = useCallback(() => {
    if (isInLibrary) {
      // Show confirmation dialog before removing
      Alert.alert(
        'Remove from Library',
        `Remove "${title}" from your library?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              removeFromLibrary(book.id);
              swipeableRef.current?.close();
            },
          },
        ]
      );
    } else {
      addToLibrary(book.id);
      swipeableRef.current?.close();
    }
  }, [isInLibrary, book.id, title, addToLibrary, removeFromLibrary]);

  const handleQueueAdd = useCallback(() => {
    // Add to queue
    addToQueue(book);

    // Show toast animation
    setShowToast(true);
    toastOpacity.setValue(0);
    toastSlide.setValue(0);

    // Animate toast expanding from plus button
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(toastSlide, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Fade out after delay
      setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowToast(false));
      }, 800);
    });
  }, [book, addToQueue, toastOpacity, toastSlide]);

  // Auto-trigger action when swipe completes
  const handleSwipeOpen = useCallback((direction: 'left' | 'right') => {
    if (direction === 'left') {
      handleHeart();
    } else if (direction === 'right' && onDelete) {
      handleDelete();
    }
  }, [handleHeart, handleDelete, onDelete]);

  const renderRightActions = useCallback(
    (_prog: SharedValue<number>, drag: SharedValue<number>) => (
      <RightAction drag={drag} onPress={handleDelete} />
    ),
    [handleDelete]
  );

  const renderLeftActions = useCallback(
    (_prog: SharedValue<number>, drag: SharedValue<number>) => (
      <LeftAction drag={drag} onPress={handleHeart} filled={isInLibrary} />
    ),
    [handleHeart, isInLibrary]
  );

  const content = (
    <View style={styles.contentWrapper}>
      <View style={styles.container}>
        {/* Cover and Info - tapping opens player page */}
        <Pressable style={styles.coverInfoPressable} onPress={onPress}>
          {/* Cover with optional sequence badge and download indicator */}
          <View style={styles.coverContainer}>
            <Image source={coverUrl} style={styles.cover} contentFit="cover" />
            {seriesSequence !== undefined && (
              <View style={styles.sequenceBadge}>
                <Text style={styles.sequenceText}>#{seriesSequence}</Text>
              </View>
            )}
            {/* Download status indicators */}
            {downloadStatus === 'completed' && (
              <View style={styles.downloadBadge}>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 6L9 17l-5-5"
                    stroke="#C8FF00"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            )}
            {downloadStatus === 'downloading' && (
              <View style={styles.downloadingBadge}>
                <Text style={styles.downloadingText}>{Math.round(downloadProgress * 100)}%</Text>
              </View>
            )}
            {downloadStatus === 'queued' && (
              <View style={styles.queuedBadge}>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 2v10M12 18v4M12 14a2 2 0 100-4 2 2 0 000 4z"
                    stroke="#FFF"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            {/* Title row */}
            {!hideTitle && (
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
              </View>
            )}
            <Text style={styles.author} numberOfLines={1}>{author}</Text>
            {seriesName && (
              <Text style={styles.seriesNameText} numberOfLines={1}>{seriesName}</Text>
            )}
            {showProgress && (
              <Text style={styles.progress}>{progressPercent}% complete</Text>
            )}
          </View>
        </Pressable>

        {/* Action buttons: Queue + Heart + Download/Status */}
        <View style={styles.actionButtons}>
          {!hideQueueButton && (
            <Pressable style={styles.queueButton} onPress={isInQueue ? undefined : handleQueueAdd} disabled={isInQueue}>
              {isInQueue ? (
                <InQueueIndicator color={COLORS.heart} />
              ) : (
                <QueuePlusIcon size={scale(16)} color={COLORS.textTertiary} />
              )}
            </Pressable>
          )}
          <Pressable style={styles.heartIndicator} onPress={handleHeart}>
            <HeartIcon
              size={scale(12)}
              color={isInLibrary ? COLORS.heart : COLORS.textTertiary}
              filled={isInLibrary}
            />
          </Pressable>
          {/* Download/Status button - replaces Play per NN/g pattern */}
          <Pressable
            style={styles.downloadButton}
            onPress={
              downloadStatus === 'completed'
                ? onPress // Opens BookDetail when already downloaded
                : downloadStatus === 'none' || downloadStatus === 'error'
                ? onDownloadPress // Start download
                : undefined // Disabled while downloading/queued
            }
            disabled={isLoadingThisBook || downloadStatus === 'downloading' || downloadStatus === 'queued'}
          >
            {isLoadingThisBook ? (
              <ActivityIndicator size={scale(18)} color={COLORS.downloadButton} />
            ) : downloadStatus === 'completed' ? (
              <CheckmarkIcon size={scale(20)} color={COLORS.downloadComplete} />
            ) : downloadStatus === 'downloading' ? (
              <View style={styles.downloadProgressContainer}>
                <Text style={styles.downloadProgressText}>{Math.round(downloadProgress * 100)}%</Text>
              </View>
            ) : downloadStatus === 'queued' ? (
              <ClockIcon size={scale(18)} color={COLORS.downloadQueued} />
            ) : (
              <DownloadIcon size={scale(20)} color={COLORS.downloadButton} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Toast expanding out from plus button */}
      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [
                {
                  scaleX: toastSlide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  })
                },
                {
                  scaleY: toastSlide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  })
                }
              ]
            }
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>Added to Queue</Text>
          <QueuePlusIcon size={scale(12)} color="#000000" />
        </Animated.View>
      )}
    </View>
  );

  if (showSwipe) {
    return (
      <ReanimatedSwipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={onDelete ? renderRightActions : undefined}
        onSwipeableOpen={handleSwipeOpen}
        leftThreshold={60}
        rightThreshold={60}
        friction={2}
        overshootFriction={8}
        enableTrackpadTwoFingerGesture
        containerStyle={styles.swipeableContainer}
      >
        {content}
      </ReanimatedSwipeable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  contentWrapper: {
    position: 'relative',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(8),
    paddingHorizontal: scale(10),
    backgroundColor: COLORS.background,
  },
  coverInfoPressable: {
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
    borderRadius: scale(5),
    backgroundColor: '#262626',
  },
  sequenceBadge: {
    position: 'absolute',
    top: scale(2),
    left: scale(2),
    backgroundColor: COLORS.playButton,
    paddingHorizontal: scale(4),
    paddingVertical: scale(1),
    borderRadius: scale(3),
  },
  sequenceText: {
    fontSize: scale(9),
    fontWeight: '700',
    color: '#000000',
  },
  info: {
    flex: 1,
    marginLeft: scale(12),
  },
  titleRow: {
    marginBottom: scale(2),
  },
  title: {
    fontSize: scale(14),
    fontWeight: '500',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  author: {
    fontSize: scale(12),
    color: COLORS.textSecondary,
    marginBottom: scale(2),
  },
  seriesNameText: {
    fontSize: scale(11),
    color: COLORS.textTertiary,
    marginBottom: scale(2),
  },
  progress: {
    fontSize: scale(11),
    color: COLORS.textTertiary,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4), // Reduced gap since buttons are now larger
  },
  // NN/g: Minimum 44×44px touch targets
  queueButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartIndicator: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // NN/g: Download button replaces Play button
  downloadButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadProgressContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(200, 255, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadProgressText: {
    fontSize: scale(10),
    fontWeight: '700',
    color: COLORS.downloadButton,
  },
  deleteAction: {
    backgroundColor: COLORS.deleteAction,
    justifyContent: 'center',
    alignItems: 'center',
    width: scale(80),
  },
  heartAction: {
    backgroundColor: COLORS.heartAction,
    justifyContent: 'center',
    alignItems: 'center',
    width: scale(80),
  },
  swipeableContainer: {
    overflow: 'visible',
  },
  toast: {
    position: 'absolute',
    top: '50%',
    right: scale(88),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: '#4ADE80',
    paddingLeft: scale(10),
    paddingRight: scale(8),
    paddingVertical: scale(6),
    borderRadius: scale(14),
    marginTop: -scale(14),
  },
  toastText: {
    color: '#000000',
    fontSize: scale(11),
    fontWeight: '600',
  },
  // Download status indicators
  downloadBadge: {
    position: 'absolute',
    bottom: scale(2),
    right: scale(2),
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: scale(8),
    padding: scale(3),
  },
  downloadingBadge: {
    position: 'absolute',
    bottom: scale(2),
    right: scale(2),
    backgroundColor: 'rgba(200, 255, 0, 0.9)',
    borderRadius: scale(8),
    paddingHorizontal: scale(4),
    paddingVertical: scale(2),
  },
  downloadingText: {
    fontSize: scale(8),
    fontWeight: '700',
    color: '#000000',
  },
  queuedBadge: {
    position: 'absolute',
    bottom: scale(2),
    right: scale(2),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: scale(8),
    padding: scale(3),
  },
});
