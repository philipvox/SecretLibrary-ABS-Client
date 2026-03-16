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
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {
  Download,
  Play,
  Plus,
  Check,
  Cloud,
  CloudOff,
  Bookmark,
  Pause,
} from 'lucide-react-native';
import { useCoverUrl } from '@/core/cache';
import type { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { useDownloads } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { useQueueStore, useIsInQueue } from '@/features/queue/stores/queueStore';
import { usePlayerStore } from '@/features/player';
import { useNetworkStatus } from './NetworkStatusBar';
import { useWishlistStore, useIsOnWishlist } from '@/features/wishlist';
import {
  colors,
  spacing,
  radius,
  layout,
  typography,
  scale,
  formatDuration,
  iconSizes,
} from '@/shared/theme';
import { useTheme, ThemeColors } from '@/shared/theme';
import { ThumbnailProgressBar } from './ThumbnailProgressBar';

// Helper to get book metadata safely
function getBookMetadata(item: LibraryItem): BookMetadata | null {
  if (item.mediaType !== 'book' || !item.media?.metadata) return null;
  return item.media.metadata as BookMetadata;
}

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media;
}

// Helper to get semantic colors from ThemeColors
function getSemanticColors(c: ThemeColors) {
  return {
    warning: c.semantic.warning, // Orange - paused state
    error: c.semantic.error,
    success: c.semantic.success,
    iconInverse: c.icon.inverse, // White on dark backgrounds
  };
}

// Inline Progress Bar for book cards (UX: visual progress + time remaining)
const InlineProgressBar = ({ progress, height = 4 }: { progress: number; height?: number }) => {
  const fillPercent = Math.min(Math.max(progress * 100, 0), 100);

  return (
    <View style={[inlineProgressStyles.container, { height: scale(height) }]}>
      <View style={[inlineProgressStyles.fill, { width: `${fillPercent}%` }]} />
    </View>
  );
};

const inlineProgressStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.progressTrack,
    borderRadius: scale(2),
    overflow: 'hidden',
  } as ViewStyle,
  fill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: scale(2),
  } as ViewStyle,
});

// Progress Ring for downloading
const ProgressRing = ({ progress, size = 28, isPaused = false, warningColor }: { progress: number; size?: number; isPaused?: boolean; warningColor?: string }) => {
  const strokeWidth = 2.5;
  const ringRadius = (size - strokeWidth) / 2;
  const circumference = ringRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const progressPct = Math.round(progress);
  const pausedColor = warningColor || colors.warning; // Use theme warning color
  const progressColor = isPaused ? pausedColor : colors.textPrimary;

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
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {isPaused ? (
        <Pause size={size * 0.4} color={pausedColor} fill={pausedColor} strokeWidth={0} />
      ) : (
        <Text style={styles.progressText}>{progressPct === 0 ? '...' : `${progressPct}%`}</Text>
      )}
    </View>
  );
};

export type BookCardActionType = 'auto' | 'download' | 'play';

/** Page context for context-aware secondary info (NNGroup Heuristic #8 - Minimalist Design) */
export type BookCardContext = 'browse' | 'library' | 'author_detail' | 'narrator_detail' | 'series_detail';

/** Layout variant for different contexts */
export type BookCardLayout = 'default' | 'search';

export interface BookCardProps {
  book: LibraryItem;
  onPress: () => void;
  /** Callback when card is long-pressed - shows context menu if provided */
  onLongPress?: () => void;
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
  /** Show wishlist bookmark button on cover top-right */
  showWishlistButton?: boolean;
  /** Layout variant:
   * - default: Title first, then author (standard)
   * - search: Author first (gray), then title (bold) - per reference design
   */
  layout?: BookCardLayout;
  /** Show play button overlay on cover */
  showPlayOverlay?: boolean;
}

