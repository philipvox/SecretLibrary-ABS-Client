/**
 * src/features/home/components/CompactNowPlaying.tsx
 *
 * Compact Now Playing card for Home screen (~25% of screen height)
 * Horizontal layout with cover, info, progress, and inline controls
 * Tap card (not controls) to open full player
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import {
  colors,
  spacing,
  radius,
  scale,
  elevation,
} from '@/shared/theme';

// Button assets
const RewindButtonImage = require('../assets/rewind-button.png');
const FastForwardButtonImage = require('../assets/fast-forward-button.png');
const PlayButtonImage = require('../assets/play-button.png');
const PauseButtonImage = require('../assets/pause-button.png');

const COVER_SIZE = scale(80);
const BUTTON_SIZE = scale(44);
const CARD_PADDING = spacing.lg;
const ACCENT = colors.accent;

interface CompactNowPlayingProps {
  book: LibraryItem;
  isPlaying: boolean;
  isLoading?: boolean;
  progress: number; // 0-1
  currentTime: number; // seconds
  duration: number; // seconds
  currentChapter?: number;
  totalChapters?: number;
  isSeeking?: boolean;
  seekDirection?: 'forward' | 'backward' | null;
  seekMagnitude?: number;
  onPress: () => void;
  onPlayPause: () => void;
  onSkipBackPressIn: () => void;
  onSkipBackPressOut: () => void;
  onSkipForwardPressIn: () => void;
  onSkipForwardPressOut: () => void;
}

/**
 * Format time remaining in human-readable format
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0m left';

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${mins}m left`;
  }
  return `${mins}m left`;
}

/**
 * Format seek time with appropriate units
 */
function formatSeekTime(seconds: number): string {
  const absSeconds = Math.abs(Math.round(seconds));
  if (absSeconds >= 300) {
    const mins = Math.floor(absSeconds / 60);
    return `${mins}m`;
  }
  return `${absSeconds}s`;
}

/**
 * Get author from book metadata
 */
function getAuthor(book: LibraryItem): string {
  const metadata = book.media?.metadata as any;
  if (!metadata) return '';

  if (metadata.authorName) return metadata.authorName;

  if (metadata.authors?.length > 0) {
    return metadata.authors.map((a: any) => a.name).join(', ');
  }

  return '';
}

export function CompactNowPlaying({
  book,
  isPlaying,
  isLoading,
  progress,
  currentTime,
  duration,
  currentChapter,
  totalChapters,
  isSeeking,
  seekDirection,
  seekMagnitude = 0,
  onPress,
  onPlayPause,
  onSkipBackPressIn,
  onSkipBackPressOut,
  onSkipForwardPressIn,
  onSkipForwardPressOut,
}: CompactNowPlayingProps) {
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = book.media?.metadata?.title || 'Unknown Title';
  const author = getAuthor(book);
  const timeRemaining = duration - currentTime;
  const progressPercent = Math.round(progress * 100);

  const chapterText = currentChapter && totalChapters
    ? `Chapter ${currentChapter} of ${totalChapters}`
    : null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Blurred background */}
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={coverUrl}
          style={styles.backgroundImage}
          contentFit="cover"
          blurRadius={40}
        />
        {/* BlurView for Android (blurRadius only works on iOS) */}
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Card content */}
      <View style={styles.content}>
        {/* Left side: Cover */}
        <View style={styles.coverContainer}>
          <Image
            source={coverUrl}
            style={styles.cover}
            contentFit="cover"
            transition={200}
          />
        </View>

        {/* Middle: Info and progress */}
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
          {chapterText && (
            <Text style={styles.chapter} numberOfLines={1}>
              {chapterText}
            </Text>
          )}

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
              />
            </View>
            <Text style={styles.timeRemaining}>
              {formatTimeRemaining(timeRemaining)}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom: Controls */}
      <View style={styles.controlsContainer}>
        {/* Seek indicator - left */}
        <Text style={[
          styles.seekIndicator,
          styles.seekIndicatorLeft,
          isSeeking && seekDirection === 'backward' && styles.seekIndicatorActiveRewind,
        ]}>
          {isSeeking && seekDirection === 'backward' ? `-${formatSeekTime(seekMagnitude)}` : ''}
        </Text>

        {/* Control buttons */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPressIn={onSkipBackPressIn}
            onPressOut={onSkipBackPressOut}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Image
              source={RewindButtonImage}
              style={styles.controlButton}
              contentFit="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onPlayPause}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Image
              source={isPlaying ? PauseButtonImage : PlayButtonImage}
              style={styles.playButton}
              contentFit="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPressIn={onSkipForwardPressIn}
            onPressOut={onSkipForwardPressOut}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Image
              source={FastForwardButtonImage}
              style={styles.controlButton}
              contentFit="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Seek indicator - right */}
        <Text style={[
          styles.seekIndicator,
          styles.seekIndicatorRight,
          isSeeking && seekDirection === 'forward' && styles.seekIndicatorActiveForward,
        ]}>
          {isSeeking && seekDirection === 'forward' ? `+${formatSeekTime(seekMagnitude)}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Empty state when nothing is playing
 */
export function NothingPlayingCard({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyContent}>
        <Ionicons name="headset-outline" size={scale(32)} color="rgba(255,255,255,0.5)" />
        <Text style={styles.emptyTitle}>Ready to listen?</Text>
        <Text style={styles.emptySubtitle}>
          Pick up where you left off or start something new.
        </Text>
        <TouchableOpacity style={styles.emptyButton} onPress={onBrowse}>
          <Text style={styles.emptyButtonText}>Browse Library</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.backgroundTertiary,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    padding: CARD_PADDING,
    paddingBottom: scale(12),
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    ...elevation.medium,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  title: {
    fontSize: scale(16),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  author: {
    fontSize: scale(13),
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  chapter: {
    fontSize: scale(12),
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  progressBarBackground: {
    flex: 1,
    height: scale(4),
    backgroundColor: colors.progressTrack,
    borderRadius: radius.xxs,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.progressFill,
    borderRadius: radius.xxs,
  },
  timeRemaining: {
    fontSize: scale(11),
    color: colors.textSecondary,
    minWidth: scale(60),
    textAlign: 'right',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: CARD_PADDING,
    paddingBottom: CARD_PADDING,
    paddingTop: scale(4),
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
  },
  controlButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  playButton: {
    width: scale(52),
    height: scale(52),
  },
  seekIndicator: {
    fontSize: scale(11),
    minWidth: scale(50),
    color: 'transparent',
  },
  seekIndicatorLeft: {
    textAlign: 'left',
    flex: 1,
  },
  seekIndicatorRight: {
    textAlign: 'right',
    flex: 1,
  },
  seekIndicatorActiveRewind: {
    color: '#ff4444',
  },
  seekIndicatorActiveForward: {
    color: ACCENT,
  },

  // Empty state styles
  emptyContainer: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.cardBackground,
    overflow: 'hidden',
  },
  emptyContent: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: scale(13),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: scale(18),
  },
  emptyButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
  },
  emptyButtonText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: colors.backgroundPrimary,
  },
});
