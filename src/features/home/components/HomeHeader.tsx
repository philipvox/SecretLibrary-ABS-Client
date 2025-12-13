/**
 * src/features/home/components/HomeHeader.tsx
 *
 * Header for redesigned Home screen
 * Shows: Title (left) | Time (right)
 *        Author (left)
 *
 * When no book is playing, shows centered empty state
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, wp, moderateScale } from '@/shared/theme';

interface HomeHeaderProps {
  /** Book title - null when nothing playing */
  title: string | null;
  /** Author name - null when nothing playing */
  author: string | null;
  /** Current playback position in seconds */
  currentTime: number;
  /** Whether audio is currently playing */
  isPlaying: boolean;
}

/**
 * Format time as HH:MM:SS
 */
function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function HomeHeader({
  title,
  author,
  currentTime,
  isPlaying,
}: HomeHeaderProps) {
  // Empty state when no book is loaded
  if (!title) {
    return (
      <View style={styles.headerEmpty}>
        <Text style={styles.emptyTitle}>CassetteShelf</Text>
        <Text style={styles.emptySubtitle}>Select a book to start listening</Text>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.time}>{formatTime(currentTime)}</Text>
      </View>
      <Text style={styles.author} numberOfLines={1}>
        {author || 'Unknown Author'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: wp(5.5),
    paddingTop: wp(2),
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: moderateScale(17),
    fontWeight: '600',
    marginRight: wp(3),
  },
  time: {
    color: colors.textSecondary,
    fontSize: moderateScale(14),
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
  },
  author: {
    color: colors.textTertiary,
    fontSize: moderateScale(14),
    marginTop: wp(1),
  },

  // Empty state
  headerEmpty: {
    paddingHorizontal: wp(5.5),
    paddingTop: wp(4),
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(24),
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textTertiary,
    fontSize: moderateScale(14),
    textAlign: 'center',
    marginTop: wp(1),
  },
});

export default HomeHeader;
