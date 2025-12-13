/**
 * src/features/stats/screens/StatsScreen.tsx
 *
 * Listening statistics screen showing today, weekly, all-time stats,
 * streak information, top books, and listening patterns.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/shared/components/Icon';
import {
  useStatsScreen,
  formatDuration,
  formatDurationLong,
  getWeekdayName,
} from '../hooks/useListeningStats';
import { ShareStatsCard } from '../components/ShareStatsCard';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, wp } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);

// Dark theme colors using theme tokens
const COLORS = {
  background: colors.backgroundTertiary,
  card: colors.backgroundElevated,
  cardBorder: 'rgba(255,255,255,0.12)',
  text: colors.textPrimary,
  textSecondary: colors.textSecondary,
  textTertiary: colors.textTertiary,
  accent: colors.accent,
  accentDim: colors.accentSubtle,
  streakActive: colors.warning,
  success: colors.success,
};

// Stat card component
interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
}

function StatCard({ icon, label, value, subtitle, accentColor }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, accentColor && { backgroundColor: accentColor }]}>
        <Icon name={icon} size={20} color={COLORS.text} set="ionicons" />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );
}

// Weekly bar chart component
interface WeeklyChartProps {
  dailyBreakdown: Array<{ date: string; totalSeconds: number }>;
}

function WeeklyChart({ dailyBreakdown }: WeeklyChartProps) {
  const maxSeconds = useMemo(() => {
    return Math.max(...dailyBreakdown.map((d) => d.totalSeconds), 1);
  }, [dailyBreakdown]);

  // Create array for last 7 days (most recent on right)
  const last7Days = useMemo(() => {
    const days: Array<{ date: string; totalSeconds: number; weekday: string }> = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const found = dailyBreakdown.find((db) => db.date === dateStr);
      days.push({
        date: dateStr,
        totalSeconds: found?.totalSeconds || 0,
        weekday: getWeekdayName(dateStr),
      });
    }

    return days;
  }, [dailyBreakdown]);

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {last7Days.map((day, index) => {
          const height = Math.max((day.totalSeconds / maxSeconds) * 80, 4);
          const isToday = index === last7Days.length - 1;

          return (
            <View key={day.date} style={styles.chartBarWrapper}>
              <View style={styles.chartBarContainer}>
                <View
                  style={[
                    styles.chartBar,
                    { height },
                    isToday && styles.chartBarToday,
                    day.totalSeconds === 0 && styles.chartBarEmpty,
                  ]}
                />
              </View>
              <Text style={[styles.chartLabel, isToday && styles.chartLabelToday]}>
                {day.weekday}
              </Text>
              {day.totalSeconds > 0 && (
                <Text style={styles.chartValue}>{formatDuration(day.totalSeconds)}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Hour heatmap component
interface HourHeatmapProps {
  byHour: Array<{ hour: number; totalSeconds: number }>;
}

function HourHeatmap({ byHour }: HourHeatmapProps) {
  const maxSeconds = useMemo(() => {
    return Math.max(...byHour.map((h) => h.totalSeconds), 1);
  }, [byHour]);

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12a';
    if (hour === 12) return '12p';
    if (hour < 12) return `${hour}a`;
    return `${hour - 12}p`;
  };

  return (
    <View style={styles.heatmapContainer}>
      <View style={styles.heatmapGrid}>
        {byHour.map((item) => {
          const intensity = item.totalSeconds / maxSeconds;
          const backgroundColor =
            intensity === 0
              ? COLORS.cardBorder
              : `rgba(204, 255, 0, ${0.2 + intensity * 0.8})`;

          return (
            <View key={item.hour} style={styles.heatmapCellWrapper}>
              <View style={[styles.heatmapCell, { backgroundColor }]} />
              {item.hour % 6 === 0 && (
                <Text style={styles.heatmapLabel}>{formatHour(item.hour)}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Top books list
interface TopBooksProps {
  topBooks: Array<{ bookId: string; bookTitle: string; totalSeconds: number }>;
}

function TopBooksList({ topBooks }: TopBooksProps) {
  if (topBooks.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No listening data yet</Text>
      </View>
    );
  }

  const maxSeconds = topBooks[0]?.totalSeconds || 1;

  return (
    <View style={styles.topBooksContainer}>
      {topBooks.map((book, index) => {
        const barWidth = (book.totalSeconds / maxSeconds) * 100;

        return (
          <View key={book.bookId} style={styles.topBookItem}>
            <View style={styles.topBookRank}>
              <Text style={styles.topBookRankText}>{index + 1}</Text>
            </View>
            <View style={styles.topBookInfo}>
              <Text style={styles.topBookTitle} numberOfLines={1}>
                {book.bookTitle}
              </Text>
              <View style={styles.topBookBarContainer}>
                <View style={[styles.topBookBar, { width: `${barWidth}%` }]} />
              </View>
            </View>
            <Text style={styles.topBookTime}>{formatDuration(book.totalSeconds)}</Text>
          </View>
        );
      })}
    </View>
  );
}

type ShareType = 'weekly' | 'streak' | 'allTime' | null;

export function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { today, weekly, streak, allTime, topBooks, byHour, isLoading, refetch } =
    useStatsScreen();

  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareType, setShareType] = useState<ShareType>(null);

  const todayTime = today?.totalSeconds || 0;
  const weeklyTime = weekly?.totalSeconds || 0;
  const allTimeTime = allTime?.totalSeconds || 0;
  const currentStreak = streak?.currentStreak || 0;
  const longestStreak = streak?.longestStreak || 0;
  const uniqueBooks = allTime?.uniqueBooks || 0;
  const avgSession = allTime?.averageSessionLength || 0;

  const openShareModal = (type: ShareType) => {
    setShareType(type);
    setShareModalVisible(true);
  };

  const closeShareModal = () => {
    setShareModalVisible(false);
    setShareType(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + TOP_NAV_HEIGHT }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={COLORS.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Listening Stats</Text>
        </View>

        {/* Today's Stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today</Text>
          <View style={styles.todayStats}>
            <View style={styles.todayMain}>
              <Text style={styles.todayTime}>{formatDuration(todayTime)}</Text>
              <Text style={styles.todayLabel}>listened today</Text>
            </View>
            {today && (
              <View style={styles.todayMeta}>
                <Text style={styles.todayMetaText}>
                  {today.sessionCount} session{today.sessionCount !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.todayMetaText}>
                  {today.booksTouched.length} book{today.booksTouched.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Streak */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Streak</Text>
            {currentStreak > 0 && (
              <TouchableOpacity
                style={styles.shareIconButton}
                onPress={() => openShareModal('streak')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="share-outline" size={18} color={COLORS.textTertiary} set="ionicons" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.streakContainer}>
            <View style={styles.streakItem}>
              <Icon
                name="flame"
                size={28}
                color={currentStreak > 0 ? COLORS.streakActive : COLORS.textTertiary}
                set="ionicons"
              />
              <Text style={styles.streakValue}>{currentStreak}</Text>
              <Text style={styles.streakLabel}>
                day{currentStreak !== 1 ? 's' : ''} current
              </Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakItem}>
              <Icon name="trophy" size={28} color={COLORS.accent} set="ionicons" />
              <Text style={styles.streakValue}>{longestStreak}</Text>
              <Text style={styles.streakLabel}>
                day{longestStreak !== 1 ? 's' : ''} best
              </Text>
            </View>
          </View>
        </View>

        {/* Weekly Overview */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>This Week</Text>
            {weeklyTime > 0 && (
              <TouchableOpacity
                style={styles.shareIconButton}
                onPress={() => openShareModal('weekly')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="share-outline" size={18} color={COLORS.textTertiary} set="ionicons" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTotal}>{formatDurationLong(weeklyTime)}</Text>
            <Text style={styles.weeklySubtext}>
              {weekly?.sessionCount || 0} sessions across {weekly?.uniqueBooks || 0} books
            </Text>
          </View>
          <WeeklyChart dailyBreakdown={weekly?.dailyBreakdown || []} />
        </View>

        {/* All Time Stats Grid */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>All Time</Text>
            {allTimeTime > 0 && (
              <TouchableOpacity
                style={styles.shareIconButton}
                onPress={() => openShareModal('allTime')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="share-outline" size={18} color={COLORS.textTertiary} set="ionicons" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              icon="time-outline"
              label="Total Time"
              value={formatDuration(allTimeTime)}
              subtitle={allTime?.totalSessions ? `${allTime.totalSessions} sessions` : undefined}
              accentColor={COLORS.accent}
            />
            <StatCard
              icon="book-outline"
              label="Books"
              value={uniqueBooks.toString()}
              subtitle="unique titles"
              accentColor="#007AFF"
            />
            <StatCard
              icon="hourglass-outline"
              label="Avg Session"
              value={formatDuration(avgSession)}
              subtitle="per sitting"
              accentColor="#FF9500"
            />
            <StatCard
              icon="calendar-outline"
              label="Since"
              value={
                allTime?.firstListenDate
                  ? new Date(allTime.firstListenDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '--'
              }
              subtitle={allTime?.firstListenDate ? new Date(allTime.firstListenDate).getFullYear().toString() : ''}
              accentColor="#8E8E93"
            />
          </View>
        </View>

        {/* Top Books */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Most Listened</Text>
          <TopBooksList topBooks={topBooks || []} />
        </View>

        {/* Listening Pattern (Hour Heatmap) */}
        {byHour && byHour.some((h) => h.totalSeconds > 0) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>When You Listen</Text>
            <Text style={styles.patternSubtitle}>
              Activity by hour of day
            </Text>
            <HourHeatmap byHour={byHour} />
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Stats are recorded locally on your device
          </Text>
        </View>
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={shareModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeShareModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={closeShareModal}
          />
          <View style={styles.modalContent}>
            {shareType === 'weekly' && (
              <ShareStatsCard
                type="weekly"
                weeklyStats={weekly ? {
                  totalSeconds: weekly.totalSeconds,
                  sessionCount: weekly.sessionCount,
                  uniqueBooks: weekly.uniqueBooks,
                } : undefined}
                onClose={closeShareModal}
              />
            )}
            {shareType === 'streak' && (
              <ShareStatsCard
                type="streak"
                streakStats={streak ? {
                  currentStreak: streak.currentStreak,
                  longestStreak: streak.longestStreak,
                } : undefined}
                onClose={closeShareModal}
              />
            )}
            {shareType === 'allTime' && (
              <ShareStatsCard
                type="allTime"
                allTimeStats={allTime ? {
                  totalSeconds: allTime.totalSeconds,
                  totalSessions: allTime.totalSessions,
                  uniqueBooks: allTime.uniqueBooks,
                } : undefined}
                onClose={closeShareModal}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: SCREEN_BOTTOM_PADDING,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Today stats
  todayStats: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  todayMain: {
    alignItems: 'center',
  },
  todayTime: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: -1,
  },
  todayLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  todayMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  todayMetaText: {
    fontSize: 14,
    color: COLORS.textTertiary,
  },

  // Streak
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  streakItem: {
    alignItems: 'center',
    flex: 1,
  },
  streakDivider: {
    width: 1,
    height: 60,
    backgroundColor: COLORS.cardBorder,
  },
  streakValue: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
  },
  streakLabel: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 2,
  },

  // Weekly
  weeklyHeader: {
    marginBottom: 16,
  },
  weeklyTotal: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  weeklySubtext: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  chartContainer: {
    marginTop: 8,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarContainer: {
    height: 80,
    justifyContent: 'flex-end',
    width: '100%',
    paddingHorizontal: 4,
  },
  chartBar: {
    backgroundColor: COLORS.accentDim,
    borderRadius: 4,
    width: '100%',
    minHeight: 4,
  },
  chartBarToday: {
    backgroundColor: COLORS.accent,
  },
  chartBarEmpty: {
    backgroundColor: COLORS.cardBorder,
  },
  chartLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 6,
  },
  chartLabelToday: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  chartValue: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (SCREEN_WIDTH - 40 - 16 - 24) / 2, // Account for margins and gap
    backgroundColor: COLORS.cardBorder,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statSubtitle: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },

  // Top books
  topBooksContainer: {
    gap: 8,
  },
  topBookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBookRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBookRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  topBookInfo: {
    flex: 1,
  },
  topBookTitle: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  topBookBarContainer: {
    height: 4,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  topBookBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  topBookTime: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontWeight: '500',
  },

  // Hour heatmap
  patternSubtitle: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginBottom: 12,
    marginTop: -8,
  },
  heatmapContainer: {
    marginTop: 8,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  heatmapCellWrapper: {
    alignItems: 'center',
  },
  heatmapCell: {
    width: (SCREEN_WIDTH - 40 - 32 - 23 * 3) / 24,
    height: 20,
    borderRadius: 3,
    backgroundColor: COLORS.cardBorder,
  },
  heatmapLabel: {
    fontSize: 9,
    color: COLORS.textTertiary,
    marginTop: 4,
  },

  // Empty state
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textTertiary,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },

  // Card header with share button
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  shareIconButton: {
    padding: 4,
  },

  // Share modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
  },
});
