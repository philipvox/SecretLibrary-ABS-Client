/**
 * src/features/queue/components/QueueItem.tsx
 *
 * Single queue item for full queue list view.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { colors, scale } from '@/shared/theme';

const COLORS = {
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  accent: colors.success,
  cardBg: colors.cardBackground,
};

// Drag handle icon
const DragIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 6h2M8 10h2M8 14h2M8 18h2M14 6h2M14 10h2M14 14h2M14 18h2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

// Remove icon
const RemoveIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 6L6 18M6 6l12 12"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

interface QueueItemProps {
  book: LibraryItem;
  position: number;
  onRemove: () => void;
  onDragStart?: () => void;
}

export function QueueItem({ book, position, onRemove, onDragStart }: QueueItemProps) {
  const coverUrl = useCoverUrl(book.id);
  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Untitled';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';

  // Calculate duration
  const duration = book.media?.duration || 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <View style={styles.container}>
      {/* Drag handle */}
      <Pressable style={styles.dragHandle} onLongPress={onDragStart}>
        <DragIcon size={scale(18)} color={COLORS.textSecondary} />
      </Pressable>

      {/* Position number */}
      <View style={styles.positionContainer}>
        <Text style={styles.positionNumber}>{position + 1}</Text>
      </View>

      {/* Cover */}
      <Image source={coverUrl} style={styles.cover} contentFit="cover" />

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
        <Text style={styles.duration}>{durationText}</Text>
      </View>

      {/* Remove button */}
      <Pressable style={styles.removeButton} onPress={onRemove}>
        <RemoveIcon size={scale(18)} color={COLORS.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    backgroundColor: COLORS.cardBg,
    borderRadius: scale(12),
    marginBottom: scale(8),
    gap: scale(10),
  },
  dragHandle: {
    padding: scale(4),
  },
  positionContainer: {
    width: scale(24),
    alignItems: 'center',
  },
  positionNumber: {
    fontSize: scale(14),
    fontWeight: '600',
    color: COLORS.accent,
  },
  cover: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(6),
    backgroundColor: '#262626',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: scale(14),
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: scale(2),
  },
  author: {
    fontSize: scale(12),
    color: COLORS.textSecondary,
    marginBottom: scale(2),
  },
  duration: {
    fontSize: scale(11),
    color: COLORS.textSecondary,
  },
  removeButton: {
    padding: scale(8),
  },
});
