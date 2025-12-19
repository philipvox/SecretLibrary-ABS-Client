/**
 * src/features/wishlist/components/WishlistItemRow.tsx
 *
 * Single wishlist item row component.
 * Displays book info, priority, and actions.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Bookmark,
  Star,
  MoreVertical,
  Clock,
  User,
  Trash2,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { WishlistItem, WishlistPriority } from '../types';
import { useWishlistStore } from '../stores/wishlistStore';
import { useCoverUrl, useLibraryCache } from '@/core/cache';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

interface WishlistItemRowProps {
  item: WishlistItem;
  onPress: (item: WishlistItem) => void;
  onLongPress?: (item: WishlistItem) => void;
}

const PRIORITY_CONFIG: Record<WishlistPriority, { label: string; color: string; icon: 'star' | 'bookmark' }> = {
  'must-read': { label: 'Must Read', color: '#FF6B6B', icon: 'star' },
  'want-to-read': { label: 'Want to Read', color: ACCENT, icon: 'bookmark' },
  'maybe': { label: 'Maybe', color: 'rgba(255,255,255,0.4)', icon: 'bookmark' },
};

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function WishlistItemRow({ item, onPress, onLongPress }: WishlistItemRowProps) {
  const removeItem = useWishlistStore((s) => s.removeItem);
  const getItem = useLibraryCache((s) => s.getItem);

  // Get library item if it exists
  const libraryItem = item.libraryItemId ? getItem(item.libraryItemId) : undefined;
  const metadata = libraryItem?.media?.metadata as any;

  // Get cover URL if it's a library item
  const coverUrl = useCoverUrl(item.libraryItemId || '');

  // Get display data - prefer library item data over manual entry
  const title = metadata?.title || item.manual?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || item.manual?.author || 'Unknown Author';
  const narrator = metadata?.narratorName || metadata?.narrators?.[0]?.name || item.manual?.narrator;
  const duration = (libraryItem?.media as any)?.duration || item.manual?.estimatedDuration;
  const series = metadata?.seriesName?.replace(/\s*#[\d.]+$/, '') || item.manual?.series;
  const seriesSeq = metadata?.seriesName?.match(/#([\d.]+)/)?.[1] || item.manual?.seriesSequence;
  const displayCover = item.manual?.coverUrl || coverUrl;

  const priorityConfig = PRIORITY_CONFIG[item.priority];

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  }, [item, onPress]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.(item);
  }, [item, onLongPress]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Remove from Wishlist',
      `Remove "${title}" from your wishlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            removeItem(item.id);
          },
        },
      ]
    );
  }, [item.id, title, removeItem]);

  // Series badge text
  const seriesText = useMemo(() => {
    if (!series) return null;
    return seriesSeq ? `${series} #${seriesSeq}` : series;
  }, [series, seriesSeq]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      {/* Cover */}
      <View style={styles.coverContainer}>
        {displayCover ? (
          <Image
            source={displayCover}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Bookmark size={scale(24)} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
          </View>
        )}
        {/* Priority indicator */}
        <View style={[styles.priorityBadge, { backgroundColor: priorityConfig.color }]}>
          {item.priority === 'must-read' ? (
            <Star size={scale(10)} color="#000" fill="#000" strokeWidth={0} />
          ) : (
            <Bookmark size={scale(10)} color="#000" fill="#000" strokeWidth={0} />
          )}
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>

        <View style={styles.metaRow}>
          <User size={scale(11)} color="rgba(255,255,255,0.5)" strokeWidth={2} />
          <Text style={styles.metaText} numberOfLines={1}>{author}</Text>
        </View>

        {narrator && (
          <Text style={styles.narratorText} numberOfLines={1}>
            Narrated by {narrator}
          </Text>
        )}

        <View style={styles.tagsRow}>
          {seriesText && (
            <View style={styles.seriesBadge}>
              <Text style={styles.seriesText} numberOfLines={1}>{seriesText}</Text>
            </View>
          )}
          {duration && (
            <View style={styles.durationBadge}>
              <Clock size={scale(10)} color="rgba(255,255,255,0.5)" strokeWidth={2} />
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            </View>
          )}
        </View>

        {item.notes && (
          <Text style={styles.notes} numberOfLines={1}>
            {item.notes}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={scale(18)} color="rgba(255,255,255,0.4)" strokeWidth={2} />
        </TouchableOpacity>
        <ChevronRight size={scale(16)} color="rgba(255,255,255,0.3)" strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    backgroundColor: 'transparent',
  },
  coverContainer: {
    position: 'relative',
  },
  cover: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(8),
    backgroundColor: '#262626',
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityBadge: {
    position: 'absolute',
    bottom: scale(-4),
    right: scale(-4),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: scale(12),
    gap: scale(2),
  },
  title: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#fff',
    marginBottom: scale(2),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  metaText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },
  narratorText: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.4)',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: scale(4),
  },
  seriesBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    maxWidth: scale(120),
  },
  seriesText: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.6)',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  durationText: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.5)',
  },
  notes: {
    fontSize: scale(11),
    color: ACCENT,
    fontStyle: 'italic',
    marginTop: scale(2),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginLeft: scale(8),
  },
  deleteButton: {
    padding: scale(4),
  },
});
