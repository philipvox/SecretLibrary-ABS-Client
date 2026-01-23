/**
 * src/features/library/components/ContinueListeningHero.tsx
 *
 * Enhanced Continue Listening hero card for My Library screen.
 * Shows the most recently played in-progress book with:
 * - Large cover image with gold accent border
 * - Visual progress bar with percentage
 * - Time remaining text
 * - Current chapter info
 * - Narrator name
 * - One-tap play button for instant resume
 *
 * UX Pattern: Zeigarnik Effect - incomplete tasks are more memorable
 */

import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { LibraryItem, BookChapter, BookMedia, BookMetadata } from '@/core/types';
import { apiClient } from '@/core/api';
import { scale } from '@/shared/theme';
import { useColors } from '@/shared/theme/themeStore';

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'chapters' in media;
}

interface ContinueListeningHeroProps {
  /** The in-progress book to display */
  book: LibraryItem;
  /** Progress fraction (0-1) */
  progress: number;
  /** Remaining time in seconds */
  remainingSeconds: number;
  /** Current playback time in seconds (for chapter detection) */
  currentTime?: number;
  /** Called when play button is pressed (resume playback) */
  onPlay: () => void;
  /** Called when card is pressed (navigate to detail) */
  onPress: () => void;
}

/**
 * Format seconds to human-readable time remaining
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0m left';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/**
 * Get metadata from library item
 */
function getMetadata(item: LibraryItem): {
  title: string;
  author: string;
  narrator: string | null;
} {
  if (item.mediaType !== 'book' || !item.media?.metadata) {
    return { title: 'Unknown Title', author: 'Unknown Author', narrator: null };
  }
  const metadata = item.media.metadata as BookMetadata;
  const narrators = metadata.narrators || [];
  return {
    title: metadata.title || 'Unknown Title',
    author: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
    narrator: narrators.length > 0 ? narrators[0] : null,
  };
}

/**
 * Find current chapter based on playback time
 */
function getCurrentChapter(item: LibraryItem, currentTime: number): BookChapter | null {
  if (!isBookMedia(item.media)) return null;
  const chapters = item.media.chapters || [];
  if (chapters.length === 0) return null;

  // Find chapter where currentTime falls within start/end
  const chapter = chapters.find((ch: BookChapter) =>
    currentTime >= ch.start && currentTime < ch.end
  );

  return chapter || null;
}

export const ContinueListeningHero = memo(function ContinueListeningHero({
  book,
  progress,
  remainingSeconds,
  currentTime,
  onPlay,
  onPress,
}: ContinueListeningHeroProps) {
  const colors = useColors();
  const { title, author, narrator } = getMetadata(book);
  const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 400, height: 400 });
  const progressPercent = Math.round(progress * 100);

  // Get current chapter from userMediaProgress
  const playbackTime = currentTime ?? book.userMediaProgress?.currentTime ?? 0;
  const currentChapter = useMemo(
    () => getCurrentChapter(book, playbackTime),
    [book, playbackTime]
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: colors.player.accent }]}>
        Continue Listening
      </Text>

      <TouchableOpacity
        style={[styles.heroCard, {
          backgroundColor: colors.player.surface,
          borderColor: colors.player.accent,
        }]}
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Continue listening to ${title} by ${author}${narrator ? `, narrated by ${narrator}` : ''}${currentChapter ? `, ${currentChapter.title}` : ''}, ${progressPercent}% complete, ${formatTimeRemaining(remainingSeconds)}`}
        accessibilityHint="Double tap to view book details"
      >
        {/* Cover Image */}
        <Image
          source={coverUrl}
          style={styles.coverImage}
          contentFit="cover"
          transition={200}
        />

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', colors.player.overlayHeavy]}
          style={styles.gradient}
        />

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.player.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.author, { color: colors.player.textSecondary }]} numberOfLines={1}>
            {author}
          </Text>
          {narrator && (
            <Text style={[styles.narrator, { color: colors.player.textTertiary }]} numberOfLines={1}>
              Narrated by {narrator}
            </Text>
          )}

          {/* Chapter info */}
          {currentChapter && (
            <Text style={[styles.chapterInfo, { color: colors.player.accent }]} numberOfLines={1}>
              {currentChapter.title}
            </Text>
          )}

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarBackground, { backgroundColor: colors.player.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%`, backgroundColor: colors.player.accent }
                  ]}
                />
              </View>
              <Text style={[styles.progressPercent, { color: colors.player.accent }]}>
                {progressPercent}%
              </Text>
            </View>
            <Text style={[styles.timeRemaining, { color: colors.player.textSecondary }]}>
              {formatTimeRemaining(remainingSeconds)}
            </Text>
          </View>
        </View>

        {/* Play Button */}
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: colors.player.accent }]}
          onPress={onPlay}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Resume playing ${title}`}
          accessibilityHint="Double tap to resume playback"
        >
          <Play size={scale(28)} color={colors.text.inverse} fill={colors.text.inverse} strokeWidth={0} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: scale(20),
    marginBottom: scale(24),
  },

  sectionLabel: {
    fontSize: scale(13),
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: scale(10),
    textTransform: 'uppercase',
  },

  heroCard: {
    width: '100%',
    height: scale(200),
    borderRadius: scale(16),
    overflow: 'hidden',
    borderWidth: 2,
  },

  coverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },

  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '75%',
  },

  content: {
    position: 'absolute',
    left: scale(16),
    bottom: scale(16),
    right: scale(70), // Leave room for play button
  },

  title: {
    fontSize: scale(18),
    fontWeight: '700',
    marginBottom: scale(2),
  },

  author: {
    fontSize: scale(13),
    marginBottom: scale(2),
  },

  narrator: {
    fontSize: scale(11),
    marginBottom: scale(6),
    fontStyle: 'italic',
  },

  chapterInfo: {
    fontSize: scale(12),
    fontWeight: '500',
    marginBottom: scale(8),
  },

  progressSection: {
    gap: scale(4),
  },

  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },

  progressBarBackground: {
    flex: 1,
    height: scale(4),
    borderRadius: scale(2),
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    borderRadius: scale(2),
  },

  progressPercent: {
    fontSize: scale(12),
    fontWeight: '600',
    minWidth: scale(35),
    textAlign: 'right',
  },

  timeRemaining: {
    fontSize: scale(11),
  },

  playButton: {
    position: 'absolute',
    right: scale(16),
    bottom: scale(16),
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default ContinueListeningHero;
