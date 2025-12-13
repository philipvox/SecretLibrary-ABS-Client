import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { BookChapter } from '@/core/types';
import { colors, spacing, radius } from '@/shared/theme';

interface ChapterListProps {
  chapters: BookChapter[];
  currentPosition?: number;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function ChapterList({ chapters, currentPosition = 0 }: ChapterListProps) {
  if (!chapters || chapters.length === 0) {
    return null;
  }

  const currentIndex = chapters.findIndex(
    (ch, idx) => currentPosition >= ch.start &&
      (idx === chapters.length - 1 || currentPosition < chapters[idx + 1].start)
  );

  const handleChapterPress = (chapter: BookChapter) => {
    console.log('Chapter tapped:', chapter.title, 'at', chapter.start);
  };

  const renderChapter = ({ item, index }: { item: BookChapter; index: number }) => {
    const duration = item.end - item.start;
    const isCurrentChapter = index === currentIndex;
    
    return (
      <TouchableOpacity
        style={[styles.chapterItem, isCurrentChapter && styles.currentChapter]}
        onPress={() => handleChapterPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.chapterNumber, isCurrentChapter && styles.currentChapterNumber]}>
          <Text style={[styles.chapterNumberText, isCurrentChapter && styles.currentChapterNumberText]}>
            {index + 1}
          </Text>
        </View>
        
        <View style={styles.chapterInfo}>
          <Text style={[styles.chapterTitle, isCurrentChapter && styles.currentChapterTitle]} numberOfLines={2}>
            {item.title || `Chapter ${index + 1}`}
          </Text>
          <Text style={styles.chapterDuration}>
            {formatDuration(duration)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Chapters ({chapters.length})</Text>
      
      <FlatList
        data={chapters}
        renderItem={renderChapter}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  currentChapter: {
    backgroundColor: colors.accentSubtle,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  chapterNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.progressTrack,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  currentChapterNumber: {
    backgroundColor: colors.accent,
  },
  chapterNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  currentChapterNumberText: {
    color: '#FFFFFF',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  currentChapterTitle: {
    fontWeight: '600',
    color: colors.accentDark,
  },
  chapterDuration: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 32 + spacing.sm,
  },
});