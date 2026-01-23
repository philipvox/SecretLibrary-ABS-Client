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
import { wp, moderateScale } from '@/shared/theme';
import { useColors } from '@/shared/theme/themeStore';

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

/**
 * Get time-based greeting
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export function HomeHeader({
  title,
  author,
  currentTime,
  isPlaying,
}: HomeHeaderProps) {
  const colors = useColors();

  // Empty state when no book is loaded - show personalized greeting
  if (!title) {
    return (
      <View style={styles.headerEmpty}>
        <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
          {getGreeting()}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.text.tertiary }]}>
          Ready to listen?
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.time, { color: colors.text.secondary }]}>
          {formatTime(currentTime)}
        </Text>
      </View>
      <Text style={[styles.author, { color: colors.text.tertiary }]} numberOfLines={1}>
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
    fontSize: moderateScale(17),
    fontWeight: '600',
    marginRight: wp(3),
  },
  time: {
    fontSize: moderateScale(14),
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
  },
  author: {
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
    fontSize: moderateScale(24),
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    textAlign: 'center',
    marginTop: wp(1),
  },
});

export default HomeHeader;
