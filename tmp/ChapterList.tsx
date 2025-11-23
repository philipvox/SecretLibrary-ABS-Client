/**
 * src/features/book-detail/components/ChapterList.tsx
 *
 * Display list of book chapters with titles and durations.
 * Chapters are tappable (logs for now, will play in Stage 5).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { BookChapter } from '@/core/types';

interface ChapterListProps {
  chapters: BookChapter[];
}

/**
 * Format duration from seconds to readable format (MM:SS or HH:MM:SS)
 */
function formatChapterDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Display scrollable list of chapters
 */
export function ChapterList({ chapters }: ChapterListProps) {
  if (!chapters || chapters.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Chapters</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No chapters available</Text>
        </View>
      </View>
    );
  }

  /**
   * Handle chapter tap (placeholder for Stage 5 playback)
   */
  const handleChapterPress = (chapter: BookChapter) => {
    console.log('Chapter tapped:', chapter.title, 'at', chapter.start);
    // Stage 5: Start playback at chapter.start
  };

  /**
   * Render individual chapter item
   */
  const renderChapter = ({ item, index }: { item: BookChapter; index: number }) => {
    const duration = item.end - item.start;
    
    return (
      <TouchableOpacity
        style={styles.chapterItem}
        onPress={() => handleChapterPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.chapterNumber}>
          <Text style={styles.chapterNumberText}>{index + 1}</Text>
        </View>
        
        <View style={styles.chapterInfo}>
          <Text style={styles.chapterTitle} numberOfLines={2}>
            {item.title || `Chapter ${index + 1}`}
          </Text>
          <Text style={styles.chapterDuration}>
            {formatChapterDuration(duration)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        Chapters ({chapters.length})
      </Text>
      
      <FlatList
        data={chapters}
        renderItem={renderChapter}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={false} // Parent ScrollView handles scrolling
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 8,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chapterNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chapterNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 15,
    color: '#333333',
    marginBottom: 4,
    lineHeight: 20,
  },
  chapterDuration: {
    fontSize: 13,
    color: '#888888',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
  },
});