export function BookCard({
  book,
  onPress,
  onLongPress,
  showListeningProgress = true,
  actionType = 'auto',
  onPlayPress,
  context = 'browse',
  showStatusBadge = false,
  showWishlistButton = false,
  layout = 'default',
  showPlayOverlay = false,
}: BookCardProps) {
  // Theme colors
  const { colors } = useTheme();
  const semanticColors = getSemanticColors(colors);

  // State from hooks
  const { isDownloaded, isDownloading, isPaused, isPending, progress } = useDownloadStatus(book.id);
  const isInQueue = useIsInQueue(book.id);
  const currentBookId = usePlayerStore((s) => s.currentBook?.id);
  const isNowPlaying = currentBookId === book.id;
  const isOnline = useNetworkStatus();

  // Wishlist state
  const isOnWishlist = useIsOnWishlist(book.id);
  const addFromLibraryItem = useWishlistStore((s) => s.addFromLibraryItem);
  const removeItem = useWishlistStore((s) => s.removeItem);
  const getWishlistItemByLibraryId = useWishlistStore((s) => s.getWishlistItemByLibraryId);

  // Determine if book is unavailable (offline + not downloaded)
  const isUnavailableOffline = !isOnline && !isDownloaded && !isDownloading;

  // Actions
  const { queueDownload } = useDownloads();
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);

  // Animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const wishlistScaleAnim = useRef(new Animated.Value(1)).current;

  // Get metadata
  const coverUrl = useCoverUrl(book.id);
  // Tiny placeholder for blur-up effect (~200 bytes loads instantly)
  const coverPlaceholderUrl = useCoverUrl(book.id, { thumb: true });
  const metadata = getBookMetadata(book);
  const title = metadata?.title || 'Untitled';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata?.narratorName || metadata?.narrators?.[0] || '';
  const duration = isBookMedia(book.media) ? book.media.duration || 0 : 0;
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
  const userProgress = book.userMediaProgress;
  const progressPercent = userProgress?.progress ? Math.round(userProgress.progress * 100) : 0;
  const progressValue = userProgress?.progress || 0;

  // Calculate time remaining (UX: show time remaining, not percentage)
  const timeRemaining = duration > 0 && progressValue > 0 && progressValue < 1
    ? Math.round(duration * (1 - progressValue))
    : 0;

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

  // Handle wishlist toggle
  const handleWishlistPress = useCallback(() => {
    // Bounce animation
    Animated.sequence([
      Animated.timing(wishlistScaleAnim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(wishlistScaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    if (isOnWishlist) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const wishlistItem = getWishlistItemByLibraryId(book.id);
      if (wishlistItem) {
        removeItem(wishlistItem.id);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addFromLibraryItem(book.id);
    }
  }, [book.id, isOnWishlist, addFromLibraryItem, removeItem, getWishlistItemByLibraryId, wishlistScaleAnim]);

  // Handle long press for context menu
  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLongPress();
    }
  }, [onLongPress]);

  return (
    <View style={styles.container}>
      {/* Pressable card area - navigates to BookDetail */}
      <Pressable
        style={styles.cardPressable}
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        {/* Cover with optional queue button overlay */}
        <View style={styles.coverContainer}>
          <Image
            source={coverUrl}
            placeholder={coverPlaceholderUrl ? { uri: coverPlaceholderUrl } : undefined}
            placeholderContentFit="cover"
            style={[
              styles.cover,
              !isDownloaded && !isDownloading && styles.coverNotDownloaded,
              isUnavailableOffline && styles.coverUnavailable,
            ]}
            contentFit="cover"
            transition={200}
          />

          {/* Progress bar overlay at bottom of cover */}
          {showListeningProgress && (
            <ThumbnailProgressBar progress={userProgress?.progress || 0} />
          )}

          {/* Play button overlay on cover (for search layout) */}
          {showPlayOverlay && onPlayPress && (
            <TouchableOpacity
              style={styles.playOverlay}
              onPress={handlePlayPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Play size={iconSizes.sm} color={semanticColors.iconInverse} fill={semanticColors.iconInverse} />
            </TouchableOpacity>
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
                  <Check size={iconSizes.xs} color={colors.background.primary} strokeWidth={3} />
                ) : (
                  <Plus size={iconSizes.xs} color={colors.text.primary} strokeWidth={3} />
                )}
              </Animated.View>
            </TouchableOpacity>
          )}

          {/* Download/Stream status badge */}
          {showStatusBadge && !isDownloading && (
            <View style={[
              styles.statusBadge,
              isDownloaded ? styles.downloadedBadge :
              isUnavailableOffline ? styles.offlineBadge :
              [styles.streamBadge, { backgroundColor: colors.feature.streaming }]
            ]}>
              {isDownloaded ? (
                <Check size={10} color={colors.text.inverse} strokeWidth={3} />
              ) : isUnavailableOffline ? (
                <CloudOff size={10} color={colors.text.primary} />
              ) : (
                <Cloud size={10} color={colors.text.primary} />
              )}
            </View>
          )}

          {/* Wishlist bookmark button on cover */}
          {showWishlistButton && (
            <TouchableOpacity
              style={[styles.wishlistButton, isOnWishlist && styles.wishlistButtonActive]}
              onPress={handleWishlistPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.View style={{ transform: [{ scale: wishlistScaleAnim }] }}>
                <Bookmark
                  size={iconSizes.xs}
                  color={isOnWishlist ? colors.background.primary : colors.text.primary}
                  fill={isOnWishlist ? colors.background.primary : 'none'}
                />
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>

        {/* Book info */}
        <View style={styles.info}>
          {layout === 'search' ? (
            <>
              {/* Search layout: Author first (gray), then title (bold) */}
              <Text style={[styles.searchAuthor, { color: colors.text.secondary }]} numberOfLines={1}>
                {secondaryPerson}
              </Text>
              <Text style={[styles.searchTitle, { color: colors.text.primary }]} numberOfLines={2}>
                {title}
              </Text>
            </>
          ) : (
            <>
              {/* Default layout: Title first, then author */}
              <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.text.secondary }]} numberOfLines={1}>
                {secondaryPerson}{durationText ? ` · ${durationText}` : ''}
              </Text>
              {showListeningProgress && progressPercent > 0 && (
                <View style={styles.progressRow}>
                  <InlineProgressBar progress={progressValue} />
                  <Text style={[styles.listeningProgress, { color: colors.text.tertiary }]}>
                    {timeRemaining > 0 ? `${formatDuration.short(timeRemaining)} left` : 'Complete'}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </Pressable>

      {/* Right side action - context-dependent */}
      {/* Download action (browse context) - disabled when offline */}
      {(actionType === 'auto' || actionType === 'download') && !isDownloaded && (
        <TouchableOpacity
          style={[styles.actionButton, isUnavailableOffline && styles.actionButtonDisabled]}
          onPress={isUnavailableOffline ? undefined : handleDownloadPress}
          disabled={isUnavailableOffline}
        >
          {isDownloading || isPaused || isPending ? (
            <ProgressRing progress={progress * 100} size={scale(28)} isPaused={isPaused} warningColor={semanticColors.warning} />
          ) : isUnavailableOffline ? (
            <CloudOff size={iconSizes.md} color={colors.text.tertiary} />
          ) : (
            <Download size={iconSizes.md} color={colors.text.secondary} />
          )}
        </TouchableOpacity>
      )}

      {/* Play action (library context) */}
      {actionType === 'play' && isDownloaded && !isNowPlaying && onPlayPress && (
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPress}
        >
          <Play size={iconSizes.sm} color={colors.background.primary} fill={colors.background.primary} />
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
  } as ViewStyle,
  cardPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  } as ViewStyle,
  coverContainer: {
    position: 'relative',
  } as ViewStyle,
  cover: {
    width: scale(64),
    height: scale(64),
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundElevated,
  } as ImageStyle,
  coverNotDownloaded: {
    // Full opacity - don't dim covers
  } as ImageStyle,
  coverUnavailable: {
    // Full opacity - don't dim covers
  } as ImageStyle,
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
    borderColor: colors.border.default,
  } as ViewStyle,
  queueButtonActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  } as ViewStyle,
  statusBadge: {
    position: 'absolute',
    bottom: spacing.xxs,
    left: spacing.xxs,
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  downloadedBadge: {
    backgroundColor: colors.accent.primary,
  } as ViewStyle,
  streamBadge: {
    // backgroundColor set dynamically via colors.feature.streaming
  } as ViewStyle,
  offlineBadge: {
    backgroundColor: colors.error,
  } as ViewStyle,
  wishlistButton: {
    position: 'absolute',
    top: spacing.xxs,
    right: spacing.xxs,
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  } as ViewStyle,
  wishlistButtonActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  } as ViewStyle,
  info: {
    flex: 1,
    marginLeft: scale(14),
    justifyContent: 'center',
  } as ViewStyle,
  title: {
    ...typography.headlineSmall,
    // color set via themeColors in JSX
    marginBottom: spacing.xxs,
  } as TextStyle,
  subtitle: {
    ...typography.bodySmall,
    // color set via themeColors in JSX
    marginBottom: spacing.xxs,
  } as TextStyle,
  // Search layout styles
  searchAuthor: {
    ...typography.bodySmall,
    // color set via themeColors in JSX
    marginBottom: spacing.xxs,
  } as TextStyle,
  searchTitle: {
    ...typography.headlineSmall,
    // color set via themeColors in JSX
    fontWeight: '600',
    lineHeight: scale(18),
  } as TextStyle,
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: scale(-14),
    marginLeft: scale(-14),
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: scale(2), // Offset for visual centering of play icon
  } as ViewStyle,
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxs,
  } as ViewStyle,
  listeningProgress: {
    ...typography.labelSmall,
    // color set via themeColors in JSX
    flexShrink: 0,
  } as TextStyle,
  actionButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  actionButtonDisabled: {
    opacity: 0.5,
  } as ViewStyle,
  playButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: scale(2), // Offset for visual centering of play icon
  } as ViewStyle,
  progressText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  } as TextStyle,
});

export default BookCard;
