/**
 * src/features/home/components/SeriesCard.tsx
 *
 * Series card with 5 horizontal stacked covers
 * Anima: 110x86.5px total
 * 5 covers at left: 0, 17, 34, 51, 68 (17px offset)
 * Each cover: 35x51px rounded-[5px] shadow-[9px_4px_2px_#00000075]
 * Title at top:60
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { apiClient } from '@/core/api';
import { colors, scale } from '@/shared/theme';
import { SeriesCardProps } from '../types';
import { SeriesHeartButton } from '@/shared/components';
import { useQueueStore } from '@/features/queue';

const COLORS = { textPrimary: colors.textPrimary, heart: colors.heartFill };

// Queue Plus icon SVG
const QueuePlusIcon = ({ size = 12, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5v14M5 12h14"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Queue Checkmark icon SVG
const QueueCheckIcon = ({ size = 12, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 6L9 17l-5-5"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export function SeriesCard({ series, onPress, onLongPress }: SeriesCardProps) {
  // Get cover URLs for up to 5 books
  const coverUrls = series.books.slice(0, 5).map((book) => apiClient.getItemCoverUrl(book.id));

  // Anima positions: left 0, 17, 34, 51, 68
  const positions = [0, 17, 34, 51, 68];

  // Queue state - check if all books are in queue
  const queue = useQueueStore((state) => state.queue);
  const addBooksToQueue = useQueueStore((state) => state.addBooksToQueue);
  const removeFromQueue = useQueueStore((state) => state.removeFromQueue);

  // Check if any book from the series is in the queue
  const seriesInQueue = useMemo(() => {
    const queueBookIds = new Set(queue.map((item) => item.bookId));
    return series.books.some((book) => queueBookIds.has(book.id));
  }, [queue, series.books]);

  const handleQueueToggle = useCallback(() => {
    if (seriesInQueue) {
      // Remove all series books from queue
      series.books.forEach((book) => removeFromQueue(book.id));
    } else {
      // Add all series books to queue
      addBooksToQueue(series.books);
    }
  }, [seriesInQueue, series.books, addBooksToQueue, removeFromQueue]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* 5 Stacked Covers */}
      <View style={styles.stackContainer}>
        {positions.map((left, index) => (
          <View
            key={index}
            style={[
              styles.coverWrapper,
              {
                left: scale(left),
                zIndex: 5 - index, // First cover on top
              },
            ]}
          >
            {coverUrls[index] ? (
              <Image
                source={{ uri: coverUrls[index] }}
                style={styles.cover}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.placeholder} />
            )}
          </View>
        ))}
      </View>

      {/* Title and buttons in a row */}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {series.name}
        </Text>
        <Pressable style={styles.queueButton} onPress={handleQueueToggle}>
          {seriesInQueue ? (
            <QueueCheckIcon size={scale(12)} color={COLORS.heart} />
          ) : (
            <QueuePlusIcon size={scale(12)} color="rgba(255,255,255,0.3)" />
          )}
        </Pressable>
        <SeriesHeartButton
          seriesName={series.name}
          size={scale(12)}
          activeColor={COLORS.heart}
          inactiveColor="rgba(255,255,255,0.3)"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: scale(110),
    height: scale(86),
    position: 'relative',
  },
  stackContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: scale(103), // 68 + 35 = 103
    height: scale(51),
  },
  coverWrapper: {
    position: 'absolute',
    top: 0,
    width: scale(35),
    height: scale(51),
    borderRadius: scale(5),
    overflow: 'hidden',
    backgroundColor: '#7D7D7D',
    // Anima shadow: 9px 4px 2px rgba(0,0,0,0.46)
    shadowColor: '#000000',
    shadowOffset: { width: 9, height: 4 },
    shadowOpacity: 0.46,
    shadowRadius: 2,
    elevation: 4,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#7D7D7D',
  },
  titleRow: {
    position: 'absolute',
    top: scale(56),
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  queueButton: {
    padding: scale(2),
  },
  title: {
    flex: 1,
    fontFamily: 'System',
    fontSize: scale(12),
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: scale(14),
  },
});
