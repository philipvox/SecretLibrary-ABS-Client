/**
 * src/features/queue/screens/QueueScreen.tsx
 *
 * Dark mode queue screen with drag-and-drop reordering (Up Next),
 * swipe-to-delete, play any book, and Played history section.
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
  Animated as RNAnimated,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { ChevronLeft, Trash2, Play, X, GripVertical } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import {
  useQueueStore,
  useQueue,
  getUpNextQueue,
  getPlayedQueue,
  useShouldShowClearDialog,
  QueueBook,
} from '../stores/queueStore';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale } from '@/shared/theme';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getMetadata(book: LibraryItem) {
  const m = book.media?.metadata as any;
  return {
    title: m?.title || 'Untitled',
    author: m?.authorName || m?.authors?.[0]?.name || 'Unknown Author',
    duration: (book.media as any)?.duration || 0,
  };
}

// ─── Draggable Up Next Item ─────────────────────────────────────────────────

const ACTION_WIDTH = 80;

function DraggableQueueItem({
  item,
  drag,
  isActive,
  onRemove,
  onPlay,
}: {
  item: QueueBook;
  drag: () => void;
  isActive: boolean;
  onRemove: () => void;
  onPlay: () => void;
}) {
  const coverUrl = useCoverUrl(item.book.id);
  const { title, author, duration } = getMetadata(item.book);
  const durationText = duration > 0 ? formatDuration(duration) : '';
  const subtitle = durationText ? `${author} · ${durationText}` : author;

  const handleDrag = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    drag();
  }, [drag]);

  return (
    <ScaleDecorator>
      <View style={[styles.row, isActive && styles.rowDragging]}>
        {/* Drag handle */}
        <TouchableOpacity
          onLongPress={handleDrag}
          delayLongPress={100}
          style={styles.dragHandle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <GripVertical size={scale(18)} color="rgba(255,255,255,0.3)" strokeWidth={2} />
        </TouchableOpacity>

        {/* Cover */}
        <Image
          source={coverUrl}
          style={styles.cover}
          contentFit="cover"
        />

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
        </View>

        {/* Play */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={onPlay}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Play size={scale(16)} color="#000" fill="#000" strokeWidth={0} />
        </TouchableOpacity>

        {/* Remove */}
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={scale(16)} color="rgba(255,255,255,0.4)" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </ScaleDecorator>
  );
}

// ─── Played Item (static, no drag) ─────────────────────────────────────────

