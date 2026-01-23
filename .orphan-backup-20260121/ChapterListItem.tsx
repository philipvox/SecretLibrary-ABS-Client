/**
 * src/features/player/components/ChapterListItem.tsx
 *
 * Memoized chapter list item for the chapters sheet.
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { scale, useTheme } from '@/shared/theme';
import { formatTime } from '../utils/timeFormatters';

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
}

export const ChapterListItem = React.memo(({
  chapter,
  index,
  isCurrentChapter,
  onSelect,
}: ChapterListItemProps) => {
  const { colors } = useTheme();
  const chapterTitle = chapter.displayTitle || `Chapter ${index + 1}`;
  const chapterDuration = formatTime(chapter.end - chapter.start);

  const handlePress = useCallback(() => {
    onSelect(chapter.start);
  }, [onSelect, chapter.start]);

  return (
    <TouchableOpacity
      style={[
        styles.item,
        { borderBottomColor: colors.border.default },
        isCurrentChapter && { backgroundColor: colors.background.secondary },
      ]}
      onPress={handlePress}
      accessibilityLabel={`${chapterTitle}, ${chapterDuration}${isCurrentChapter ? ', currently playing' : ''}`}
      accessibilityRole="button"
      accessibilityHint="Double tap to jump to this chapter"
    >
      <Text style={[styles.number, { color: colors.text.tertiary }]}>{index + 1}</Text>
      <View style={styles.info}>
        <Text
          style={[
            styles.title,
            { color: colors.text.primary },
            isCurrentChapter && { fontWeight: '700', color: colors.accent.primary },
          ]}
          numberOfLines={1}
        >
          {chapterTitle}
        </Text>
        <Text style={[styles.duration, { color: colors.text.secondary }]}>
          {chapterDuration}
        </Text>
      </View>
      {isCurrentChapter && (
        <Volume2 size={16} color={colors.accent.primary} strokeWidth={2} />
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
  duration: {
    fontSize: scale(12),
  },
});
