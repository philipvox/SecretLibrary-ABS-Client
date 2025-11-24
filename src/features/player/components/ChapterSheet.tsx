// File: src/features/player/components/ChapterSheet.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../stores/playerStore';
import { BookChapter } from '@/core/types';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

interface ChapterSheetProps {
  visible: boolean;
  onClose: () => void;
  chapters: BookChapter[];
  currentPosition: number;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ChapterSheet({ visible, onClose, chapters, currentPosition }: ChapterSheetProps) {
  const insets = useSafeAreaInsets();
  const { jumpToChapter } = usePlayerStore();

  const handleChapterPress = async (index: number) => {
    await jumpToChapter(index);
    onClose();
  };

  const currentIndex = chapters.findIndex(
    (ch, idx) => currentPosition >= ch.start &&
      (idx === chapters.length - 1 || currentPosition < chapters[idx + 1].start)
  );

  const renderChapter = ({ item, index }: { item: BookChapter; index: number }) => {
    const isCurrentChapter = index === currentIndex;
    const duration = item.end - item.start;

    return (
      <TouchableOpacity
        style={[styles.chapterItem, isCurrentChapter && styles.currentChapter]}
        onPress={() => handleChapterPress(index)}
        activeOpacity={0.7}
      >
        <View style={styles.chapterLeft}>
          {isCurrentChapter ? (
            <Icon name="volume-high" size={16} color={theme.colors.primary[500]} set="ionicons" />
          ) : (
            <Text style={styles.chapterNumber}>{index + 1}</Text>
          )}
        </View>
        <View style={styles.chapterInfo}>
          <Text style={[styles.chapterTitle, isCurrentChapter && styles.currentText]} numberOfLines={2}>
            {item.title || `Chapter ${index + 1}`}
          </Text>
          <Text style={styles.chapterDuration}>{formatDuration(duration)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.handle} />
          <Text style={styles.title}>Chapters</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={theme.colors.text.primary} set="ionicons" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={chapters}
          renderItem={renderChapter}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    alignItems: 'center',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.neutral[300],
    borderRadius: theme.radius.small,
    marginBottom: theme.spacing[3],
  },
  title: {
    ...theme.textStyles.h4,
    color: theme.colors.text.primary,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing[4],
    top: theme.spacing[5],
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: theme.spacing[4],
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  currentChapter: {
    backgroundColor: theme.colors.primary[50],
    marginHorizontal: -theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.radius.medium,
    borderBottomWidth: 0,
  },
  chapterLeft: {
    width: 32,
    alignItems: 'center',
  },
  chapterNumber: {
    ...theme.textStyles.bodySmall,
    color: theme.colors.text.tertiary,
    fontWeight: '500',
  },
  chapterInfo: {
    flex: 1,
    marginLeft: theme.spacing[3],
  },
  chapterTitle: {
    ...theme.textStyles.body,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
  },
  chapterDuration: {
    ...theme.textStyles.caption,
    color: theme.colors.text.tertiary,
  },
  currentText: {
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
});