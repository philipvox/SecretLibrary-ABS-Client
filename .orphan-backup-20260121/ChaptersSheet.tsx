/**
 * src/features/player/components/sheets/ChaptersSheet.tsx
 *
 * Chapters list sheet for selecting book chapters.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { scale, spacing, layout, useTheme } from '@/shared/theme';
import { ChapterListItem, type ChapterListItemChapter } from '../ChapterListItem';
import { SCREEN_HEIGHT } from '../../constants/playerConstants';

export interface ChaptersSheetProps {
  chapters: ChapterListItemChapter[];
  currentChapterIndex: number;
  onChapterSelect: (start: number) => void;
  onClose: () => void;
}

export const ChaptersSheet: React.FC<ChaptersSheetProps> = ({
  chapters,
  currentChapterIndex,
  onChapterSelect,
  onClose,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.sheet, styles.chaptersSheet, { backgroundColor: colors.background.elevated }]}>
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>Chapters</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.sheetClose}
          accessibilityLabel="Close chapters"
          accessibilityRole="button"
        >
          <X size={24} color={colors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.chaptersList} showsVerticalScrollIndicator={false}>
        {chapters.map((chapter, index: number) => (
          <ChapterListItem
            key={chapter.start}
            chapter={chapter}
            index={index}
            isCurrentChapter={index === currentChapterIndex}
            onSelect={onChapterSelect}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    padding: spacing.lg,
    paddingTop: scale(20),
    paddingBottom: scale(24),
  },
  chaptersSheet: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(20),
  },
  sheetTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  sheetClose: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chaptersList: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
});
