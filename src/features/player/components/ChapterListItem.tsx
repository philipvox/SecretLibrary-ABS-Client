/**
 * src/features/player/components/ChapterListItem.tsx
 *
 * Memoized chapter list item for the chapters sheet.
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { scale } from '@/shared/theme';
import { formatTime } from '../utils/timeFormatters';
import { ACCENT_COLOR } from '../constants/playerConstants';
import type { PlayerColors } from '../utils/playerTheme';

export interface ChapterListItemChapter {
  start: number;
  end: number;
  displayTitle?: string;
}

export interface ChapterListItemProps {
  chapter: ChapterListItemChapter;
  index: number;
  isCurrentChapter: boolean;
  onSelect: (start: number) => void;
  themeColors: PlayerColors;
  isDarkMode: boolean;
}

export const ChapterListItem = React.memo(({
  chapter,
  index,
  isCurrentChapter,
  onSelect,
  themeColors,
  isDarkMode,
}: ChapterListItemProps) => {
  const chapterTitle = chapter.displayTitle || `Chapter ${index + 1}`;
  const chapterDuration = formatTime(chapter.end - chapter.start);

  const handlePress = useCallback(() => {
    onSelect(chapter.start);
  }, [onSelect, chapter.start]);

  return (
    <TouchableOpacity
      style={[
        styles.item,
        isCurrentChapter && { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0' },
      ]}
      onPress={handlePress}
      accessibilityLabel={`${chapterTitle}, ${chapterDuration}${isCurrentChapter ? ', currently playing' : ''}`}
      accessibilityRole="button"
      accessibilityHint="Double tap to jump to this chapter"
    >
      <Text style={[styles.number, { color: themeColors.textTertiary }]}>{index + 1}</Text>
      <View style={styles.info}>
        <Text
          style={[
            styles.title,
            { color: themeColors.textPrimary },
            isCurrentChapter && styles.titleActive,
          ]}
          numberOfLines={1}
        >
          {chapterTitle}
        </Text>
        <Text style={[styles.duration, { color: themeColors.textSecondary }]}>
          {chapterDuration}
        </Text>
      </View>
      {isCurrentChapter && (
        <Volume2 size={16} color={ACCENT_COLOR} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: scale(54),
  },
  number: {
    fontSize: scale(14),
    fontWeight: '600',
    width: scale(28),
    textAlign: 'center',
  },
  info: {
    flex: 1,
    marginLeft: scale(12),
  },
  title: {
    fontSize: scale(15),
    fontWeight: '500',
    marginBottom: scale(2),
  },
  titleActive: {
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  duration: {
    fontSize: scale(12),
  },
});
