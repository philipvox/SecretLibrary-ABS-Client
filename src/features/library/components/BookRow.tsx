/**
 * src/features/library/components/BookRow.tsx
 *
 * Book row component for library lists.
 * Shows cover, title, author, progress, and play button.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Play, CheckCircle, Cloud } from 'lucide-react-native';
import { apiClient } from '@/core/api';
import { scale, spacing } from '@/shared/theme';
import { useThemeColors } from '@/shared/theme/themeStore';
import { EnrichedBook, formatDuration } from '../types';

interface BookRowProps {
  book: EnrichedBook;
  onPress: () => void;
  onPlay: () => void;
  showIndicator?: boolean;
  isMarkedFinished?: boolean;
}

export const BookRow = React.memo(function BookRow({
  book,
  onPress,
  onPlay,
  showIndicator = true,
  isMarkedFinished = false,
}: BookRowProps) {
  const themeColors = useThemeColors();
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const isCompleted = book.progress >= 0.95 || isMarkedFinished;
  const isDownloaded = book.isDownloaded || book.totalBytes > 0;

  const progressText = book.progress > 0 && book.progress < 0.95
    ? `, ${Math.round(book.progress * 100)}% complete`
    : isCompleted ? ', completed' : '';
  const downloadText = isDownloaded ? ', downloaded' : '';

  return (
    <TouchableOpacity
      style={styles.bookRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${book.title} by ${book.author}${progressText}${downloadText}`}
      accessibilityRole="button"
      accessibilityHint="Double tap to view book details"
    >
      <View style={styles.bookCoverContainer}>
        <Image source={coverUrl} style={styles.bookCover} contentFit="cover" />
        {/* Download/Stream indicator */}
        {showIndicator && (
          <View style={[
            styles.statusBadge,
            isDownloaded
              ? [styles.downloadedBadge, { backgroundColor: themeColors.text }]
              : styles.streamBadge
          ]}>
            {isDownloaded ? (
              <CheckCircle size={scale(10)} color={themeColors.background} strokeWidth={2.5} />
            ) : (
              <Cloud size={scale(10)} color={themeColors.background} strokeWidth={2} />
            )}
          </View>
        )}
        {isCompleted && (
          <View style={styles.completedBadge}>
            <CheckCircle size={14} color={themeColors.text} strokeWidth={2} />
          </View>
        )}
      </View>

      <View style={styles.bookInfo}>
        <Text style={[styles.bookTitle, { color: themeColors.text }]} numberOfLines={1}>
          {book.title}
        </Text>
        <Text style={[styles.bookAuthor, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {book.author}
        </Text>
        <View style={styles.bookMetaRow}>
          <Text style={[styles.bookMeta, { color: themeColors.textSecondary }]}>
            {formatDuration(book.duration)}
          </Text>
          {book.progress > 0 && book.progress < 0.95 && (
            <Text style={[styles.bookProgress, { color: themeColors.text }]}>
              {Math.round(book.progress * 100)}%
            </Text>
          )}
        </View>
        {/* Progress bar for in-progress books */}
        {book.progress > 0 && book.progress < 0.95 && (
          <View style={[styles.bookProgressBar, { backgroundColor: themeColors.border }]}>
            <View
              style={[
                styles.bookProgressFill,
                { width: `${book.progress * 100}%`, backgroundColor: themeColors.text }
              ]}
            />
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.playButton, { backgroundColor: themeColors.text }]}
        onPress={onPlay}
        activeOpacity={0.7}
        accessibilityLabel={`Play ${book.title}`}
        accessibilityRole="button"
      >
        <Play size={18} color={themeColors.background} fill={themeColors.background} strokeWidth={0} />
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
  statusBadge: {
    position: 'absolute',
    bottom: scale(4),
    right: scale(4),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadedBadge: {
    // backgroundColor set dynamically
  },
  streamBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)', // Fixed dark overlay for visibility on cover
  },
  completedBadge: {
    position: 'absolute',
    top: scale(4),
    left: scale(4),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: 'rgba(0,0,0,0.6)', // Fixed dark overlay for visibility on cover
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
    gap: scale(8),
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
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BookRow;
