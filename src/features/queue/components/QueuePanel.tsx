/**
 * src/features/queue/components/QueuePanel.tsx
 *
 * Dark mode queue panel (popup from player).
 * Shows Up Next and Played sections with swipe-to-delete.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player/stores';
import { useCurrentChapter, useTimeRemaining } from '@/features/player/stores/playerSelectors';
import { scale } from '@/shared/theme';
import {
  useQueueStore,
  useQueue,
  getUpNextQueue,
  getPlayedQueue,
  QueueBook,
} from '../stores/queueStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMetadata(book: LibraryItem) {
  const m = book.media?.metadata as any;
  return {
    title: m?.title || 'Untitled',
    author: m?.authorName || m?.authors?.[0]?.name || 'Unknown Author',
    duration: (book.media as any)?.duration || 0,
  };
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatTimeRemaining(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `-${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `-${mins}:${String(secs).padStart(2, '0')}`;
}

// Icons
const CloseIcon = ({ color = '#fff', size = 12 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

const PlayIcon = () => (
  <Svg width={scale(12)} height={scale(12)} viewBox="0 0 24 24" fill="#000" stroke="none">
    <Path d="M5 3l14 9-14 9V3z" />
  </Svg>
);

const GripIcon = ({ color = 'rgba(255,255,255,0.3)', size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M4 8h16M4 16h16" />
  </Svg>
);

const LayersIcon = ({ color = 'rgba(255,255,255,0.3)', size = 48 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M12 2L2 7l10 5 10-5-10-5z" />
    <Path d="M2 17l10 5 10-5" />
    <Path d="M2 12l10 5 10-5" />
  </Svg>
);

// ─── Types ──────────────────────────────────────────────────────────────────

interface QueuePanelProps {
  onClose: () => void;
  maxHeight?: number;
}

// ─── Components ─────────────────────────────────────────────────────────────

function BookCover({ bookId, size = 48 }: { bookId: string; size?: number }) {
  const coverUrl = useCoverUrl(bookId);
  return (
    <Image
      source={coverUrl}
      style={{ width: size, height: size, borderRadius: scale(6), backgroundColor: 'rgba(255,255,255,0.1)' }}
      contentFit="cover"
    />
  );
}

function NowPlayingSection() {
  const currentBook = usePlayerStore((s) => s.currentBook);
  const currentChapter = useCurrentChapter();
  const timeRemaining = useTimeRemaining();

  if (!currentBook) return null;

  const { title } = getMetadata(currentBook);
  const chapterTitle = currentChapter?.title || 'Unknown Chapter';

  return (
    <View style={styles.nowPlaying}>
      <BookCover bookId={currentBook.id} size={scale(48)} />
      <View style={styles.nowPlayingInfo}>
        <Text style={styles.nowPlayingLabel}>Now Playing</Text>
        <Text style={styles.nowPlayingTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.nowPlayingChapter} numberOfLines={1}>{chapterTitle}</Text>
      </View>
      <Text style={styles.nowPlayingTime}>{formatTimeRemaining(timeRemaining)}</Text>
    </View>
  );
}

function QueueRow({ item, onRemove, onPlay }: { item: QueueBook; onRemove: () => void; onPlay?: () => void }) {
  const { title, author, duration } = getMetadata(item.book);
  const durationText = duration > 0 ? formatDuration(duration) : '';
  const subtitle = durationText ? `${author} · ${durationText}` : author;

  return (
    <View style={[styles.row, item.played && styles.rowPlayed]}>
      {!item.played && (
        <View style={styles.gripHandle}>
          <GripIcon size={scale(16)} />
        </View>
      )}
      <BookCover bookId={item.book.id} size={scale(44)} />
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, item.played && styles.textFaded]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rowSubtitle, item.played && styles.textFaded]} numberOfLines={1}>{subtitle}</Text>
      </View>
      {onPlay && !item.played ? (
        <TouchableOpacity style={styles.playBtn} onPress={onPlay}>
          <PlayIcon />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
        <CloseIcon color="rgba(255,255,255,0.4)" size={scale(12)} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function QueuePanel({ onClose }: QueuePanelProps) {
  const queue = useQueue();
  const upNext = useMemo(() => getUpNextQueue(queue), [queue]);
  const played = useMemo(() => getPlayedQueue(queue), [queue]);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);
  const clearQueue = useQueueStore((s) => s.clearQueue);

  const totalDuration = useMemo(() =>
    upNext.reduce((acc, item) => acc + ((item.book.media as any)?.duration || 0), 0),
    [upNext]
  );

  const handleRemove = useCallback((bookId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    removeFromQueue(bookId);
  }, [removeFromQueue]);

  const handleClear = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    clearQueue();
  }, [clearQueue]);

  const handlePlay = useCallback((book: LibraryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(async () => {
      try {
        const { usePlayerStore } = await import('@/features/player/stores');
        usePlayerStore.getState().loadBook(book, { autoPlay: true, showPlayer: true });
      } catch (_) {}
    }, 200);
  }, [onClose]);

  // Empty state
  if (queue.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Queue</Text>
          <Text style={styles.subtitle}>Empty</Text>
        </View>
        <NowPlayingSection />
        <View style={styles.emptyContainer}>
          <LayersIcon size={scale(48)} />
          <Text style={styles.emptyText}>Your queue is empty</Text>
          <Text style={styles.emptySubtext}>Add audiobooks to play them next</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Queue</Text>
        <Text style={styles.subtitle}>
          {upNext.length} upcoming · {formatDuration(totalDuration)}
        </Text>
      </View>

      {/* Now Playing */}
      <NowPlayingSection />

      {/* Scrollable Content */}
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Up Next */}
        {upNext.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Up Next</Text>
              <TouchableOpacity onPress={handleClear}>
                <Text style={styles.sectionAction}>Clear</Text>
              </TouchableOpacity>
            </View>
            {upNext.map((item) => (
              <QueueRow key={item.id} item={item} onRemove={() => handleRemove(item.bookId)} onPlay={() => handlePlay(item.book)} />
            ))}
          </View>
        )}

        {/* Played */}
        {played.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Played</Text>
            </View>
            {played.map((item) => (
              <QueueRow key={item.id} item={item} onRemove={() => handleRemove(item.bookId)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: scale(24),
    marginTop: scale(20),
    marginBottom: scale(16),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(24),
    fontWeight: '400',
    color: '#fff',
  },
  subtitle: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.4)',
  },

  // Now Playing
  nowPlaying: {
    marginHorizontal: scale(24),
    marginBottom: scale(16),
    padding: scale(14),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(10),
    flexDirection: 'row',
    gap: scale(12),
    alignItems: 'center',
  },
  nowPlayingInfo: {
    flex: 1,
  },
  nowPlayingLabel: {
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: scale(2),
  },
  nowPlayingTitle: {
    fontSize: scale(14),
    fontWeight: '500',
    color: '#fff',
    marginBottom: scale(2),
  },
  nowPlayingChapter: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
  },
  nowPlayingTime: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.4)',
  },

  // Scroll
  scrollContent: {
    maxHeight: scale(350),
    paddingHorizontal: scale(24),
  },

  // Section
  section: {
    marginBottom: scale(16),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  sectionTitle: {
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
  sectionAction: {
    fontSize: scale(11),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: scale(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  rowPlayed: {
    opacity: 0.5,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: scale(14),
    fontWeight: '500',
    color: '#fff',
    marginBottom: scale(2),
  },
  rowSubtitle: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.4)',
  },
  textFaded: {
    color: 'rgba(255,255,255,0.3)',
  },
  playBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    width: scale(28),
    height: scale(28),
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: scale(48),
  },
  emptyText: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#fff',
    marginTop: scale(16),
  },
  emptySubtext: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.4)',
    marginTop: scale(8),
  },
});

export default QueuePanel;
