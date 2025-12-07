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
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

// Colors - minimal accent usage
const COLORS = {
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textTertiary: 'rgba(255, 255, 255, 0.4)',
  accent: '#CCFF00',
  coverOverlay: 'rgba(0,0,0,0.5)',
};

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

// Progress Ring for downloading
const ProgressRing = ({ progress, size = 28 }: { progress: number; size?: number }) => {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
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
          stroke="#fff"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.progressText}>{Math.round(progress)}%</Text>
    </View>
  );
};

export interface BookCardProps {
  book: LibraryItem;
  onPress: () => void;
  showListeningProgress?: boolean;
}

export function BookCard({
  book,
  onPress,
  showListeningProgress = true,
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

  // Get listening progress
  const userProgress = (book as any).userMediaProgress;
  const progressPercent = userProgress?.progress ? Math.round(userProgress.progress * 100) : 0;

  // Handle download press
  const handleDownloadPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    queueDownload(book);
  }, [book, queueDownload]);

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

          {/* Queue button on cover - only for downloaded books */}
          {isDownloaded && !isNowPlaying && (
            <TouchableOpacity
              style={[styles.queueButton, isInQueue && styles.queueButtonActive]}
              onPress={handleQueuePress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                {isInQueue ? (
                  <CheckIcon size={12} color="#000" />
                ) : (
                  <SmallPlusIcon size={12} color="#fff" />
                )}
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>

        {/* Book info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
          {showListeningProgress && progressPercent > 0 && (
            <Text style={styles.listeningProgress}>{progressPercent}% complete</Text>
          )}
        </View>
      </Pressable>

      {/* Right side action - download or progress */}
      {!isDownloaded && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={isDownloading ? undefined : handleDownloadPress}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ProgressRing progress={progress * 100} size={scale(28)} />
          ) : (
            <DownloadIcon size={scale(20)} color="rgba(255,255,255,0.7)" />
          )}
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
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
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
    borderRadius: scale(6),
    backgroundColor: '#262626',
  },
  coverNotDownloaded: {
    opacity: 0.7,
  },
  queueButton: {
    position: 'absolute',
    bottom: scale(2),
    right: scale(2),
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    backgroundColor: COLORS.coverOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  queueButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  info: {
    flex: 1,
    marginLeft: scale(12),
    justifyContent: 'center',
  },
  title: {
    fontSize: scale(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: scale(2),
  },
  author: {
    fontSize: scale(12),
    color: COLORS.textSecondary,
    marginBottom: scale(2),
  },
  listeningProgress: {
    fontSize: scale(11),
    color: COLORS.textTertiary,
  },
  actionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: scale(8),
    fontWeight: '600',
    color: '#fff',
  },
});

export default BookCard;
