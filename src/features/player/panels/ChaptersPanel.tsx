/**
 * src/features/player/panels/ChaptersPanel.tsx
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '@/shared/components/Icon';
import { formatTime } from '../utils';

// =============================================================================
// TYPES
// =============================================================================

interface Chapter {
  title: string;
  start: number;
  end: number;
}

interface ChaptersPanelProps {
  chapters: Chapter[];
  currentChapter: Chapter | undefined;
  onChapterSelect: (start: number) => void;
  onClose: () => void;
  isLight: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ITEM_HEIGHT = 56;

// =============================================================================
// COMPONENT
// =============================================================================

export function ChaptersPanel({ 
  chapters, 
  currentChapter, 
  onChapterSelect,
  onClose,
  isLight,
}: ChaptersPanelProps) {
  const listRef = useRef<FlatList>(null);
  
  const textColor = isLight ? '#000000' : '#FFFFFF';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const buttonBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
  const activeButtonBg = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
  const activeButtonText = isLight ? '#FFFFFF' : '#000000';
  const activeBg = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)';

  // Auto-scroll to current chapter
  useEffect(() => {
    if (currentChapter && listRef.current) {
      const index = chapters.findIndex(c => c === currentChapter);
      if (index > 0) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ 
            index, 
            animated: false,
            viewPosition: 0.3,
          });
        }, 100);
      }
    }
  }, [currentChapter, chapters]);

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  const getDisplayTitle = (title: string, index: number): string => {
    if (!title) return `Chapter ${index + 1}`;
    // Strip book name prefix if present
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      return parts[parts.length - 1];
    }
    return title;
  };

  const formatDuration = (start: number, end: number): string => {
    const duration = end - start;
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  const renderChapter = ({ item, index }: { item: Chapter; index: number }) => {
    const isCurrentChapter = currentChapter === item;
    
    return (
      <TouchableOpacity
        style={[
          styles.chapterItem,
          { backgroundColor: isCurrentChapter ? activeBg : 'transparent' }
        ]}
        onPress={() => onChapterSelect(item.start)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.chapterNumber,
          { backgroundColor: isCurrentChapter ? activeButtonBg : buttonBg }
        ]}>
          <Text style={[
            styles.chapterNumberText,
            { color: isCurrentChapter ? activeButtonText : secondaryColor }
          ]}>
            {index + 1}
          </Text>
        </View>
        <View style={styles.chapterInfo}>
          <Text 
            style={[
              styles.chapterName, 
              { color: textColor },
              isCurrentChapter && styles.chapterNameActive
            ]} 
            numberOfLines={1}
          >
            {getDisplayTitle(item.title, index)}
          </Text>
          <Text style={[styles.chapterTime, { color: secondaryColor }]}>
            {formatTime(item.start)} • {formatDuration(item.start, item.end)}
          </Text>
        </View>
        {isCurrentChapter && (
          <Icon name="volume-high" size={18} color={textColor} set="ionicons" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Chapters</Text>
        <Text style={[styles.subtitle, { color: secondaryColor }]}>
          {chapters.length} chapters
        </Text>
      </View>

      {/* Chapter List */}
      <FlatList
        ref={listRef}
        data={chapters}
        renderItem={renderChapter}
        keyExtractor={(_, index) => index.toString()}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ 
              index: info.index, 
              animated: false 
            });
          }, 100);
        }}
      />

      {/* Close Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: activeButtonBg }]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={[styles.closeButtonText, { color: activeButtonText }]}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  chapterNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterNumberText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  chapterNameActive: {
    fontWeight: '600',
  },
  chapterTime: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 24,
  },
  closeButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});

export default ChaptersPanel;