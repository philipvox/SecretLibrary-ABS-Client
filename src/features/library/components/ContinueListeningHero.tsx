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
import { Ionicons } from '@expo/vector-icons';
import { LibraryItem, BookChapter } from '@/core/types';
import { apiClient } from '@/core/api';
import { colors, scale } from '@/shared/theme';

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
  const metadata = (item.media?.metadata as any) || {};
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
  const chapters = (item.media as any)?.chapters || [];
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
  const { title, author, narrator } = getMetadata(book);
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const progressPercent = Math.round(progress * 100);

  // Get current chapter from userMediaProgress
  const playbackTime = currentTime ?? (book as any).userMediaProgress?.currentTime ?? 0;
  const currentChapter = useMemo(
    () => getCurrentChapter(book, playbackTime),
    [book, playbackTime]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Continue Listening</Text>

      <TouchableOpacity
        style={styles.heroCard}
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Continue listening to ${title} by ${author}${narrator ? `, narrated by ${narrator}` : ''}${currentChapter ? `, ${currentChapter.title}` : ''}, ${progressPercent}% complete, ${formatTimeRemaining(remainingSeconds)}`}
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
          colors={['transparent', 'rgba(0,0,0,0.95)']}
          style={styles.gradient}
        />

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
          {narrator && (
            <Text style={styles.narrator} numberOfLines={1}>
              Narrated by {narrator}
            </Text>
          )}

          {/* Chapter info */}
          {currentChapter && (
            <Text style={styles.chapterInfo} numberOfLines={1}>
              {currentChapter.title}
            </Text>
          )}

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>
            <Text style={styles.timeRemaining}>
              {formatTimeRemaining(remainingSeconds)}
            </Text>
          </View>
        </View>

        {/* Play Button */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={onPlay}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Resume playing ${title}`}
        >
          <Ionicons name="play" size={scale(28)} color="#000" />
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
    color: colors.accent,
    letterSpacing: 0.5,
    marginBottom: scale(10),
    textTransform: 'uppercase',
  },

  heroCard: {
    width: '100%',
    height: scale(200),
    borderRadius: scale(16),
    overflow: 'hidden',
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.accent,
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
    color: colors.textPrimary,
    marginBottom: scale(2),
  },

  author: {
    fontSize: scale(13),
    color: colors.textSecondary,
    marginBottom: scale(2),
  },

  narrator: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
    marginBottom: scale(6),
    fontStyle: 'italic',
  },

  chapterInfo: {
    fontSize: scale(12),
    color: colors.accent,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: scale(2),
  },

  progressPercent: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.accent,
    minWidth: scale(35),
    textAlign: 'right',
  },

  timeRemaining: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.6)',
  },

  playButton: {
    position: 'absolute',
    right: scale(16),
    bottom: scale(16),
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: colors.accent,
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
