/**
 * src/features/queue/components/QueuePanel.tsx
 *
 * Draggable queue panel for use in player screens.
 * Features drag-and-drop reordering, remove, and autoplay toggle.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Pressable,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { colors, scale, spacing, radius, layout, hp } from '@/shared/theme';
import {
  useQueueStore,
  useQueue,
  useAutoplayEnabled,
  QueueBook,
} from '../stores/queueStore';

interface QueuePanelProps {
  onClose: () => void;
  maxHeight?: number;
}

// Draggable queue item
interface DraggableQueueItemProps {
  item: QueueBook;
  drag: () => void;
  isActive: boolean;
  onRemove: () => void;
  onPlayNext: () => void;
  showPlayNext: boolean;
}

function DraggableQueueItem({
  item,
  drag,
  isActive,
  onRemove,
  onPlayNext,
  showPlayNext,
}: DraggableQueueItemProps) {
  const coverUrl = useCoverUrl(item.book.id);
  const metadata = item.book.media?.metadata as any;
  const title = metadata?.title || 'Untitled';
  const author =
    metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';

  // Calculate duration
  const duration = (item.book.media as any)?.duration || 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  const subtitle = duration > 0 ? `${author} · ${durationText}` : author;

  const handleDrag = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    drag();
  }, [drag]);

  const handleRemove = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRemove();
  }, [onRemove]);

  const handlePlayNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayNext();
  }, [onPlayNext]);

  return (
    <ScaleDecorator>
      <View style={[styles.itemContainer, isActive && styles.itemActive]}>
        {/* Drag handle */}
        <Pressable style={styles.dragHandle} onLongPress={handleDrag}>
          <Ionicons
            name="menu"
            size={scale(18)}
            color={isActive ? colors.accent : 'rgba(255,255,255,0.4)'}
          />
        </Pressable>

        {/* Cover */}
        <Image source={coverUrl} style={styles.cover} contentFit="cover" />

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {showPlayNext && (
            <TouchableOpacity
              style={styles.playNextButton}
              onPress={handlePlayNext}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-up" size={scale(16)} color={colors.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={handleRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={scale(18)} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      </View>
    </ScaleDecorator>
  );
}

