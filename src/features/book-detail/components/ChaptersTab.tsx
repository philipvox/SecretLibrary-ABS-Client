import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { BookChapter } from '@/core/types';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

interface ChaptersTabProps {
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

export function ChaptersTab({ chapters, currentPosition = 0 }: ChaptersTabProps) {
  if (!chapters || chapters.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No chapters available</Text>
      </View>
    );
  }

  const currentIndex = chapters.findIndex(
    (ch, idx) => currentPosition >= ch.start &&
      (idx === chapters.length - 1 || currentPosition < chapters[idx + 1].start)
  );

  const handleChapterPress = (chapter: BookChapter) => {
    console.log('Chapter tapped:', chapter.title, 'at', chapter.start);
    // TODO: Jump to chapter position
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
          {isCurrentChapter ? (
            <Icon name="volume-high" size={14} color="#FFFFFF" set="ionicons" />
          ) : (
            <Text style={styles.chapterNumberText}>{index + 1}</Text>
          )}
        </View>
        
        <View style={styles.chapterInfo}>
          <Text style={[styles.chapterTitle, isCurrentChapter && styles.currentChapterTitle]} numberOfLines={2}>
            {item.title || `Chapter ${index + 1}`}
          </Text>
          <Text style={styles.chapterDuration}>
            {formatDuration(duration)}
          </Text>
        </View>

        <Icon 
          name="play-circle-outline" 
          size={24} 
          color={isCurrentChapter ? theme.colors.primary[500] : theme.colors.text.tertiary} 
          set="ionicons" 
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
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
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
  },
  emptyContainer: {
    padding: theme.spacing[8],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
  },
  currentChapter: {
    backgroundColor: theme.colors.primary[50],
    marginHorizontal: -theme.spacing[3],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.medium,
  },
  chapterNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing[3],
  },
  currentChapterNumber: {
    backgroundColor: theme.colors.primary[500],
  },
  chapterNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.tertiary,
  },
  chapterInfo: {
    flex: 1,
    marginRight: theme.spacing[3],
  },
  chapterTitle: {
    fontSize: 14,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
    lineHeight: 19,
  },
  currentChapterTitle: {
    fontWeight: '600',
    color: theme.colors.primary[600],
  },
  chapterDuration: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border.light,
    marginLeft: 28 + theme.spacing[3],
  },
});