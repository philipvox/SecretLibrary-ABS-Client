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
import { formatDuration } from '../hooks/useListeningStats';
import { shareWeeklyStats, shareStreak, shareMilestone } from '../services/shareService';
import { colors, wp } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);

// Share card colors
const COLORS = {
  background: colors.backgroundTertiary,
  cardGradientStart: '#16213E',
  cardGradientEnd: '#0F3460',
  accent: colors.accent,
  text: colors.textPrimary,
  textSecondary: colors.textSecondary,
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
  const cardRef = useRef<View>(null);

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
    } catch (error) {
      Alert.alert('Share Failed', 'Could not share your stats. Please try again.');
    }
  }, [type, streakStats, allTimeStats, onClose]);

  const renderWeeklyCard = () => (
    <View style={styles.statsContent}>
      <Text style={styles.cardLabel}>This Week</Text>
      <Text style={styles.mainStat}>
        {formatDuration(weeklyStats?.totalSeconds || 0)}
      </Text>
      <Text style={styles.mainStatLabel}>of listening</Text>
      <View style={styles.statRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{weeklyStats?.sessionCount || 0}</Text>
          <Text style={styles.statLabel}>sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{weeklyStats?.uniqueBooks || 0}</Text>
          <Text style={styles.statLabel}>books</Text>
        </View>
      </View>
    </View>
  );

  const renderStreakCard = () => (
    <View style={styles.statsContent}>
      <Icon name="flame" size={48} color="#FF9500" set="ionicons" />
      <Text style={styles.mainStat}>{streakStats?.currentStreak || 0}</Text>
      <Text style={styles.mainStatLabel}>day streak</Text>
      {streakStats && streakStats.longestStreak > streakStats.currentStreak && (
        <Text style={styles.secondaryStat}>
          Best: {streakStats.longestStreak} days
        </Text>
      )}
    </View>
  );

  const renderAllTimeCard = () => {
    const totalHours = Math.floor((allTimeStats?.totalSeconds || 0) / 3600);
    return (
      <View style={styles.statsContent}>
        <Text style={styles.cardLabel}>All Time</Text>
        <Text style={styles.mainStat}>{totalHours}</Text>
        <Text style={styles.mainStatLabel}>hours listened</Text>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{allTimeStats?.totalSessions || 0}</Text>
            <Text style={styles.statLabel}>sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{allTimeStats?.uniqueBooks || 0}</Text>
            <Text style={styles.statLabel}>books</Text>
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
            <Icon name="headset" size={16} color={COLORS.textSecondary} set="ionicons" />
            <Text style={styles.brandingText}>AudiobookShelf</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Icon name="share-outline" size={20} color={COLORS.background} set="ionicons" />
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: COLORS.cardGradientStart,
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
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  mainStat: {
    fontSize: 72,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -2,
  },
  mainStatLabel: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  secondaryStat: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});
