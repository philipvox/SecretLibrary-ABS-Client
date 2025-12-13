/**
 * src/features/player/panels/ChaptersPanel.tsx
 * Shows all chapters in a scrollable list (not virtualized)
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Icon } from '@/shared/components/Icon';
import { formatTime } from '../utils';
import { scale, spacing, radius } from '@/shared/theme';

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
// COMPONENT
// =============================================================================

export function ChaptersPanel({
  chapters,
  currentChapter,
  onChapterSelect,
  onClose,
  isLight,
}: ChaptersPanelProps) {
  const scrollRef = useRef<ScrollView>(null);

  const textColor = isLight ? '#000000' : '#FFFFFF';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const buttonBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
  const activeButtonBg = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
  const activeButtonText = isLight ? '#FFFFFF' : '#000000';
  const activeBg = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)';

  // Auto-scroll to current chapter on mount
  useEffect(() => {
    if (currentChapter && scrollRef.current) {
      const index = chapters.findIndex(c => c === currentChapter);
      if (index > 0) {
        // Approximate scroll position based on item height
        const itemHeight = scale(56);
        const scrollPosition = Math.max(0, (index * itemHeight) - (itemHeight * 2));
        setTimeout(() => {
          scrollRef.current?.scrollTo({ y: scrollPosition, animated: false });
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Chapters</Text>
        <Text style={[styles.subtitle, { color: secondaryColor }]}>
          {chapters.length} chapters
        </Text>
      </View>

      {/* Chapter List - ScrollView with all chapters rendered */}
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {chapters.map((chapter, index) => {
          const isCurrentChapter = currentChapter === chapter;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.chapterItem,
                { backgroundColor: isCurrentChapter ? activeBg : 'transparent' }
              ]}
              onPress={() => onChapterSelect(chapter.start)}
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
                  {getDisplayTitle(chapter.title, index)}
                </Text>
                <Text style={[styles.chapterTime, { color: secondaryColor }]}>
                  {formatTime(chapter.start)} • {formatDuration(chapter.start, chapter.end)}
                </Text>
              </View>
              {isCurrentChapter && (
                <Icon name="volume-high" size={18} color={textColor} set="ionicons" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
    paddingHorizontal: spacing.sm,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: scale(32),
    fontWeight: '700',
  },
  subtitle: {
    fontSize: scale(15),
    marginTop: spacing.xs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scale(56),
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  chapterNumber: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterNumberText: {
    fontSize: scale(13),
    fontWeight: '600',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterName: {
    fontSize: scale(15),
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  chapterNameActive: {
    fontWeight: '600',
  },
  chapterTime: {
    fontSize: scale(13),
    fontVariant: ['tabular-nums'],
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  closeButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: scale(48),
    borderRadius: radius.xxl,
  },
  closeButtonText: {
    fontSize: scale(17),
    fontWeight: '600',
  },
});

export default ChaptersPanel;
