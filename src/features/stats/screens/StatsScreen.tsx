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
import { useStatsScreen, getWeekdayName } from '../hooks/useListeningStats';
import { formatDuration, formatDurationLong } from '@/shared/utils/format';
import { ShareStatsCard } from '../components/ShareStatsCard';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { accentColors, wp } from '@/shared/theme';
import { useColors, ThemeColors } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);

const ACCENT = accentColors.gold;

// Static colors that don't change with theme
const STATIC_COLORS = {
  accent: ACCENT,
  accentDim: 'rgba(243, 182, 12, 0.3)', // Gold at 30% opacity
  streakActive: '#FF9500', // Orange for active streak
  success: '#30D158', // Green for success
};

// Helper to create theme-aware colors object
function createColors(c: ThemeColors) {
  return {
    ...STATIC_COLORS,
    background: c.background.secondary,
    card: c.border.default,
    cardBorder: c.border.default,
    text: c.text.primary,
    textSecondary: c.text.secondary,
    textTertiary: c.text.tertiary,
  };
}

// Stat card component
interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
  colors: ReturnType<typeof createColors>;
}

function StatCard({ icon, label, value, subtitle, accentColor, colors }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.cardBorder }]}>
      <View style={[styles.statIcon, { backgroundColor: accentColor || colors.accent }]}>
        <Icon name={icon} size={20} color={colors.text} />
      </View>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      {subtitle && <Text style={[styles.statSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>}
    </View>
  );
}

// Weekly bar chart component
interface WeeklyChartProps {
  dailyBreakdown: Array<{ date: string; totalSeconds: number }>;
  colors: ReturnType<typeof createColors>;
}

function WeeklyChart({ dailyBreakdown, colors }: WeeklyChartProps) {
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
                    { height, backgroundColor: colors.accentDim },
                    isToday && { backgroundColor: colors.accent },
                    day.totalSeconds === 0 && { backgroundColor: colors.cardBorder },
                  ]}
                />
              </View>
              <Text style={[styles.chartLabel, { color: colors.textTertiary }, isToday && { color: colors.accent, fontWeight: '600' }]}>
                {day.weekday}
              </Text>
              {day.totalSeconds > 0 && (
                <Text style={[styles.chartValue, { color: colors.textSecondary }]}>{formatDuration(day.totalSeconds)}</Text>
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
  colors: ReturnType<typeof createColors>;
}

function HourHeatmap({ byHour, colors }: HourHeatmapProps) {
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
              ? colors.cardBorder
              : `rgba(243, 182, 12, ${0.2 + intensity * 0.8})`; // Gold heatmap

          return (
            <View key={item.hour} style={styles.heatmapCellWrapper}>
              <View style={[styles.heatmapCell, { backgroundColor }]} />
              {item.hour % 6 === 0 && (
                <Text style={[styles.heatmapLabel, { color: colors.textTertiary }]}>{formatHour(item.hour)}</Text>
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
  colors: ReturnType<typeof createColors>;
}

function TopBooksList({ topBooks, colors }: TopBooksProps) {
  if (topBooks.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No listening data yet</Text>
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
            <View style={[styles.topBookRank, { backgroundColor: colors.cardBorder }]}>
              <Text style={[styles.topBookRankText, { color: colors.textSecondary }]}>{index + 1}</Text>
            </View>
            <View style={styles.topBookInfo}>
              <Text style={[styles.topBookTitle, { color: colors.text }]} numberOfLines={1}>
                {book.bookTitle}
              </Text>
              <View style={[styles.topBookBarContainer, { backgroundColor: colors.cardBorder }]}>
                <View style={[styles.topBookBar, { width: `${barWidth}%`, backgroundColor: colors.accent }]} />
              </View>
            </View>
            <Text style={[styles.topBookTime, { color: colors.textTertiary }]}>{formatDuration(book.totalSeconds)}</Text>
          </View>
        );
      })}
    </View>
  );
}

type ShareType = 'weekly' | 'streak' | 'allTime' | null;

