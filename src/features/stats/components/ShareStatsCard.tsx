/**
 * src/features/stats/components/ShareStatsCard.tsx
 *
 * A visual card that can be captured and shared as an image.
 * Shows listening stats in a shareable format.
 */

import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Icon } from '@/shared/components/Icon';
import { formatDuration } from '@/shared/utils/format';
import { shareWeeklyStats, shareStreak, shareMilestone } from '../services/shareService';
import { wp, useTheme } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);

// Static colors for StyleSheet (card gradient is always the same)
const STATIC_COLORS = {
  cardGradientStart: '#16213E',
  cardGradientEnd: '#0F3460',
};

interface ShareStatsCardProps {
  type: 'weekly' | 'streak' | 'allTime';
  weeklyStats?: {
    totalSeconds: number;
    sessionCount: number;
    uniqueBooks: number;
  };
  streakStats?: {
    currentStreak: number;
    longestStreak: number;
  };
  allTimeStats?: {
    totalSeconds: number;
    totalSessions: number;
    uniqueBooks: number;
  };
  onClose?: () => void;
}

export function ShareStatsCard({
  type,
  weeklyStats,
  streakStats,
  allTimeStats,
  onClose,
}: ShareStatsCardProps) {
  const { colors } = useTheme();
  const cardRef = useRef<View>(null);

  // Share card colors (derived from theme)
  const COLORS = {
    background: colors.background.tertiary,
    cardGradientStart: '#16213E',
    cardGradientEnd: '#0F3460',
    accent: colors.accent.primary,
    text: colors.text.primary,
    textSecondary: colors.text.secondary,
  };

  const handleShare = useCallback(async () => {
    try {
      let success = false;

      switch (type) {
        case 'weekly':
          success = await shareWeeklyStats();
          break;
        case 'streak':
          if (streakStats) {
            success = await shareStreak(streakStats.currentStreak);
          }
          break;
        case 'allTime':
          if (allTimeStats) {
            const totalHours = Math.floor(allTimeStats.totalSeconds / 3600);
            success = await shareMilestone(totalHours);
          }
          break;
      }

      if (success && onClose) {
        onClose();
      }
    } catch {
      Alert.alert('Share Failed', 'Could not share your stats. Please try again.');
    }
  }, [type, streakStats, allTimeStats, onClose]);

  const renderWeeklyCard = () => (
    <View style={styles.statsContent}>
      <Text style={[styles.cardLabel, { color: COLORS.accent }]}>This Week</Text>
      <Text style={[styles.mainStat, { color: COLORS.text }]}>
        {formatDuration(weeklyStats?.totalSeconds || 0)}
      </Text>
      <Text style={[styles.mainStatLabel, { color: COLORS.textSecondary }]}>of listening</Text>
      <View style={styles.statRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.text }]}>{weeklyStats?.sessionCount || 0}</Text>
          <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.text }]}>{weeklyStats?.uniqueBooks || 0}</Text>
          <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>books</Text>
        </View>
      </View>
    </View>
  );

  const renderStreakCard = () => (
    <View style={styles.statsContent}>
      <Icon name="Flame" size={48} color="#FF9500" />
      <Text style={[styles.mainStat, { color: COLORS.text }]}>{streakStats?.currentStreak || 0}</Text>
      <Text style={[styles.mainStatLabel, { color: COLORS.textSecondary }]}>day streak</Text>
      {streakStats && streakStats.longestStreak > streakStats.currentStreak && (
        <Text style={[styles.secondaryStat, { color: COLORS.textSecondary }]}>
          Best: {streakStats.longestStreak} days
        </Text>
      )}
    </View>
  );

  const renderAllTimeCard = () => {
    const totalHours = Math.floor((allTimeStats?.totalSeconds || 0) / 3600);
    return (
      <View style={styles.statsContent}>
        <Text style={[styles.cardLabel, { color: COLORS.accent }]}>All Time</Text>
        <Text style={[styles.mainStat, { color: COLORS.text }]}>{totalHours}</Text>
        <Text style={[styles.mainStatLabel, { color: COLORS.textSecondary }]}>hours listened</Text>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.text }]}>{allTimeStats?.totalSessions || 0}</Text>
            <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.text }]}>{allTimeStats?.uniqueBooks || 0}</Text>
            <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>books</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card} ref={cardRef}>
        <View style={styles.cardBackground}>
          {type === 'weekly' && renderWeeklyCard()}
          {type === 'streak' && renderStreakCard()}
          {type === 'allTime' && renderAllTimeCard()}

          <View style={styles.branding}>
            <Icon name="Headset" size={16} color={COLORS.textSecondary} />
            <Text style={[styles.brandingText, { color: COLORS.textSecondary }]}>AudiobookShelf</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.shareButton, { backgroundColor: COLORS.accent }]} onPress={handleShare}>
          <Icon name="Share" size={20} color={COLORS.background} />
          <Text style={[styles.shareButtonText, { color: COLORS.background }]}>Share</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={[styles.cancelButtonText, { color: COLORS.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: SCREEN_WIDTH - 60,
    aspectRatio: 1,
    maxWidth: 320,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  cardBackground: {
    flex: 1,
    backgroundColor: STATIC_COLORS.cardGradientStart,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    // color set via COLORS in JSX
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  mainStat: {
    fontSize: 72,
    fontWeight: '800',
    // color set via COLORS in JSX
    letterSpacing: -2,
  },
  mainStatLabel: {
    fontSize: 18,
    // color set via COLORS in JSX
    marginTop: 4,
  },
  secondaryStat: {
    fontSize: 14,
    // color set via COLORS in JSX
    marginTop: 16,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    // color set via COLORS in JSX
  },
  statLabel: {
    fontSize: 12,
    // color set via COLORS in JSX
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  branding: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandingText: {
    fontSize: 12,
    // color set via COLORS in JSX
    fontWeight: '500',
  },
  actions: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set via COLORS in JSX
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    // color set via COLORS in JSX
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 15,
    // color set via COLORS in JSX
  },
});
