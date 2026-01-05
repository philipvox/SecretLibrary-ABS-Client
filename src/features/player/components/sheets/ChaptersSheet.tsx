/**
 * src/features/player/components/sheets/ChaptersSheet.tsx
 *
 * Chapters list sheet for selecting book chapters.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { scale, spacing, layout } from '@/shared/theme';
import { ChapterListItem, type ChapterListItemChapter } from '../ChapterListItem';
import type { PlayerColors } from '../../utils/playerTheme';
import { SCREEN_HEIGHT } from '../../constants/playerConstants';

export interface ChaptersSheetProps {
  themeColors: PlayerColors;
  isDarkMode: boolean;
  chapters: ChapterListItemChapter[];
  currentChapterIndex: number;
  onChapterSelect: (start: number) => void;
  onClose: () => void;
}

export const ChaptersSheet: React.FC<ChaptersSheetProps> = ({
  themeColors,
  isDarkMode,
  chapters,
  currentChapterIndex,
  onChapterSelect,
  onClose,
}) => {
  return (
    <View style={[styles.sheet, styles.chaptersSheet, { backgroundColor: themeColors.sheetBackground }]}>
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>Chapters</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.sheetClose}
          accessibilityLabel="Close chapters"
          accessibilityRole="button"
        >
          <X size={24} color={themeColors.iconPrimary} strokeWidth={2} />
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
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
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
    color: '#000000',
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