export function QueuePanel({ onClose, maxHeight = hp(50) }: QueuePanelProps) {
  const navigation = useNavigation<any>();
  const queue = useQueue();
  const autoplayEnabled = useAutoplayEnabled();
  const reorderQueue = useQueueStore((s) => s.reorderQueue);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);
  const clearQueue = useQueueStore((s) => s.clearQueue);
  const setAutoplayEnabled = useQueueStore((s) => s.setAutoplayEnabled);

  // Calculate total duration
  const totalDuration = queue.reduce((acc, item) => {
    return acc + ((item.book.media as any)?.duration || 0);
  }, 0);
  const totalHours = Math.floor(totalDuration / 3600);
  const totalMinutes = Math.floor((totalDuration % 3600) / 60);
  const totalDurationText =
    totalHours > 0
      ? `${totalHours}h ${totalMinutes}m`
      : `${totalMinutes}m`;

  const handleDragEnd = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      if (from !== to) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        reorderQueue(from, to);
      }
    },
    [reorderQueue]
  );

  const handleRemove = useCallback(
    (bookId: string) => {
      removeFromQueue(bookId);
    },
    [removeFromQueue]
  );

  const handlePlayNext = useCallback(
    (fromIndex: number) => {
      if (fromIndex > 0) {
        reorderQueue(fromIndex, 0);
      }
    },
    [reorderQueue]
  );

  const handleClearQueue = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    clearQueue();
  }, [clearQueue]);

  const handleAutoplayToggle = useCallback(
    (value: boolean) => {
      Haptics.selectionAsync();
      setAutoplayEnabled(value);
    },
    [setAutoplayEnabled]
  );

  const handleBrowseLibrary = useCallback(() => {
    onClose();
    // Small delay to let the sheet close
    setTimeout(() => {
      navigation.navigate('LibraryTab');
    }, 200);
  }, [onClose, navigation]);

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<QueueBook>) => {
      const index = getIndex() ?? 0;
      return (
        <DraggableQueueItem
          item={item}
          drag={drag}
          isActive={isActive}
          onRemove={() => handleRemove(item.bookId)}
          onPlayNext={() => handlePlayNext(index)}
          showPlayNext={index > 0}
        />
      );
    },
    [handleRemove, handlePlayNext]
  );

  const keyExtractor = useCallback((item: QueueBook) => item.id, []);

  // Empty state
  if (queue.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Up Next</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="albums-outline"
            size={scale(48)}
            color={colors.textMuted}
          />
          <Text style={styles.emptyText}>Your queue is empty</Text>
          <Text style={styles.emptySubtext}>
            Add audiobooks to play them next
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={handleBrowseLibrary}
          >
            <Text style={styles.browseButtonText}>Browse Library</Text>
          </TouchableOpacity>
        </View>
        {/* Autoplay toggle even when empty */}
        <View style={styles.autoplayRow}>
          <View style={styles.autoplayInfo}>
            <Ionicons
              name="play-skip-forward-outline"
              size={scale(18)}
              color={colors.textSecondary}
            />
            <Text style={styles.autoplayLabel}>Autoplay series</Text>
          </View>
          <Switch
            value={autoplayEnabled}
            onValueChange={handleAutoplayToggle}
            trackColor={{ false: colors.backgroundTertiary, true: colors.accentSubtle }}
            thumbColor={autoplayEnabled ? colors.accent : colors.textMuted}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Up Next</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{queue.length}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {queue.length} {queue.length === 1 ? 'audiobook' : 'audiobooks'} ·{' '}
          {totalDurationText}
        </Text>
        <TouchableOpacity onPress={handleClearQueue}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Draggable list */}
      <View style={{ maxHeight: maxHeight - scale(180) }}>
        <DraggableFlatList
          data={queue}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onDragEnd={handleDragEnd}
          showsVerticalScrollIndicator={false}
          containerStyle={styles.listContainer}
          activationDistance={10}
        />
      </View>

      {/* Autoplay toggle */}
      <View style={styles.autoplayRow}>
        <View style={styles.autoplayInfo}>
          <Ionicons
            name="play-skip-forward-outline"
            size={scale(18)}
            color={colors.textSecondary}
          />
          <View>
            <Text style={styles.autoplayLabel}>Autoplay series</Text>
            <Text style={styles.autoplayHint}>
              Automatically add next book in series
            </Text>
          </View>
        </View>
        <Switch
          value={autoplayEnabled}
          onValueChange={handleAutoplayToggle}
          trackColor={{ false: colors.backgroundTertiary, true: colors.accentSubtle }}
          thumbColor={autoplayEnabled ? colors.accent : colors.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: scale(24),
    alignItems: 'center',
  },
  badgeText: {
    fontSize: scale(12),
    fontWeight: '700',
    color: colors.backgroundPrimary,
  },
  closeButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statsText: {
    fontSize: scale(13),
    color: colors.textSecondary,
  },
  clearText: {
    fontSize: scale(13),
    color: colors.error,
    fontWeight: '500',
  },
  listContainer: {
    paddingBottom: spacing.sm,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
    marginBottom: scale(8),
    gap: scale(10),
  },
  itemActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ scale: 1.02 }],
  },
  dragHandle: {
    padding: scale(4),
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cover: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(6),
    backgroundColor: '#262626',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: scale(14),
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: scale(2),
  },
  subtitle: {
    fontSize: scale(12),
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  playNextButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: colors.accentSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    width: scale(32),
    height: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyText: {
    fontSize: scale(16),
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: scale(14),
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  browseButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  browseButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.backgroundPrimary,
  },
  autoplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  autoplayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  autoplayLabel: {
    fontSize: scale(14),
    color: colors.textPrimary,
    fontWeight: '500',
  },
  autoplayHint: {
    fontSize: scale(11),
    color: colors.textTertiary,
    marginTop: 2,
  },
});

export default QueuePanel;