export function StatsScreen() {
  const insets = useSafeAreaInsets();
  const themeColors = useColors();
  const colors = createColors(themeColors);
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
    <View style={[styles.container, { paddingTop: insets.top + TOP_NAV_HEIGHT, backgroundColor: colors.background }]}>
      <StatusBar barStyle={themeColors.statusBar} backgroundColor={colors.background} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Listening Stats</Text>
        </View>

        {/* Today's Stats */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.textTertiary }]}>Today</Text>
          <View style={styles.todayStats}>
            <View style={styles.todayMain}>
              <Text style={[styles.todayTime, { color: colors.accent }]}>{formatDuration(todayTime)}</Text>
              <Text style={[styles.todayLabel, { color: colors.textSecondary }]}>listened today</Text>
            </View>
            {today && (
              <View style={[styles.todayMeta, { borderTopColor: colors.cardBorder }]}>
                <Text style={[styles.todayMetaText, { color: colors.textTertiary }]}>
                  {today.sessionCount} session{today.sessionCount !== 1 ? 's' : ''}
                </Text>
                <Text style={[styles.todayMetaText, { color: colors.textTertiary }]}>
                  {today.booksTouched.length} book{today.booksTouched.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Streak */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textTertiary }]}>Streak</Text>
            {currentStreak > 0 && (
              <TouchableOpacity
                style={styles.shareIconButton}
                onPress={() => openShareModal('streak')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="Share" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.streakContainer}>
            <View style={styles.streakItem}>
              <Icon
                name="Flame"
                size={28}
                color={currentStreak > 0 ? colors.streakActive : colors.textTertiary}

              />
              <Text style={[styles.streakValue, { color: colors.text }]}>{currentStreak}</Text>
              <Text style={[styles.streakLabel, { color: colors.textTertiary }]}>
                day{currentStreak !== 1 ? 's' : ''} current
              </Text>
            </View>
            <View style={[styles.streakDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.streakItem}>
              <Icon name="Trophy" size={28} color={colors.accent} />
              <Text style={[styles.streakValue, { color: colors.text }]}>{longestStreak}</Text>
              <Text style={[styles.streakLabel, { color: colors.textTertiary }]}>
                day{longestStreak !== 1 ? 's' : ''} best
              </Text>
            </View>
          </View>
        </View>

        {/* Weekly Overview */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textTertiary }]}>This Week</Text>
            {weeklyTime > 0 && (
              <TouchableOpacity
                style={styles.shareIconButton}
                onPress={() => openShareModal('weekly')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="Share" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.weeklyHeader}>
            <Text style={[styles.weeklyTotal, { color: colors.text }]}>{formatDurationLong(weeklyTime)}</Text>
            <Text style={[styles.weeklySubtext, { color: colors.textTertiary }]}>
              {weekly?.sessionCount || 0} sessions across {weekly?.uniqueBooks || 0} books
            </Text>
          </View>
          <WeeklyChart dailyBreakdown={weekly?.dailyBreakdown || []} colors={colors} />
        </View>

        {/* All Time Stats Grid */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textTertiary }]}>All Time</Text>
            {allTimeTime > 0 && (
              <TouchableOpacity
                style={styles.shareIconButton}
                onPress={() => openShareModal('allTime')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="Share" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              icon="Clock"
              label="Total Time"
              value={formatDuration(allTimeTime)}
              subtitle={allTime?.totalSessions ? `${allTime.totalSessions} sessions` : undefined}
              accentColor={colors.accent}
              colors={colors}
            />
            <StatCard
              icon="book-outline"
              label="Books"
              value={uniqueBooks.toString()}
              subtitle="unique titles"
              accentColor="#007AFF"
              colors={colors}
            />
            <StatCard
              icon="hourglass-outline"
              label="Avg Session"
              value={formatDuration(avgSession)}
              subtitle="per sitting"
              accentColor="#FF9500"
              colors={colors}
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
              colors={colors}
            />
          </View>
        </View>

        {/* Top Books */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.textTertiary }]}>Most Listened</Text>
          <TopBooksList topBooks={topBooks || []} colors={colors} />
        </View>

        {/* Listening Pattern (Hour Heatmap) */}
        {byHour && byHour.some((h) => h.totalSeconds > 0) && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.textTertiary }]}>When You Listen</Text>
            <Text style={[styles.patternSubtitle, { color: colors.textTertiary }]}>
              Activity by hour of day
            </Text>
            <HourHeatmap byHour={byHour} colors={colors} />
          </View>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
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
    // backgroundColor set via colors.background in JSX
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
    // color set via colors.text in JSX
    letterSpacing: -0.5,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    // backgroundColor set via colors.card in JSX
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    // color set via colors.textTertiary in JSX
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
    // color set via colors.accent in JSX
    letterSpacing: -1,
  },
  todayLabel: {
    fontSize: 15,
    // color set via colors.textSecondary in JSX
    marginTop: 4,
  },
  todayMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    // borderTopColor set via colors.cardBorder in JSX
  },
  todayMetaText: {
    fontSize: 14,
    // color set via colors.textTertiary in JSX
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
    // backgroundColor set via colors.cardBorder in JSX
  },
  streakValue: {
    fontSize: 36,
    fontWeight: '700',
    // color set via colors.text in JSX
    marginTop: 8,
  },
  streakLabel: {
    fontSize: 13,
    // color set via colors.textTertiary in JSX
    marginTop: 2,
  },

  // Weekly
  weeklyHeader: {
    marginBottom: 16,
  },
  weeklyTotal: {
    fontSize: 20,
    fontWeight: '600',
    // color set via colors.text in JSX
  },
  weeklySubtext: {
    fontSize: 13,
    // color set via colors.textTertiary in JSX
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
    // backgroundColor set dynamically in JSX
    borderRadius: 4,
    width: '100%',
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 11,
    // color set dynamically in JSX
    marginTop: 6,
  },
  chartValue: {
    fontSize: 10,
    // color set via colors.textSecondary in JSX
    marginTop: 2,
  },

  // Stats grid - 2 columns
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    // Width calculation: (screenWidth - cardMargins - cardPadding - gap) / 2
    // 40 = card horizontal margins (20*2), 32 = card padding (16*2), 12 = gap
    width: (SCREEN_WIDTH - 40 - 32 - 12) / 2,
    // backgroundColor set via colors.cardBorder in JSX
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // backgroundColor set via accentColor prop in JSX
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    // color set via colors.textTertiary in JSX
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    // color set via colors.text in JSX
  },
  statSubtitle: {
    fontSize: 11,
    // color set via colors.textTertiary in JSX
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
    // backgroundColor set via colors.cardBorder in JSX
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBookRankText: {
    fontSize: 12,
    fontWeight: '600',
    // color set via colors.textSecondary in JSX
  },
  topBookInfo: {
    flex: 1,
  },
  topBookTitle: {
    fontSize: 14,
    // color set via colors.text in JSX
    marginBottom: 4,
  },
  topBookBarContainer: {
    height: 4,
    // backgroundColor set via colors.cardBorder in JSX
    borderRadius: 2,
    overflow: 'hidden',
  },
  topBookBar: {
    height: '100%',
    // backgroundColor set via colors.accent in JSX
    borderRadius: 2,
  },
  topBookTime: {
    fontSize: 13,
    // color set via colors.textTertiary in JSX
    fontWeight: '500',
  },

  // Hour heatmap
  patternSubtitle: {
    fontSize: 13,
    // color set via colors.textTertiary in JSX
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
    // backgroundColor set dynamically in JSX
  },
  heatmapLabel: {
    fontSize: 9,
    // color set via colors.textTertiary in JSX
    marginTop: 4,
  },

  // Empty state
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    // color set via colors.textTertiary in JSX
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    // color set via colors.textTertiary in JSX
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Dark overlay - intentional
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
