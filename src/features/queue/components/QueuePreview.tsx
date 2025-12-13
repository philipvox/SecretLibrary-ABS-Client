/**
 * src/features/queue/components/QueuePreview.tsx
 *
 * Queue preview component with two variants:
 * - "compact": Small indicator for home screen
 * - "full": List view for player screen with autoplay toggle
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useQueue, useQueueStore, useAutoplayEnabled, useAutoSeriesBookId } from '../stores/queueStore';
import { BookCard } from '@/shared/components/BookCard';
import { colors, scale } from '@/shared/theme';

const COLORS = {
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  accent: colors.success,
  cardBg: colors.cardBackground,
};

// Queue icon
const QueueIcon = ({ size = 16, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 6h16M4 12h16M4 18h10"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

interface QueuePreviewProps {
  variant?: 'compact' | 'full';
}

export function QueuePreview({ variant = 'full' }: QueuePreviewProps) {
  const navigation = useNavigation<any>();
  const queue = useQueue();
  const autoplayEnabled = useAutoplayEnabled();
  const autoSeriesBookId = useAutoSeriesBookId();
  const setAutoplayEnabled = useQueueStore((state) => state.setAutoplayEnabled);

  const handleSeeAll = useCallback(() => {
    navigation.navigate('QueueScreen');
  }, [navigation]);

  const handleToggleAutoplay = useCallback(
    (value: boolean) => {
      setAutoplayEnabled(value);
    },
    [setAutoplayEnabled]
  );

  const handleBookPress = useCallback(
    (bookId: string) => {
      navigation.navigate('BookDetail', { id: bookId });
    },
    [navigation]
  );

  // Don't render if queue is empty and no autoplay setting to show
  if (queue.length === 0 && variant === 'compact') return null;

  // Compact variant - just a small indicator
  if (variant === 'compact') {
    const nextBook = queue[0]?.book;
    const nextTitle = (nextBook?.media?.metadata as any)?.title || 'Untitled';

    return (
      <TouchableOpacity style={styles.compactContainer} onPress={handleSeeAll}>
        <QueueIcon size={scale(14)} color={COLORS.accent} />
        <Text style={styles.compactText} numberOfLines={1}>
          Up next: {nextTitle}
        </Text>
        <Text style={styles.compactCount}>+{queue.length}</Text>
      </TouchableOpacity>
    );
  }

  // Full variant - list view with autoplay toggle
  return (
    <View style={styles.container}>
      {/* Header with autoplay toggle */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Up Next</Text>
        <View style={styles.headerRight}>
          <Text style={styles.autoplayLabel}>Autoplay</Text>
          <Switch
            value={autoplayEnabled}
            onValueChange={handleToggleAutoplay}
            trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: COLORS.accent }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="rgba(255, 255, 255, 0.2)"
            style={styles.switch}
          />
        </View>
      </View>

      {/* Queue items list */}
      {queue.length > 0 ? (
        <View style={styles.listContainer}>
          {queue.slice(0, 5).map((item) => {
            const isAutoSeries = item.bookId === autoSeriesBookId;

            return (
              <View key={item.id} style={styles.listItem}>
                {isAutoSeries && (
                  <View style={styles.autoSeriesBadge}>
                    <Text style={styles.autoSeriesText}>From series</Text>
                  </View>
                )}
                <BookCard
                  book={item.book}
                  onPress={() => handleBookPress(item.bookId)}
                  showListeningProgress={true}
                />
              </View>
            );
          })}

          {/* See all link */}
          {queue.length > 5 && (
            <TouchableOpacity style={styles.seeAllContainer} onPress={handleSeeAll}>
              <Text style={styles.seeAll}>See all ({queue.length} in queue)</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {autoplayEnabled
              ? 'Queue is empty. Next book in series will auto-add.'
              : 'Queue is empty. Add books to play next.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    marginHorizontal: scale(10),
    marginTop: scale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: scale(10),
    gap: scale(8),
  },
  compactText: {
    flex: 1,
    fontSize: scale(13),
    color: COLORS.textPrimary,
  },
  compactCount: {
    fontSize: scale(12),
    fontWeight: '600',
    color: COLORS.accent,
  },

  // Full styles
  container: {
    marginTop: scale(16),
    paddingHorizontal: scale(10),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  headerTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  autoplayLabel: {
    fontSize: scale(13),
    color: COLORS.textSecondary,
  },
  switch: {
    transform: [{ scale: 0.8 }],
  },
  listContainer: {
    gap: scale(4),
  },
  listItem: {
    position: 'relative',
  },
  autoSeriesBadge: {
    position: 'absolute',
    top: scale(2),
    right: scale(2),
    backgroundColor: COLORS.accent,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    zIndex: 1,
  },
  autoSeriesText: {
    fontSize: scale(9),
    fontWeight: '600',
    color: '#000000',
  },
  seeAllContainer: {
    alignItems: 'center',
    paddingVertical: scale(12),
  },
  seeAll: {
    fontSize: scale(13),
    color: COLORS.accent,
    fontWeight: '500',
  },
  emptyState: {
    paddingVertical: scale(20),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: scale(13),
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