function PlayedItem({
  item,
  onRemove,
  onPress,
}: {
  item: QueueBook;
  onRemove: () => void;
  onPress: () => void;
}) {
  const coverUrl = useCoverUrl(item.book.id);
  const { title, author, duration } = getMetadata(item.book);
  const durationText = duration > 0 ? formatDuration(duration) : '';
  const subtitle = durationText ? `${author} · ${durationText}` : author;
  const swipeableRef = React.useRef<Swipeable>(null);

  const handleRemove = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeableRef.current?.close();
    onRemove();
  }, [onRemove]);

  const renderRightActions = useCallback(
    (
      progress: RNAnimated.AnimatedInterpolation<number>,
      dragX: RNAnimated.AnimatedInterpolation<number>
    ) => {
      const translateX = dragX.interpolate({
        inputRange: [-ACTION_WIDTH, 0],
        outputRange: [0, ACTION_WIDTH],
        extrapolate: 'clamp',
      });
      const opacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      });
      return (
        <RNAnimated.View style={[styles.rightAction, { transform: [{ translateX }], opacity }]}>
          <TouchableOpacity style={styles.removeAction} onPress={handleRemove}>
            <Trash2 size={scale(20)} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </RNAnimated.View>
      );
    },
    [handleRemove]
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity
        style={[styles.row, styles.rowPlayed]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Image source={coverUrl} style={[styles.cover, styles.coverPlayed]} contentFit="cover" />
        <View style={styles.info}>
          <Text style={[styles.rowTitle, styles.textPlayed]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.rowSubtitle, styles.textPlayed]} numberOfLines={1}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={handleRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={scale(16)} color="rgba(255,255,255,0.3)" strokeWidth={2} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export function QueueScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const queue = useQueue();
  const upNext = useMemo(() => getUpNextQueue(queue), [queue]);
  const played = useMemo(() => getPlayedQueue(queue), [queue]);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);
  const reorderQueue = useQueueStore((s) => s.reorderQueue);
  const clearQueue = useQueueStore((s) => s.clearQueue);
  const clearPlayed = useQueueStore((s) => s.clearPlayed);
  const shouldShowClearDialog = useShouldShowClearDialog();
  const dismissClearDialog = useQueueStore((s) => s.dismissClearDialog);

  // End-of-queue dialog
  useEffect(() => {
    if (shouldShowClearDialog) {
      Alert.alert(
        'Queue Finished',
        'All books in your queue have been played. Clear played books?',
        [
          { text: 'Keep', style: 'cancel', onPress: () => dismissClearDialog() },
          { text: 'Clear Played', style: 'destructive', onPress: () => clearPlayed() },
        ]
      );
    }
  }, [shouldShowClearDialog]);

  const totalDuration = useMemo(() => {
    return upNext.reduce((sum, item) => sum + ((item.book.media as any)?.duration || 0), 0);
  }, [upNext]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleRemove = useCallback(
    (bookId: string) => removeFromQueue(bookId),
    [removeFromQueue]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Queue',
      `Remove all ${queue.length} book${queue.length !== 1 ? 's' : ''} from your queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            clearQueue();
          },
        },
      ]
    );
  }, [queue.length, clearQueue]);

  const handleBookPress = useCallback(
    (bookId: string) => {
      const item = queue.find((q) => q.bookId === bookId);
      if (item) navigation.navigate('BookDetail', { book: item.book });
    },
    [queue, navigation]
  );

  const handlePlayBook = useCallback((book: LibraryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    (async () => {
      try {
        const { usePlayerStore } = await import('@/features/player/stores');
        usePlayerStore.getState().loadBook(book, { autoPlay: true, showPlayer: true });
      } catch {
        navigation.navigate('BookDetail', { book });
      }
    })();
  }, [navigation]);

  // Drag-and-drop reorder for upNext items
  // upNext items map to queue indices where played === false
  const handleDragEnd = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      if (from === to) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Find the actual queue indices for these upNext items
      const upNextIndices: number[] = [];
      queue.forEach((item, idx) => {
        if (!item.played) upNextIndices.push(idx);
      });
      const fromIdx = upNextIndices[from];
      const toIdx = upNextIndices[to];
      if (fromIdx !== undefined && toIdx !== undefined) {
        reorderQueue(fromIdx, toIdx);
      }
    },
    [queue, reorderQueue]
  );

  const renderUpNextItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<QueueBook>) => (
      <DraggableQueueItem
        item={item}
        drag={drag}
        isActive={isActive}
        onRemove={() => handleRemove(item.bookId)}
        onPlay={() => handlePlayBook(item.book)}
      />
    ),
    [handleRemove, handlePlayBook]
  );

  const keyExtractor = useCallback((item: QueueBook) => item.id, []);

  const isEmpty = queue.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + scale(8) }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ChevronLeft size={scale(24)} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queue</Text>
        {!isEmpty ? (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Stats */}
      {!isEmpty && (
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            {upNext.length} upcoming · {formatDuration(totalDuration)}
          </Text>
        </View>
      )}

      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Nothing in your queue</Text>
          <Text style={styles.emptySubtitle}>
            Add books from your library to plan your listening journey.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingBottom: insets.bottom + SCREEN_BOTTOM_PADDING }}
          showsVerticalScrollIndicator={false}
        >
          {/* Up Next — draggable */}
          {upNext.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>Up Next</Text>
              </View>
              <DraggableFlatList
                data={upNext}
                renderItem={renderUpNextItem}
                keyExtractor={keyExtractor}
                onDragEnd={handleDragEnd}
                activationDistance={10}
                scrollEnabled={false}
                containerStyle={styles.draggableContainer}
              />
            </View>
          )}

          {/* Played — static with swipe-to-delete */}
          {played.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>Played</Text>
                <TouchableOpacity onPress={() => clearPlayed()}>
                  <Text style={styles.sectionAction}>Clear</Text>
                </TouchableOpacity>
              </View>
              {played.map((item) => (
                <PlayedItem
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemove(item.bookId)}
                  onPress={() => handleBookPress(item.bookId)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: scale(12),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: scale(40),
  },
  clearBtn: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    backgroundColor: 'rgba(255,75,75,0.15)',
    borderRadius: scale(6),
  },
  clearBtnText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  statsRow: {
    paddingHorizontal: scale(16),
    paddingBottom: scale(12),
  },
  statsText: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.5)',
  },

  // Scroll
  scrollContainer: {
    flex: 1,
    paddingHorizontal: scale(16),
  },

  // Sections
  section: {
    marginBottom: scale(16),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scale(8),
    paddingBottom: scale(10),
  },
  sectionHeaderText: {
    fontSize: scale(12),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionAction: {
    fontSize: scale(12),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  draggableContainer: {
    // no extra styles needed
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(10),
    marginBottom: scale(6),
    gap: scale(10),
  },
  rowDragging: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ scale: 1.02 }],
  },
  rowPlayed: {
    opacity: 0.5,
  },
  dragHandle: {
    padding: scale(4),
  },
  cover: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  coverPlayed: {
    opacity: 0.6,
  },
  info: {
    flex: 1,
  },
  rowTitle: {
    fontSize: scale(14),
    fontWeight: '500',
    color: '#fff',
    marginBottom: scale(2),
  },
  rowSubtitle: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },
  textPlayed: {
    color: 'rgba(255,255,255,0.4)',
  },

  // Play button (white circle)
  playButton: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Remove button
  removeBtn: {
    width: scale(32),
    height: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Swipe actions
  rightAction: {
    width: ACTION_WIDTH,
    marginBottom: scale(6),
  },
  removeAction: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: scale(10),
    borderBottomRightRadius: scale(10),
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
    marginBottom: scale(8),
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: scale(20),
  },
});
