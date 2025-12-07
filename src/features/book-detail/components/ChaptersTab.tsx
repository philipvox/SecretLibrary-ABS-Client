import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookChapter } from '@/core/types';
import { usePlayerStore } from '@/features/player';

// Design constants matching HomeScreen
const ACCENT = '#c1f40c';
const MONO_FONT = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

interface ChaptersTabProps {
  chapters: BookChapter[];
  currentPosition?: number;
  bookId?: string;
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

export function ChaptersTab({ chapters, currentPosition = 0, bookId }: ChaptersTabProps) {
  const { seekTo, currentBook } = usePlayerStore();

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

  const handleChapterPress = async (chapter: BookChapter) => {
    // Only seek if this book is currently loaded in player
    if (currentBook?.id === bookId) {
      try {
        await seekTo(chapter.start);
      } catch (error) {
        console.error('Failed to seek to chapter:', error);
      }
    } else {
      console.log('Book not loaded in player, chapter:', chapter.title);
    }
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
            <Ionicons name="volume-high" size={14} color="#000" />
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

        <Ionicons
          name="play-circle-outline"
          size={24}
          color={isCurrentChapter ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'}
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
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.4)',
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  currentChapter: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  chapterNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentChapterNumber: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  chapterNumberText: {
    fontSize: 11,
    fontFamily: MONO_FONT,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  chapterInfo: {
    flex: 1,
    marginRight: 12,
  },
  chapterTitle: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
    lineHeight: 19,
  },
  currentChapterTitle: {
    fontWeight: '600',
    color: '#fff',
  },
  chapterDuration: {
    fontSize: 11,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.2,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 40,
  },
});
