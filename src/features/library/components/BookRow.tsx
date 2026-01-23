/**
 * src/features/library/components/BookRow.tsx
 *
 * Book row component for library lists.
 * Shows cover, title, author, progress, and play button.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Play, CheckCircle } from 'lucide-react-native';
import { apiClient } from '@/core/api';
import { scale, spacing, useTheme } from '@/shared/theme';
import { EnrichedBook, formatDuration, formatTimeAgo } from '../types';

interface BookRowProps {
  book: EnrichedBook;
  onPress: () => void;
  onPlay: () => void;
  isMarkedFinished?: boolean;
}

export const BookRow = React.memo(function BookRow({
  book,
  onPress,
  onPlay,
  isMarkedFinished = false,
}: BookRowProps) {
  const { colors } = useTheme();
  const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 400, height: 400 });
  const isCompleted = book.progress >= 0.95 || isMarkedFinished;
  const isInProgress = book.progress > 0 && book.progress < 0.95;

  const progressText = isInProgress
    ? `, ${Math.round(book.progress * 100)}% complete`
    : isCompleted ? ', completed' : '';

  // Format last played time
  const lastPlayedText = book.lastPlayedAt ? formatTimeAgo(book.lastPlayedAt) : '';

  return (
    <TouchableOpacity
      style={styles.bookRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${book.title} by ${book.author}${progressText}`}
      accessibilityRole="button"
      accessibilityHint="Double tap to view book details"
    >
      <View style={styles.bookCoverContainer}>
        <Image source={coverUrl} style={styles.bookCover} contentFit="cover" />
        {isCompleted && (
          <View style={styles.completedBadge}>
            <CheckCircle size={14} color={colors.text.primary} strokeWidth={2} />
          </View>
        )}
      </View>

      <View style={styles.bookInfo}>
        <Text style={[styles.bookTitle, { color: colors.text.primary }]} numberOfLines={1}>
          {book.title}
        </Text>
        <Text style={[styles.bookAuthor, { color: colors.text.secondary }]} numberOfLines={1}>
          {book.author}
        </Text>
        <View style={styles.bookMetaRow}>
          <Text style={[styles.bookMeta, { color: colors.text.secondary }]}>
            {formatDuration(book.duration)}
          </Text>
          {isInProgress && (
            <>
              <Text style={[styles.bookMeta, { color: colors.text.tertiary }]}>·</Text>
              <Text style={[styles.bookProgress, { color: colors.text.primary }]}>
                {Math.round(book.progress * 100)}%
              </Text>
            </>
          )}
          {lastPlayedText && (
            <>
              <Text style={[styles.bookMeta, { color: colors.text.tertiary }]}>·</Text>
              <Text style={[styles.bookMeta, { color: colors.text.tertiary }]}>
                {lastPlayedText}
              </Text>
            </>
          )}
        </View>
        {/* Progress bar for in-progress books */}
        {isInProgress && (
          <View style={[styles.bookProgressBar, { backgroundColor: colors.border.default }]}>
            <View
              style={[
                styles.bookProgressFill,
                { width: `${book.progress * 100}%`, backgroundColor: colors.text.primary }
              ]}
            />
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.playButton, { backgroundColor: colors.text.primary }]}
        onPress={onPlay}
        activeOpacity={0.7}
        accessibilityLabel={`Play ${book.title}`}
        accessibilityRole="button"
      >
        <Play size={14} color={colors.background.primary} fill={colors.background.primary} strokeWidth={0} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: scale(10),
    gap: scale(12),
  },
  bookCoverContainer: {
    position: 'relative',
    width: scale(60),
    height: scale(60),
    borderRadius: scale(8),
    overflow: 'hidden',
  },
  bookCover: {
    width: '100%',
    height: '100%',
    borderRadius: scale(8),
  },
  completedBadge: {
    position: 'absolute',
    top: scale(4),
    left: scale(4),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: scale(15),
    fontWeight: '600',
    marginBottom: 2,
  },
  bookAuthor: {
    fontSize: scale(13),
    marginBottom: 4,
  },
  bookMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  bookMeta: {
    fontSize: scale(12),
  },
  bookProgress: {
    fontSize: scale(12),
    fontWeight: '600',
  },
  bookProgressBar: {
    height: 3,
    borderRadius: 1.5,
    marginTop: scale(6),
    overflow: 'hidden',
  },
  bookProgressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  playButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BookRow;
